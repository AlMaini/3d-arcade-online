import * as THREE from 'three'

/**
 * CabinetLoader
 *
 * PLACEHOLDER MODE: Builds a BoxGeometry standing cabinet with the front face
 * (-Z face) identified as "screen" for ScreenMesh to apply the emulator texture.
 *
 * TO SWAP IN THE REAL GLTF CABINET:
 *   1. Place cabinet.glb in /assets/cabinet/
 *   2. Uncomment the GLTFLoader block below
 *   3. Delete the placeholder BoxGeometry block
 *   4. Ensure the screen mesh in Blender is named exactly "screen"
 *   5. Ensure cabinet base sits at Y=0 in Blender coordinate space
 *
 * GLTF model conventions (for artist reference):
 *   - Separate meshes: body, bezel, marquee, control panel, screen
 *   - Screen mesh UV-mapped to fill 0–1 range
 *   - Mild screen curvature baked into geometry (not flat plane)
 *   - Export as .glb, Draco compression optional
 *   - Y-up coordinate system, total height ~2.2 units
 */
export class CabinetLoader {
  /** @type {THREE.Mesh} */
  screenNode = null

  /**
   * @param {THREE.Scene} scene
   * @returns {Promise<void>}
   */
  async load(scene) {
    return this.#loadPlaceholder(scene)

    // GLTF path — uncomment when cabinet.glb is ready:
    // return this.#loadGLTF(scene)
  }

  #loadPlaceholder(scene) {
    // Cabinet body — 0.8w × 1.6h × 0.5d, base at Y=0
    const cabinetGroup = new THREE.Group()
    cabinetGroup.name = 'cabinet'

    // Body (everything except screen face)
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.6, 0.5)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.8,
      metalness: 0.0,
    })

    // Use per-face materials so the front face can be the screen
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d1a,
      roughness: 0.3,
      metalness: 0.1,
    })

    // Six-face array: +X, -X, +Y, -Y, +Z, -Z
    // Index 4 = +Z (back), Index 5 = -Z (front/screen face)
    const materials = [
      bodyMat,   // +X right
      bodyMat,   // -X left
      bodyMat,   // +Y top
      bodyMat,   // -Y bottom
      bodyMat,   // +Z back
      bezelMat,  // -Z front — this is the "screen face"
    ]

    const cabinetMesh = new THREE.Mesh(bodyGeo, materials)
    cabinetMesh.name = 'cabinet-body'
    cabinetMesh.position.y = 0.8  // center at Y=0.8 so base sits at Y=0
    cabinetGroup.add(cabinetMesh)

    // Screen plane — positioned flush with front face of cabinet box
    // Slightly inset from the bezel face
    const screenGeo = new THREE.PlaneGeometry(0.6, 0.5)
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const screenMesh = new THREE.Mesh(screenGeo, screenMat)
    screenMesh.name = 'screen'
    screenMesh.position.set(0, 0.9, 0.251)  // front face z=0.25, nudge +0.001 to avoid z-fight
    cabinetGroup.add(screenMesh)

    this.screenNode = screenMesh

    scene.add(cabinetGroup)
    return Promise.resolve()
  }

  // async #loadGLTF(scene) {
  //   const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
  //   const loader = new GLTFLoader()
  //
  //   return new Promise((resolve, reject) => {
  //     loader.load('/assets/cabinet/cabinet.glb', (gltf) => {
  //       const cabinet = gltf.scene
  //
  //       cabinet.traverse((node) => {
  //         if (!node.isMesh) return
  //
  //         node.material.envMapIntensity = 0.4
  //         node.castShadow = true
  //         node.receiveShadow = true
  //
  //         if (node.name === 'screen') {
  //           this.screenNode = node
  //           return  // ScreenMesh will configure the material
  //         }
  //         if (node.name.includes('bezel')) {
  //           node.material.roughness = 0.3
  //           node.material.metalness = 0.1
  //         }
  //         if (node.name.includes('body')) {
  //           node.material.roughness = 0.8
  //           node.material.metalness = 0.0
  //         }
  //       })
  //
  //       scene.add(cabinet)
  //       resolve()
  //     }, undefined, reject)
  //   })
  // }
}
