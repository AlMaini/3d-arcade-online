import * as THREE from 'three'

/**
 * Environment
 *
 * Sets up lighting, fog, and the floor plane for the arcade scene.
 * HDRI environment map loading is stubbed — place arcade.hdr in assets/hdri/
 * and uncomment the RGBELoader block when the file is available.
 */
export class Environment {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.#addLights(scene)
    this.#addFog(scene)
    this.#addFloor(scene)
    // this.#loadHDRI(scene)  // uncomment when assets/hdri/arcade.hdr is ready
  }

  #addLights(scene) {
    // Very low ambient — dark arcade feel
    const ambient = new THREE.AmbientLight(0x111122, 0.3)
    scene.add(ambient)

    // Main overhead — slightly warm, dim
    const overhead = new THREE.DirectionalLight(0xfff5e0, 0.6)
    overhead.position.set(0, 5, 2)
    overhead.castShadow = false
    scene.add(overhead)

    // Screen glow — simulates CRT light cast into the room
    const screenGlow = new THREE.PointLight(0x3388ff, 0.8, 3)
    screenGlow.position.set(0, 1.1, 1.2)
    scene.add(screenGlow)

    // Neon accent from an imagined sign off to the side
    const neonAccent = new THREE.PointLight(0xff0044, 0.4, 5)
    neonAccent.position.set(-3, 2, 0)
    scene.add(neonAccent)
  }

  #addFog(scene) {
    scene.fog = new THREE.FogExp2(0x000011, 0.12)
  }

  #addFloor(scene) {
    const geometry = new THREE.PlaneGeometry(20, 20)
    const material = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.1,
    })
    const floor = new THREE.Mesh(geometry, material)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    scene.add(floor)
  }

  // #loadHDRI(scene) {
  //   import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
  //   const loader = new RGBELoader()
  //   loader.load('/assets/hdri/arcade.hdr', (texture) => {
  //     texture.mapping = THREE.EquirectangularReflectionMapping
  //     scene.environment = texture
  //     // scene.background = texture  // optional — fog handles background
  //   })
  // }
}
