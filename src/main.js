import { EmulatorBridge } from './emulator/EmulatorBridge.js'
import { SceneManager } from './scene/SceneManager.js'
import { Overlay } from './ui/Overlay.js'
import { ROMLoader } from './ui/ROMLoader.js'

/**
 * main.js — entry point
 *
 * Boot order:
 *   1. Create EmulatorBridge (sets up hidden canvas in DOM)
 *   2. Create SceneManager (creates renderer, attaches to #app)
 *   3. Init scene assets (cabinet, environment, screen mesh)
 *   4. Show ROM upload overlay
 *   5. After ROM loads → start RAF loop
 */
async function main() {
  const emulatorBridge = new EmulatorBridge('emulator-container')

  const container = document.getElementById('app')
  const sceneManager = new SceneManager(container, emulatorBridge)

  // Init scene assets in parallel with UI rendering
  await sceneManager.init()

  const overlay = new Overlay()

  new ROMLoader(overlay.element, emulatorBridge, overlay, () => {
    sceneManager.start()
  })
}

main().catch((err) => {
  console.error('[main] Fatal error during boot:', err)
})
