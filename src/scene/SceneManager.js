import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CabinetLoader } from './CabinetLoader.js'
import { ScreenMesh } from './ScreenMesh.js'
import { Environment } from './Environment.js'
import { PostProcessor } from '../postprocessing/PostProcessor.js'
import { InputRouter } from '../emulator/InputRouter.js'

/**
 * SceneManager
 *
 * Central coordinator. Owns the WebGLRenderer, Three.js scene/camera, and
 * the single master RAF loop.
 *
 * Master RAF loop order:
 *   1. inputRouter.poll() — gamepad state
 *   2. texture.needsUpdate — stream latest emulator frame to GPU
 *   3. uTime update — drive CRT flicker uniform
 *   4. postProcessor.composer.render() — draw everything
 */
export class SceneManager {
  /** @type {THREE.WebGLRenderer} */
  renderer

  /** @type {THREE.Scene} */
  scene

  /** @type {THREE.PerspectiveCamera} */
  camera

  /** @type {THREE.Clock} */
  #clock

  /** @type {OrbitControls} */
  #controls

  /** @type {PostProcessor} */
  #postProcessor

  /** @type {InputRouter} */
  #inputRouter

  /** @type {ScreenMesh | null} */
  #screenMesh = null

  /** @type {import('../emulator/EmulatorBridge.js').EmulatorBridge} */
  #emulatorBridge

  /** @type {number | null} */
  #rafId = null

  /**
   * @param {HTMLElement} container — the #app div
   * @param {import('../emulator/EmulatorBridge.js').EmulatorBridge} emulatorBridge
   */
  constructor(container, emulatorBridge) {
    this.#emulatorBridge = emulatorBridge
    this.#clock = new THREE.Clock()

    this.#initRenderer(container)
    this.#initScene()
    this.#initCamera()
    this.#initControls()

    this.#postProcessor = new PostProcessor(this.renderer, this.scene, this.camera)
    this.#inputRouter = new InputRouter(emulatorBridge, this.renderer.domElement)

    window.addEventListener('resize', this.#onResize)
  }

  /**
   * Load all scene assets, then start the RAF loop.
   * @returns {Promise<void>}
   */
  async init() {
    const cabinetLoader = new CabinetLoader()
    await cabinetLoader.load(this.scene)

    new Environment(this.scene)

    this.#screenMesh = new ScreenMesh(
      cabinetLoader.screenNode,
      this.#emulatorBridge.outputCanvas
    )
  }

  start() {
    if (this.#rafId !== null) return
    this.#clock.start()
    this.#tick()
  }

  stop() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId)
      this.#rafId = null
    }
  }

  #initRenderer(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.8
    container.appendChild(this.renderer.domElement)
  }

  #initScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000011)
  }

  #initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    )
    this.camera.position.set(0, 1.2, 3.5)
    this.camera.lookAt(0, 1.0, 0)
  }

  #initControls() {
    this.#controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.#controls.enableDamping = true
    this.#controls.dampingFactor = 0.05
    this.#controls.target.set(0, 1.0, 0)
    this.#controls.minPolarAngle = 0.2           // don't go above cabinet
    this.#controls.maxPolarAngle = Math.PI / 2   // don't go below floor
    this.#controls.minDistance = 1.0
    this.#controls.maxDistance = 8.0
  }

  #tick = () => {
    this.#rafId = requestAnimationFrame(this.#tick)

    // 1. Poll gamepad input
    this.#inputRouter.poll()

    // 2. Stream latest emulator frame to GPU
    if (this.#emulatorBridge.isReady && this.#screenMesh) {
      // Swap texture source to the live EJS canvas if it changed (happens once after game start)
      const ejsCanvas = this.#emulatorBridge.outputCanvas
      if (this.#screenMesh.texture.image !== ejsCanvas) {
        this.#screenMesh.texture.image = ejsCanvas
        console.log('[SceneManager] texture source swapped to EJS canvas', ejsCanvas.width, 'x', ejsCanvas.height)
      }
      this.#screenMesh.texture.needsUpdate = true
    }

    // 3. Update CRT time uniform
    const elapsed = this.#clock.getElapsedTime()
    this.#postProcessor.crtPass.uniforms.uTime.value = elapsed

    // 4. Update orbit controls (needed for damping)
    this.#controls.update()

    // 5. Render via EffectComposer
    this.#postProcessor.composer.render()
  }

  #onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight

    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(w, h)
    this.#postProcessor.setSize(w, h)
  }
}
