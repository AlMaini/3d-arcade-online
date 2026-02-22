# 3D Arcade Online

Browser-based arcade emulator displayed as a live texture on an interactive 3D arcade cabinet with CRT post-processing.

Built with Three.js + Vite. EmulatorJS handles the WASM emulation core.

---

## Dev Server

```bash
npm install
npm run dev
```

Open http://localhost:5173. You'll see the ROM upload overlay with the Three.js scene behind it.

---

## EmulatorJS Setup

EmulatorJS is self-hosted and **not included** in this repository (it's too large and contains emulation cores). You must set it up manually before ROM loading will work.

### Steps

1. **Download EmulatorJS**

   Go to https://github.com/EmulatorJS/EmulatorJS/releases and download the latest release zip, or clone the repo:

   ```bash
   git clone https://github.com/EmulatorJS/EmulatorJS.git /tmp/emulatorjs
   ```

2. **Copy the `data/` folder**

   Copy the `data/` directory from the EmulatorJS repo into `public/emulatorjs/`:

   ```bash
   cp -r /tmp/emulatorjs/data public/emulatorjs/data
   ```

   The result should look like:

   ```
   public/
   └── emulatorjs/
       └── data/
           ├── loader.js
           ├── cores/
           │   └── fba_libretro.wasm   ← CPS2 core
           └── ...
   ```

3. **Wire EmulatorJS in `EmulatorBridge.js`**

   Open `src/emulator/EmulatorBridge.js` and replace the stub `loadROM` implementation with the real EmulatorJS init block documented in the TODO comment. The key variables to set:

   ```js
   window.EJS_player = '#emulator-canvas'
   window.EJS_core = 'fba'               // FinalBurn Alpha for CPS1/CPS2
   window.EJS_gameUrl = URL.createObjectURL(file)
   window.EJS_pathtodata = '/emulatorjs/data/'
   window.EJS_ready = () => { /* set isReady = true */ }
   ```

   Full docs: https://github.com/EmulatorJS/EmulatorJS/blob/main/docs/Getting%20Started.md

### Supported Systems (v1)

| System | EmulatorJS core | Notes |
|--------|----------------|-------|
| CPS2   | `fba`          | Street Fighter Alpha, MvC1, DnD |
| CPS1   | `fba`          | Ghosts n' Goblins, Final Fight |
| Neo Geo | `fba`         | KOF series |

### ROM Format

ROMs must be in `.zip` format, MAME-compatible naming convention. EmulatorJS uses FinalBurn Neo which accepts standard MAME ROM sets.

---

## Adding the Cabinet Model

The scene currently uses a placeholder `BoxGeometry` cabinet. To swap in a real GLTF model:

1. Place your `cabinet.glb` in `assets/cabinet/`
2. Open `src/scene/CabinetLoader.js`
3. In the `load()` method, change `this.#loadPlaceholder(scene)` to `this.#loadGLTF(scene)` and uncomment the GLTF block
4. Ensure the screen mesh in Blender is named exactly `"screen"` before export

**Cabinet model conventions:**
- Separate mesh objects: `body`, `bezel`, `marquee`, `control-panel`, `screen`
- Screen UV-mapped to fill 0–1 range
- Mild screen curvature baked into geometry
- Y-up, base at Y=0, total height ~2.2 units
- Export as `.glb`

---

## Adding the HDRI Environment

1. Place `arcade.hdr` in `assets/hdri/`
2. In `src/scene/Environment.js`, uncomment the `#loadHDRI(scene)` call in the constructor and the method body

---

## Project Structure

```
src/
├── main.js                    # entry point
├── emulator/
│   ├── EmulatorBridge.js      # wraps EmulatorJS, hidden canvas
│   └── InputRouter.js         # keyboard/gamepad → emulator
├── scene/
│   ├── SceneManager.js        # renderer, RAF loop, OrbitControls
│   ├── CabinetLoader.js       # placeholder box (GLTF stub included)
│   ├── ScreenMesh.js          # CanvasTexture on screen mesh
│   └── Environment.js         # lights, fog, floor
├── shaders/
│   ├── CRTShader.js           # Three.js ShaderMaterial descriptor
│   └── CRTShader.glsl         # GLSL: barrel, scanlines, vignette, etc.
├── postprocessing/
│   └── PostProcessor.js       # EffectComposer → RenderPass → CRTShaderPass
└── ui/
    ├── ROMLoader.js            # file input overlay
    └── Overlay.js              # loading spinner
```

---

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Directional input |
| Z / X / C | Light / Medium / Heavy Punch |
| A / S / D | Light / Medium / Heavy Kick |
| Enter | Start |
| Shift | Coin / Select |

Gamepad: standard layout (Xbox/DualShock mapping). Gamepad support is stubbed in `InputRouter.js` pending EmulatorJS wiring.
