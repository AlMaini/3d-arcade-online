/**
 * InputRouter
 *
 * Bridges browser keyboard/gamepad input to EmulatorJS.
 * Keyboard state is tracked via a Set to avoid key-repeat events.
 * Gamepad polling runs inside the master RAF loop via poll().
 *
 * While the emulator is focused, inputs are consumed here and NOT
 * forwarded to OrbitControls. Click the Three.js canvas to unfocus.
 */

const KEY_MAP = {
  ArrowUp:    'up',
  ArrowDown:  'down',
  ArrowLeft:  'left',
  ArrowRight: 'right',
  z:          'lp',   // light punch
  Z:          'lp',
  x:          'mp',   // medium punch
  X:          'mp',
  c:          'hp',   // heavy punch
  C:          'hp',
  a:          'lk',   // light kick
  A:          'lk',
  s:          'mk',   // medium kick
  S:          'mk',
  d:          'hk',   // heavy kick
  D:          'hk',
  Enter:      'start',
  Shift:      'coin',
}

const CAPTURED_KEYS = new Set(Object.keys(KEY_MAP))

export class InputRouter {
  /** @type {Set<string>} */
  #heldKeys = new Set()

  /** @type {boolean} */
  #emulatorFocused = false

  /** @type {EmulatorBridge} */
  #emulatorBridge

  /**
   * @param {import('./EmulatorBridge.js').EmulatorBridge} emulatorBridge
   * @param {HTMLElement} threeCanvas — used to toggle focus mode on click
   */
  constructor(emulatorBridge, threeCanvas) {
    this.#emulatorBridge = emulatorBridge

    window.addEventListener('keydown', this.#onKeyDown)
    window.addEventListener('keyup', this.#onKeyUp)

    threeCanvas.addEventListener('click', () => {
      this.#emulatorFocused = false
    })
  }

  /** Call once per frame from the master RAF loop */
  poll() {
    if (!this.#emulatorBridge.isReady) return

    const gamepads = navigator.getGamepads()
    for (const gp of gamepads) {
      if (!gp) continue
      this.#pollGamepad(gp)
    }
  }

  /** @returns {boolean} Whether emulator is consuming input */
  get emulatorFocused() {
    return this.#emulatorFocused
  }

  set emulatorFocused(value) {
    this.#emulatorFocused = value
  }

  #onKeyDown = (e) => {
    if (this.#heldKeys.has(e.key)) return  // ignore key repeat

    if (CAPTURED_KEYS.has(e.key)) {
      e.preventDefault()
      this.#heldKeys.add(e.key)

      const button = KEY_MAP[e.key]
      if (this.#emulatorBridge.isReady) {
        // TODO: forward to EmulatorJS input API when wired
        // EJS_emulator.simulateInput(0, button, 1)
        console.debug(`[InputRouter] keydown → ${button}`)
      }
    }
  }

  #onKeyUp = (e) => {
    this.#heldKeys.delete(e.key)

    const button = KEY_MAP[e.key]
    if (button && this.#emulatorBridge.isReady) {
      // TODO: forward to EmulatorJS input API when wired
      // EJS_emulator.simulateInput(0, button, 0)
      console.debug(`[InputRouter] keyup → ${button}`)
    }
  }

  #pollGamepad(gp) {
    // TODO: map gamepad axes/buttons to emulator input API when wired
    // Standard gamepad layout (https://w3c.github.io/gamepad/#remapping):
    //   buttons[0] = A (south)  → lk
    //   buttons[1] = B (east)   → mk
    //   buttons[2] = X (west)   → lp
    //   buttons[3] = Y (north)  → mp
    //   buttons[12..15]         → dpad
    //   buttons[9]              → start
    //   buttons[8]              → select/coin
  }

  destroy() {
    window.removeEventListener('keydown', this.#onKeyDown)
    window.removeEventListener('keyup', this.#onKeyUp)
  }
}
