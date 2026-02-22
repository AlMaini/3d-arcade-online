# Arcade Cabinet Emulator — Design Document

## Project Overview

A browser-based arcade emulator embedded inside an interactive 3D scene. The emulator renders into a hidden canvas, which is streamed as a live texture onto a 3D arcade cabinet model in Three.js. CRT post-processing shaders are applied to the screen quad to simulate authentic phosphor display characteristics. The user interacts with both the 3D scene (camera, atmosphere) and the emulator (gamepad/keyboard input).

---

## Goals

- Run CPS1/CPS2-era arcade ROMs (Street Fighter, Marvel vs Capcom, etc.) at full 60fps in browser
- Display the emulator output on a 3D arcade cabinet model with CRT effects
- Maintain a single coherent render loop with no frame tearing or input lag
- ROM loading via user file upload only (no server-side ROM hosting)
- Desktop-only target (no mobile support in v1)

---

## Architecture Overview

```
User Input (keyboard/gamepad)
        │
        ▼
┌───────────────────┐
│   EmulatorJS      │  ← WASM core (FinalBurn Neo / MAME)
│   (hidden canvas) │
└────────┬──────────┘
         │ pixel data (canvas)
         ▼
┌───────────────────┐
│  CanvasTexture    │  ← THREE.CanvasTexture, needsUpdate=true each frame
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Cabinet Mesh     │  ← GLTF model, screen face = PlaneGeometry
│  (Three.js scene) │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  EffectComposer   │  ← RenderPass → CRTShaderPass (single uber-pass)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  WebGL Canvas     │  ← displayed to user
└───────────────────┘
```

---

## Directory Structure

```
/
├── index.html
├── src/
│   ├── main.js              # entry point, bootstraps everything
│   ├── emulator/
│   │   ├── EmulatorBridge.js    # wraps EmulatorJS, exposes canvas output
│   │   └── InputRouter.js       # keyboard/gamepad → emulator input
│   ├── scene/
│   │   ├── SceneManager.js      # Three.js scene, camera, lights, RAF loop
│   │   ├── CabinetLoader.js     # loads GLTF cabinet, sets up screen mesh
│   │   ├── ScreenMesh.js        # PlaneGeometry with CanvasTexture
│   │   └── Environment.js       # lighting, fog, floor, ambient dressing
│   ├── shaders/
│   │   ├── CRTShader.js         # uber-shader (scanlines, barrel, bloom, vignette)
│   │   └── CRTShader.glsl       # GLSL source (imported as string)
│   ├── postprocessing/
│   │   └── PostProcessor.js     # EffectComposer setup, render targets
│   └── ui/
│       ├── ROMLoader.js         # file input UI, passes ROM to EmulatorBridge
│       └── Overlay.js           # loading screen, game select UI
├── assets/
│   ├── cabinet/
│   │   └── cabinet.glb          # arcade cabinet GLTF model
│   └── hdri/
│       └── arcade.hdr           # environment map for reflections
├── public/
│   └── emulatorjs/              # EmulatorJS library files (self-hosted)
└── vite.config.js
```

---

## Module Specifications

### `EmulatorBridge.js`

Wraps EmulatorJS and manages the hidden emulator canvas.

**Responsibilities:**
- Initialize EmulatorJS with user-provided ROM and system type
- Maintain a reference to the emulator's output canvas (`this.canvas`)
- Expose `isReady` boolean and `outputCanvas` getter
- Do NOT manage its own RAF loop — tick is driven externally

**Key implementation notes:**
- EmulatorJS renders to a canvas element that must exist in the DOM but can be `visibility: hidden; position: absolute; pointer-events: none`
- Canvas size should be set to native emulator resolution. For CPS2: **384×224px**. Do not scale the canvas — upscaling happens in the shader
- System type strings for EmulatorJS: `'arcade'` with FinalBurn Neo core for CPS1/CPS2 games

**Interface:**
```js
class EmulatorBridge {
  constructor(containerId: string)
  async loadROM(file: File, systemType: string): Promise<void>
  get outputCanvas(): HTMLCanvasElement
  get isReady(): boolean
  pause(): void
  resume(): void
}
```

---

### `InputRouter.js`

Bridges browser input events to the emulator's input API.

**Responsibilities:**
- Listen for `keydown` / `keyup` events
- Poll `navigator.getGamepads()` each frame for gamepad state
- Map inputs to emulator button codes
- Prevent default browser behavior for mapped keys (arrow keys, space, etc.)

**Default keyboard mapping (player 1):**
```
Arrow keys    → directional input
Z             → light punch
X             → medium punch
C             → heavy punch
A             → light kick
S             → medium kick
D             → heavy kick
Enter         → start
Shift         → coin/select
```

**Implementation notes:**
- Use a `Set` of currently held keys to avoid key repeat events
- Gamepad polling happens inside the master RAF loop, not in its own interval
- Input events must NOT propagate to Three.js camera controls while the emulator is focused

---

### `SceneManager.js`

The central coordinator. Owns the master RAF loop and coordinates all subsystems.

**Responsibilities:**
- Create `THREE.WebGLRenderer` and configure it
- Run the single master `requestAnimationFrame` loop
- Each frame: tick input → mark texture dirty → render scene → composer render
- Expose `start()`, `stop()`, `pause()` methods

**Renderer configuration:**
```js
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.8  // slightly dark for arcade atmosphere
```

**Master RAF loop:**
```js
function tick() {
  requestAnimationFrame(tick)

  // 1. Poll gamepad input
  inputRouter.poll()

  // 2. Mark emulator texture dirty if emulator is running
  if (emulatorBridge.isReady) {
    screenMesh.texture.needsUpdate = true
  }

  // 3. Update any scene animations (cabinet idle sway, etc.)
  sceneAnimator.update(clock.getDelta())

  // 4. Render
  postProcessor.composer.render()
}
```

**Camera:**
- `THREE.PerspectiveCamera`, fov 45, near 0.1, far 100
- Initial position: `(0, 1.2, 3.5)` looking at `(0, 1.0, 0)` (eye-level with screen)
- `OrbitControls` with damping enabled, polar angle clamped to prevent going under the floor or above the cabinet
- Disable orbit controls while emulator is in focus (click-to-focus model)

---

### `CabinetLoader.js`

Loads and configures the 3D cabinet model.

**Responsibilities:**
- Load `cabinet.glb` via `GLTFLoader`
- Traverse the model and configure materials (reflectivity, roughness)
- Identify the screen face mesh by name (convention: name it `"screen"` in Blender before export)
- Return a reference to the screen mesh for `ScreenMesh.js` to take over

**Material setup:**
```js
cabinet.traverse((node) => {
  if (node.isMesh) {
    node.material.envMap = envMap
    node.material.envMapIntensity = 0.4
    node.castShadow = true
    node.receiveShadow = true

    if (node.name === 'screen') {
      // hand off to ScreenMesh — do not configure material here
      screenNode = node
    }

    if (node.name.includes('bezel')) {
      node.material.roughness = 0.3
      node.material.metalness = 0.1
    }

    if (node.name.includes('body')) {
      node.material.roughness = 0.8
      node.material.metalness = 0.0
    }
  }
})
```

**GLTF model requirements (document for artist/modeler):**
- Cabinet body, bezel, marquee, and control panel should be separate mesh objects
- Screen face mesh must be named exactly `"screen"`, UV-mapped to fill 0–1 range
- Screen plane should have mild curvature baked into geometry (not flat)
- Export as GLTF binary (`.glb`), Draco compression optional but recommended
- Coordinate system: Y-up, cabinet base at Y=0, total height ~2.2 units

---

### `ScreenMesh.js`

Manages the screen quad — the emulator texture and its geometry.

**Responsibilities:**
- Replace the cabinet's screen mesh material with a `MeshBasicMaterial` using `CanvasTexture`
- Optionally replace the screen geometry with a subdivided `PlaneGeometry` for curvature
- Update `texture.needsUpdate` flag (called from SceneManager each frame)

**Setup:**
```js
const texture = new THREE.CanvasTexture(emulatorBridge.outputCanvas)
texture.minFilter = THREE.LinearFilter
texture.magFilter = THREE.LinearFilter
texture.colorSpace = THREE.SRGBColorSpace

// Replace mesh material — keep geometry from GLTF (it has the baked curvature)
screenNode.material = new THREE.MeshBasicMaterial({
  map: texture,
  toneMapped: false,  // CRITICAL: don't apply scene tone mapping to screen — shader handles it
})

this.texture = texture
```

**Why `MeshBasicMaterial`:** The screen is self-illuminated. It should not receive scene lighting. `MeshBasicMaterial` ignores lights, which is correct behavior for a CRT screen.

**Why `toneMapped: false`:** Scene tone mapping (ACES) will crush the screen colors. The CRT shader handles its own color grading.

---

### `PostProcessor.js`

Sets up `EffectComposer` with the CRT shader pass.

**Pass chain:**
```
RenderPass (full scene) → CRTShaderPass → output
```

Only one custom pass. All CRT effects (scanlines, barrel distortion, chromatic aberration, vignette, bloom approximation) are combined in a single fragment shader to minimize framebuffer blits.

**Setup:**
```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { CRTShader } from '../shaders/CRTShader.js'

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new ShaderPass(CRTShader))
```

**Render target size:** Match renderer size. Use `composer.setSize(width, height)` on window resize.

**Note on scope:** The CRT shader runs on the full composer output, not just the screen quad. This means barrel distortion and scanlines will technically apply to the whole scene. In practice this is fine — the effects are subtle at scene scale and add to atmosphere. If you want screen-only effects, you'd need a second render target for just the screen quad, which is a significant complexity increase not worth it for v1.

---

### `CRTShader.js` / `CRTShader.glsl`

The core visual effect. A single GLSL fragment shader implementing all CRT characteristics.

**Uniforms:**
```glsl
uniform sampler2D tDiffuse;      // input from RenderPass
uniform vec2 uResolution;        // viewport resolution in pixels
uniform float uTime;             // elapsed time (for subtle flicker)
uniform float uScanlineIntensity; // 0.0–1.0, default 0.15
uniform float uBarrelStrength;   // 0.0–1.0, default 0.15
uniform float uChromaticAberration; // 0.0–1.0, default 0.003
uniform float uVignetteStrength; // 0.0–1.0, default 0.4
uniform float uBrightness;       // default 1.1
```

**Fragment shader implementation:**

```glsl
// 1. Barrel distortion
vec2 barrelDistort(vec2 uv, float strength) {
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc);
  return uv + cc * dist * strength;
}

// 2. Chromatic aberration — sample R, G, B at slightly offset UVs
vec4 sampleChromatic(sampler2D tex, vec2 uv, float aberration) {
  float r = texture2D(tex, uv + vec2(aberration, 0.0)).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - vec2(aberration, 0.0)).b;
  return vec4(r, g, b, 1.0);
}

void main() {
  vec2 uv = vUv;

  // Apply barrel distortion
  uv = barrelDistort(uv, uBarrelStrength * 0.3);

  // Clip pixels outside distorted bounds (black border)
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Sample with chromatic aberration
  vec4 color = sampleChromatic(tDiffuse, uv, uChromaticAberration);

  // Scanlines — modulate brightness based on vertical screen pixel position
  float scanline = sin(uv.y * uResolution.y * 3.14159265) * 0.5 + 0.5;
  scanline = pow(scanline, 0.5);  // soften the falloff
  color.rgb *= mix(1.0, scanline, uScanlineIntensity);

  // Subtle phosphor glow approximation — boost bright areas
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb += color.rgb * luma * 0.15;

  // Brightness
  color.rgb *= uBrightness;

  // Subtle time-based flicker (very faint)
  float flicker = 1.0 + sin(uTime * 60.0) * 0.003;
  color.rgb *= flicker;

  // Vignette
  vec2 vigUv = uv * (1.0 - uv.yx);
  float vignette = vigUv.x * vigUv.y * 15.0;
  vignette = pow(vignette, uVignetteStrength);
  color.rgb *= vignette;

  gl_FragColor = color;
}
```

**Export as Three.js ShaderMaterial descriptor:**
```js
export const CRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uScanlineIntensity: { value: 0.15 },
    uBarrelStrength: { value: 0.15 },
    uChromaticAberration: { value: 0.003 },
    uVignetteStrength: { value: 0.4 },
    uBrightness: { value: 1.1 },
  },
  vertexShader: `/* standard passthrough */`,
  fragmentShader: `/* above GLSL */`,
}
```

Update `uTime` each frame from the master loop: `crtPass.uniforms.uTime.value = clock.getElapsedTime()`

---

### `Environment.js`

Sets the visual atmosphere of the arcade scene.

**Lighting setup:**
```js
// Ambient — very low, dark arcade feel
const ambient = new THREE.AmbientLight(0x111122, 0.3)

// Main overhead light — slightly warm, dim
const overhead = new THREE.DirectionalLight(0xfff5e0, 0.6)
overhead.position.set(0, 5, 2)
overhead.castShadow = false  // skip for performance

// Screen glow — colored point light in front of cabinet screen
// Simulate the light the CRT casts into the room
const screenGlow = new THREE.PointLight(0x3388ff, 0.8, 3)
screenGlow.position.set(0, 1.1, 1.2)  // just in front of screen

// Optional: a subtle neon accent light from a sign off to the side
const neonAccent = new THREE.PointLight(0xff0044, 0.4, 5)
neonAccent.position.set(-3, 2, 0)
```

**Floor:**
- `PlaneGeometry` with `MeshStandardMaterial`, roughness 0.2, metalness 0.1
- Dark color (near-black) with subtle reflection — gives the "polished arcade floor" look
- No shadow receiver needed at this lighting level

**Fog:**
```js
scene.fog = new THREE.FogExp2(0x000011, 0.12)
```
Exponential fog hides the scene edges and gives depth without needing a large environment.

**Environment map:**
- Load an HDR using `RGBELoader` for material reflections
- Set as `scene.environment` (affects PBR reflections on cabinet body)
- Set `scene.background` to a dark color or null (fog handles background)

---

### `ROMLoader.js`

UI for ROM file loading. Shown before the 3D scene is interactive.

**Flow:**
1. User lands on page — sees a styled file input overlay
2. User selects a `.zip` ROM file from their local filesystem
3. `ROMLoader` reads the file using `FileReader` API
4. Passes the `File` object to `EmulatorBridge.loadROM(file, systemType)`
5. Shows a loading spinner while emulator initializes
6. On `EmulatorBridge.isReady`, hides the overlay and starts the scene

**System type detection:**
- Allow user to select system type from a dropdown (CPS1, CPS2, Neo Geo, etc.)
- Do not attempt to auto-detect from ROM filename — too error-prone

**No server-side ROM handling.** All ROM data stays in browser memory. Do not upload ROMs to any server.

---

## Performance Budget

Target: stable 60fps on a mid-range desktop GPU (e.g. GTX 1060 / RX 580 class).

| Budget item | Target |
|---|---|
| Total frame time | < 16.6ms |
| Three.js scene render | < 8ms |
| EffectComposer pass | < 3ms |
| CanvasTexture upload | < 2ms |
| WASM emulator tick | < 3ms (runs async, overlaps) |
| Input polling | < 0.5ms |

**Draw call budget:** Keep the scene under 30 draw calls. Cabinet model should be exported with merged meshes where possible (bezel + body can be one mesh with multiple materials, or ideally one atlas-textured mesh).

**Texture budget:**
- Emulator canvas: 384×224 (CPS2 native) — ~340KB/frame RGBA
- Cabinet diffuse/normal/roughness maps: 2048×2048 max
- HDR environment: 1024×512 (lower res is fine for background reflections)

---

## Performance Concerns & Mitigations

### CanvasTexture CPU→GPU upload
Every frame, `CanvasTexture` with `needsUpdate=true` triggers a `texSubImage2D` call that uploads the emulator canvas pixels to GPU memory. At 384×224 RGBA this is ~344KB per frame, ~20MB/s at 60fps — well within GPU bandwidth limits. **Risk:** if the emulator canvas is ever scaled up to screen resolution (e.g. 1920×1080), this becomes ~8MB/frame, ~480MB/s, which will cause stuttering. **Mitigation:** always keep the emulator canvas at native or 2x resolution.

### Single RAF loop contention
EmulatorJS internally uses its own RAF loop. This creates two competing loops. **Mitigation:** configure EmulatorJS to expose a manual tick API, or run it in a Web Worker with OffscreenCanvas (advanced). For v1, coexisting RAF loops should be acceptable — watch for double-rendering symptoms (canvas updating faster than needed). If problems arise, intercept EmulatorJS's RAF with a global hook.

### EffectComposer double buffer
EffectComposer by default uses a ping-pong render target at full viewport resolution. At 1920×1080 with pixel ratio 2, this is 4K — large. **Mitigation:** set `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` and cap at 2. If performance is tight, render the composer at 1x pixel ratio even on HiDPI screens (the CRT shader masks aliasing anyway).

### WASM jank on ROM load
When EmulatorJS loads and parses a ROM, it can block the main thread for 200–500ms. This is a one-time event. **Mitigation:** show a loading overlay during this phase. Do not start the RAF loop until `isReady` fires.

### Shader complexity
The CRT uber-shader runs on every pixel every frame. At 1920×1080 this is 2M fragment invocations. The shader is intentionally simple (no loops, 3 texture samples for chromatic aberration, basic math). This should run in < 1ms on any discrete GPU.

---

## Build & Tooling

**Framework:** Vanilla JS with Vite. No framework needed — the complexity is in WebGL/WASM, not UI state management.

**Dependencies:**
```json
{
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

EmulatorJS is self-hosted under `/public/emulatorjs/` — do not import it as an npm package. Follow EmulatorJS docs for self-hosted setup (copy their `data/` folder structure).

**Vite config notes:**
- Set `assetsInlineLimit: 0` to prevent WASM files from being inlined
- Use `?url` import suffix for GLSL files if not using a GLSL plugin: `import frag from './CRTShader.glsl?raw'`
- Headers needed for WASM SharedArrayBuffer (if EmulatorJS needs it): set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`

---

## V1 Scope Boundary

**In scope for v1:**
- CPS2 system support only (Street Fighter Alpha series, MvC1, Dungeons & Dragons, etc.)
- Single player — one keyboard mapping, one gamepad
- Basic cabinet model (can be a placeholder box if GLTF isn't ready)
- CRT shader with scanlines, barrel distortion, vignette
- ROM file upload flow
- Desktop Chrome/Firefox only

**Out of scope for v1:**
- Multiplayer / 2-player input
- Multiple system types (Neo Geo, CPS1, MAME broad support)
- Mobile
- Save states UI
- Coin/credit system UI
- Sound configuration
- Full cabinet model with marquee animation
- Phosphor persistence simulation (frame blending)
- Web Worker / OffscreenCanvas architecture

---

## Implementation Order

1. Get EmulatorJS running standalone (no Three.js) with a ROM loading flow. Verify 60fps emulation.
2. Add Three.js renderer. Render a basic `BoxGeometry` scene. Confirm RAF loop.
3. Create `ScreenMesh` — map the emulator canvas as a `CanvasTexture` onto a plane. Verify live updating.
4. Add `EffectComposer` with a passthrough `ShaderPass`. Confirm no regression.
5. Implement `CRTShader` effects incrementally: barrel → scanlines → vignette → chromatic aberration → flicker.
6. Load the cabinet GLTF. Attach the screen texture to the screen mesh node.
7. Add `Environment` (lighting, fog, floor).
8. Wire `InputRouter` — test keyboard and gamepad.
9. Polish: camera controls, loading overlay, UI chrome.
10. Performance pass: profile, address any frame budget overruns.
