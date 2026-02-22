import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { CRTShader } from '../shaders/CRTShader.js'

/**
 * PostProcessor
 *
 * Sets up EffectComposer with a single CRT uber-shader pass.
 *
 * Pass chain:
 *   RenderPass (full scene) → ShaderPass(CRTShader) → output
 *
 * The CRT shader runs on the full composer output (not just the screen quad),
 * which gives a subtle barrel and vignette effect over the whole scene.
 * This is intentional for v1 atmosphere — see design doc for v2 screen-only path.
 */
export class PostProcessor {
  /** @type {EffectComposer} */
  composer

  /** @type {ShaderPass} */
  crtPass

  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    this.crtPass = new ShaderPass(CRTShader)
    this.crtPass.uniforms.uResolution.value.set(
      renderer.domElement.width,
      renderer.domElement.height
    )
    this.composer.addPass(this.crtPass)
  }

  /**
   * Call on window resize.
   * @param {number} width
   * @param {number} height
   */
  setSize(width, height) {
    this.composer.setSize(width, height)
    this.crtPass.uniforms.uResolution.value.set(width, height)
  }
}
