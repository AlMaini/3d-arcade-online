/**
 * EmulatorBridge
 *
 * Wraps EmulatorJS and manages the hidden emulator canvas.
 *
 * Canvas strategy:
 *   - Before game starts: outputCanvas returns a blank 384×224 placeholder so
 *     ScreenMesh has something to reference at init time.
 *   - After EJS_onGameStart: outputCanvas returns window.EJS_emulator.canvas
 *     directly. SceneManager swaps the texture.image to this canvas and sets
 *     needsUpdate = true each frame. No intermediate blit needed — Three.js
 *     reads from the EJS WebGL canvas in the same RAF cycle that EJS renders,
 *     before the GPU presents the frame.
 *
 * Core map (EmulatorJS core names):
 *   cps1 → fbalpha2012_cps1
 *   cps2 → fbalpha2012_cps2
 *   neo  → fbneo
 */

/** @type {Record<string, string>} */
const CORE_MAP = {
  cps1:  'fbalpha2012_cps1',
  cps2:  'fbalpha2012_cps2',
  neo:   'fbneo',
  fbneo: 'fbneo',
};

export class EmulatorBridge {
  /** @type {HTMLCanvasElement} Blank placeholder until game starts */
  #placeholderCanvas = null;

  /** @type {HTMLCanvasElement | null} The actual EJS game canvas, set after EJS_onGameStart */
  #ejsCanvas = null;

  /** @type {boolean} */
  #isReady = false;

  /**
   * @param {string} containerId — ID of the hidden DOM container EmulatorJS renders into
   */
  constructor(containerId) {
    if (!document.getElementById(containerId)) {
      throw new Error(`EmulatorBridge: container #${containerId} not found in DOM`);
    }

    // Placeholder canvas so ScreenMesh has a valid image source before the game loads.
    this.#placeholderCanvas = document.createElement('canvas');
    this.#placeholderCanvas.width = 384;
    this.#placeholderCanvas.height = 224;
  }

  /**
   * Load a ROM file and initialize EmulatorJS.
   * Resolves when the game actually starts running (EJS_onGameStart).
   *
   * @param {File} file — ROM .zip file from file input
   * @param {string} systemType — one of: 'cps1', 'cps2', 'neo'
   * @param {File | null} parentFile — parent ROM zip for clone ROMs (e.g. mvsc.zip for mvscur1.zip)
   * @returns {Promise<void>}
   */
  async loadROM(file, systemType, parentFile = null) {
    this.#isReady = false;
    this.#ejsCanvas = null;

    const core = CORE_MAP[systemType] ?? 'fbalpha2012_cps2';
    console.log(`[EmulatorBridge] loadROM — system: ${systemType} → core: ${core}, file: ${file.name}${parentFile ? `, parent: ${parentFile.name}` : ''}`);

    return new Promise((resolve, reject) => {
      window.EJS_DEBUG_XX      = true;
      window.EJS_player        = '#emulator-container';
      window.EJS_core          = core;
      window.EJS_gameUrl       = file;
      window.EJS_gameName      = file.name.replace(/\.[^.]+$/, '');
      window.EJS_gameParentUrl = parentFile ?? undefined;
      window.EJS_pathtodata    = '/emulatorjs/data/';
      window.EJS_startOnLoaded = true;
      window.EJS_noAutoFocus   = true;

      window.EJS_ready = () => {
        // EJS_ready fires ~20ms after startButtonClicked, while the WASM core
        // is still downloading. The canvas element exists but has no WebGL
        // context yet — this is our only window to intercept getContext and
        // force preserveDrawingBuffer:true before emscripten claims the canvas.
        const ejsCanvas = window.EJS_emulator?.canvas;
        if (ejsCanvas) {
          const _getContext = ejsCanvas.getContext.bind(ejsCanvas);
          ejsCanvas.getContext = (type, attrs = {}) => {
            if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
              attrs = { ...attrs, preserveDrawingBuffer: true };
              console.log(`[EmulatorBridge] injecting preserveDrawingBuffer:true into ${type} context`);
            }
            return _getContext(type, attrs);
          };
        }
      };

      window.EJS_onGameStart = () => {
        console.log('[EmulatorBridge] 🎮 EJS_onGameStart fired');

        const ejsCanvas = window.EJS_emulator?.canvas ?? null;
        if (!ejsCanvas) {
          console.warn('[EmulatorBridge] ⚠️ No EJS_emulator.canvas found');
          this.#isReady = true;
          resolve();
          return;
        }

        const markReady = () => {
          this.#ejsCanvas = ejsCanvas;
          console.log(`[EmulatorBridge] ✅ game canvas ready: ${ejsCanvas.width}x${ejsCanvas.height}`);
          this.#isReady = true;
          resolve();
        };

        // EJS_onGameStart fires while the canvas is still at the HTML default
        // 300×150. The emulator resizes it to actual game resolution shortly after.
        // Wait for that resize before handing the canvas to Three.js so the GPU
        // texture is allocated at the correct size from the start.
        if (ejsCanvas.width > 300) {
          markReady();
        } else {
          console.log(`[EmulatorBridge] canvas still at default size (${ejsCanvas.width}x${ejsCanvas.height}), waiting for resize…`);
          const observer = new MutationObserver(() => {
            if (ejsCanvas.width > 300) {
              observer.disconnect();
              markReady();
            }
          });
          observer.observe(ejsCanvas, { attributes: true, attributeFilter: ['width', 'height'] });
        }
      };

      window.EJS_onLoadState = () => console.log('[EmulatorBridge] state loaded');
      window.EJS_onSaveState = () => console.log('[EmulatorBridge] state saved');

      const script = document.createElement('script');
      script.src = '/emulatorjs/data/loader.js';
      script.onerror = () => reject(new Error('[EmulatorBridge] Failed to load /emulatorjs/data/loader.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Returns the canvas Three.js should use as the texture source.
   * Before game start: returns the blank placeholder (so ScreenMesh has a valid source).
   * After game start: returns the live EJS WebGL canvas directly.
   * SceneManager detects the reference change and swaps texture.image accordingly.
   *
   * @returns {HTMLCanvasElement}
   */
  get outputCanvas() {
    return this.#ejsCanvas ?? this.#placeholderCanvas;
  }

  /** @returns {boolean} */
  get isReady() {
    return this.#isReady;
  }

  pause() {
    window.EJS_emulator?.pause?.();
  }

  resume() {
    window.EJS_emulator?.play?.();
  }
}
