import * as THREE from 'three'
import fragmentShader from './CRTShader.glsl?raw'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

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
  vertexShader,
  fragmentShader,
}
