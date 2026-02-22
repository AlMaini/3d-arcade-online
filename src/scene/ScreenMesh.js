import * as THREE from 'three'

/**
 * ScreenMesh
 *
 * Attaches the emulator canvas as a live CanvasTexture onto the cabinet's
 * screen mesh node. Uses MeshBasicMaterial so the screen is self-illuminated
 * and unaffected by scene lighting (correct for a CRT).
 *
 * Call texture.needsUpdate = true each frame from SceneManager to stream
 * the latest emulator frame to the GPU.
 */
export class ScreenMesh {
  /** @type {THREE.CanvasTexture} */
  texture

  /**
   * @param {THREE.Mesh} screenNode — the mesh whose material will be replaced
   * @param {HTMLCanvasElement} emulatorCanvas — the emulator's output canvas
   */
  constructor(screenNode, emulatorCanvas) {
    const texture = new THREE.CanvasTexture(emulatorCanvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.colorSpace = THREE.SRGBColorSpace

    screenNode.material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,  // CRITICAL: don't apply scene tone mapping — CRT shader handles it
    })

    this.texture = texture
  }
}
