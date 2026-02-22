varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uScanlineIntensity;
uniform float uBarrelStrength;
uniform float uChromaticAberration;
uniform float uVignetteStrength;
uniform float uBrightness;

vec2 barrelDistort(vec2 uv, float strength) {
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc);
  return uv + cc * dist * strength;
}

vec4 sampleChromatic(sampler2D tex, vec2 uv, float aberration) {
  float r = texture2D(tex, uv + vec2(aberration, 0.0)).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - vec2(aberration, 0.0)).b;
  return vec4(r, g, b, 1.0);
}

void main() {
  vec2 uv = vUv;

  // Barrel distortion
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
  scanline = pow(scanline, 0.5);
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
