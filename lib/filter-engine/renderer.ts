import { backgroundCode, fxCode, type BeautyParams, type ColorParams, type EffectParams } from './params'

export interface Point {
  x: number
  y: number
}

/** Face geometry in normalized source-video coordinates (unmirrored, 0..1). */
export interface FaceGeometry {
  leftEye: Point
  rightEye: Point
  center: Point
  leftCheek: Point
  rightCheek: Point
  leftJaw: Point
  rightJaw: Point
  chin: Point
  nose: Point
  mouth: Point
  leftBlush: Point
  rightBlush: Point
  mouthWidth: number
  width: number
}

export interface RenderInput {
  source: TexImageSource & { videoWidth?: number; videoHeight?: number; width?: number; height?: number }
  color: ColorParams
  beauty: BeautyParams
  effects: EffectParams
  mirror: boolean
  face: FaceGeometry | null
  mask: { data: Uint8Array; width: number; height: number } | null
  time: number
}

const vertexShader = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = vec2((aPosition.x + 1.0) * 0.5, 1.0 - (aPosition.y + 1.0) * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVideo;
uniform sampler2D uMask;
uniform vec2 uCropScale;
uniform vec2 uCropOffset;
uniform float uMirror;
uniform vec2 uTexel;
uniform float uAspect;
uniform vec2 uResolution;
uniform float uTime;

uniform float uHasFace;
uniform vec2 uLeftEye;
uniform vec2 uRightEye;
uniform vec2 uFaceCenter;
uniform vec2 uLeftCheek;
uniform vec2 uRightCheek;
uniform vec2 uLeftJaw;
uniform vec2 uRightJaw;
uniform vec2 uChin;
uniform vec2 uNose;
uniform float uFaceWidth;
uniform vec2 uMouth;
uniform vec2 uLeftBlush;
uniform vec2 uRightBlush;
uniform float uMouthWidth;
uniform float uLipstick;
uniform float uBlush;
uniform float uBgMode;
uniform float uFx;
uniform float uFxAmount;
uniform float uClarity;

uniform float uSmooth;
uniform float uWhiten;
uniform float uSlim;
uniform float uEyes;
uniform float uJaw;
uniform float uNoseSlim;
uniform float uHasMask;
uniform float uBgBlur;

uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uVibrance;
uniform float uTemperature;
uniform float uTint;
uniform float uHighlights;
uniform float uShadows;
uniform float uHue;
uniform float uFade;
uniform float uSharpen;
uniform float uVignette;
uniform float uGrain;
uniform float uGlow;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uSplit;

vec2 aspectVec() { return vec2(uAspect, 1.0); }

vec2 bulge(vec2 p, vec2 c, float r, float k) {
  vec2 d = (p - c) * aspectVec();
  float l = length(d);
  if (l < r) {
    float f = 1.0 - k * (1.0 - (l * l) / (r * r));
    return c + (d * f) / aspectVec();
  }
  return p;
}

vec2 pull(vec2 p, vec2 from, vec2 to, float r, float k) {
  vec2 d = (p - from) * aspectVec();
  float l = length(d);
  if (l < r) {
    float w = 1.0 - l / r;
    return p - (to - from) * k * w * w;
  }
  return p;
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float skinMask(vec3 c) {
  float y = luma(c);
  float cb = 0.5 + (-0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b);
  float cr = 0.5 + (0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b);
  float m = smoothstep(0.30, 0.34, cb) * (1.0 - smoothstep(0.50, 0.54, cb));
  m *= smoothstep(0.51, 0.55, cr) * (1.0 - smoothstep(0.68, 0.72, cr));
  return m * smoothstep(0.08, 0.2, y);
}

vec3 tex(vec2 uv) { return texture2D(uVideo, clamp(uv, 0.0, 1.0)).rgb; }

vec3 hueRotate(vec3 c, float a) {
  float angle = a * 6.2831853;
  vec3 k = vec3(0.57735);
  float cosA = cos(angle);
  return c * cosA + cross(k, c) * sin(angle) + k * dot(k, c) * (1.0 - cosA);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

bool isFx(float code) { return abs(uFx - code) < 0.5; }

vec2 toSrc(vec2 uv) {
  vec2 s = uCropOffset + uv * uCropScale;
  if (uMirror > 0.5) s.x = 1.0 - s.x;
  return s;
}

vec2 geometryFx(vec2 uv) {
  float k = uFxAmount;
  float outAspect = uResolution.x / uResolution.y;
  vec2 asp = vec2(outAspect, 1.0);
  if (isFx(8.0)) {
    uv.x = uv.x < 0.5 ? uv.x : 1.0 - uv.x;
  } else if (isFx(9.0)) {
    vec2 p = (uv - 0.5) * asp;
    float r = length(p);
    float seg = 6.2831853 / floor(4.0 + k * 6.0);
    float a = mod(atan(p.y, p.x) + uTime * 0.25, seg);
    a = abs(a - seg * 0.5);
    uv = vec2(cos(a), sin(a)) * r / asp + 0.5;
  } else if (isFx(10.0)) {
    vec2 p = (uv - 0.5) * asp;
    float r = length(p);
    float s = 1.0 - k * 0.55 + k * 0.55 * r * r * 2.2;
    uv = p * s / asp + 0.5;
  } else if (isFx(11.0)) {
    vec2 cells = vec2(outAspect, 1.0) * mix(160.0, 22.0, k);
    uv = (floor(uv * cells) + 0.5) / cells;
  } else if (isFx(4.0)) {
    float t = floor(uTime * 14.0);
    vec2 jitter = (vec2(hash(vec2(t, 1.0)), hash(vec2(t, 2.0))) - 0.5) * 0.035 * k;
    uv = 0.5 + (uv - 0.5) / (1.0 + 0.07 * k) + jitter;
  } else if (isFx(2.0)) {
    float t = floor(uTime * 9.0);
    float slice = floor(uv.y * 28.0);
    if (hash(vec2(slice, t)) > 1.0 - 0.3 * k) uv.x += (hash(vec2(t, slice)) - 0.5) * 0.16 * k;
  }
  return uv;
}

void main() {
  vec2 uv = geometryFx(vUv);
  vec2 src = toSrc(uv);
  vec2 baseSrc = src;
  float person = 1.0;
  if (uHasMask > 0.5) person = smoothstep(0.35, 0.75, texture2D(uMask, baseSrc).r);

  float faceRegion = 1.0;
  if (uHasFace > 0.5) {
    float fw = uFaceWidth;
    src = pull(src, uLeftCheek, uFaceCenter, fw * 0.5, uSlim * 0.16);
    src = pull(src, uRightCheek, uFaceCenter, fw * 0.5, uSlim * 0.16);
    src = pull(src, uLeftJaw, uFaceCenter, fw * 0.4, uJaw * 0.18);
    src = pull(src, uRightJaw, uFaceCenter, fw * 0.4, uJaw * 0.18);
    src = pull(src, uChin, uFaceCenter, fw * 0.3, uJaw * 0.08);
    src = bulge(src, uLeftEye, fw * 0.17, uEyes * 0.32);
    src = bulge(src, uRightEye, fw * 0.17, uEyes * 0.32);
    src = bulge(src, uNose, fw * 0.12, -uNoseSlim * 0.28);
    vec2 fd = (baseSrc - uFaceCenter) * aspectVec() / vec2(fw * 0.62, fw * 0.85);
    faceRegion = 1.0 - smoothstep(0.85, 1.15, length(fd));
  }

  vec3 color = tex(src);

  if (isFx(1.0) || isFx(2.0) || isFx(3.0)) {
    float shift = isFx(1.0) ? 0.012 * uFxAmount : isFx(2.0) ? 0.02 * uFxAmount * step(0.6, hash(vec2(floor(uTime * 9.0), 7.0))) : 0.004 * uFxAmount;
    vec2 off = vec2(shift * uCropScale.x * (uMirror > 0.5 ? -1.0 : 1.0), 0.0);
    color.r = tex(src + off).r;
    color.b = tex(src - off).b;
  }

  if (isFx(5.0)) {
    vec3 sum = color;
    for (int i = 1; i < 12; i++) {
      float f = 1.0 - uFxAmount * 0.14 * float(i) / 11.0;
      sum += tex(toSrc(0.5 + (uv - 0.5) * f));
    }
    color = sum / 12.0;
  }

  if (uHasMask > 0.5 && uBgBlur > 0.001 && abs(uBgMode - 1.0) < 0.5) {
    vec3 blurred = vec3(0.0);
    float radius = 3.0 + 14.0 * uBgBlur;
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 2.39996;
      float r = sqrt(float(i) + 0.5) / 4.0;
      blurred += tex(src + vec2(cos(a), sin(a)) * r * radius * uTexel);
    }
    blurred /= 16.0;
    color = mix(color, blurred, (1.0 - person) * min(1.0, uBgBlur * 1.5));
  }

  if (uSmooth > 0.001) {
    float skin = skinMask(color) * faceRegion;
    if (skin > 0.01) {
      vec3 sum = color;
      float weight = 1.0;
      float radius = max(2.0, uResolution.y / 360.0) * (1.5 + uSmooth * 2.5);
      for (int ring = 1; ring <= 2; ring++) {
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398 + float(ring) * 0.392699;
          vec3 s = tex(src + vec2(cos(a), sin(a)) * radius * float(ring) * uTexel);
          float diff = length(s - color);
          float w = exp(-(diff * diff) / 0.012) / float(ring);
          sum += s * w;
          weight += w;
        }
      }
      color = mix(color, sum / weight, clamp(uSmooth * skin * 0.95, 0.0, 1.0));
    }
  }

  if (uWhiten > 0.001) {
    float skin = skinMask(color) * faceRegion;
    color = mix(color, 1.0 - (1.0 - color) * (1.0 - color * 0.45), uWhiten * skin * 0.6);
  }

  if (uHasFace > 0.5 && uLipstick > 0.001) {
    float cr = 0.5 + (0.5 * color.r - 0.418688 * color.g - 0.081312 * color.b);
    vec2 d = (src - uMouth) * aspectVec() / vec2(uMouthWidth * 0.62, uMouthWidth * 0.32);
    float lips = (1.0 - smoothstep(0.7, 1.05, length(d))) * smoothstep(0.52, 0.57, cr);
    vec3 lipColor = vec3(0.78, 0.1, 0.24);
    vec3 tinted = color * lipColor * 1.7;
    color = mix(color, tinted, clamp(lips * uLipstick * 0.75, 0.0, 1.0));
  }

  if (uHasFace > 0.5 && uBlush > 0.001) {
    float r = uFaceWidth * 0.17;
    float bl = 1.0 - smoothstep(0.0, r, length((src - uLeftBlush) * aspectVec()));
    float br = 1.0 - smoothstep(0.0, r, length((src - uRightBlush) * aspectVec()));
    float blushMask = max(bl, br) * skinMask(color);
    color = mix(color, color * vec3(1.0, 0.8, 0.82) + vec3(0.07, 0.0, 0.03), blushMask * uBlush * 0.65);
  }

  if (uSharpen > 0.001) {
    vec3 n = tex(src + vec2(uTexel.x, 0.0)) + tex(src - vec2(uTexel.x, 0.0)) + tex(src + vec2(0.0, uTexel.y)) + tex(src - vec2(0.0, uTexel.y));
    color += (color - n * 0.25) * uSharpen * 1.4;
  }

  if (uGlow > 0.001 || abs(uClarity) > 0.001) {
    vec3 soft = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      soft += tex(src + vec2(cos(a), sin(a)) * 9.0 * uTexel);
    }
    soft /= 8.0;
    float localLuma = luma(color) - luma(soft);
    color += localLuma * uClarity * 1.6 * (1.0 - smoothstep(0.75, 1.0, luma(color)));
    vec3 bright = max(soft - 0.55, 0.0) * 2.2;
    color = 1.0 - (1.0 - color) * (1.0 - bright * uGlow);
  }

  color *= pow(2.0, uExposure);
  color.r += uTemperature * 0.09 + uTint * 0.03;
  color.b -= uTemperature * 0.09 - uTint * 0.03;
  color.g -= uTint * 0.07;

  float l = luma(color);
  color += uShadows * 0.25 * (1.0 - smoothstep(0.0, 0.5, l));
  color += uHighlights * 0.25 * smoothstep(0.5, 1.0, l);
  color = (color - 0.5) * (1.0 + uContrast) + 0.5;

  l = luma(color);
  color = mix(vec3(l), color, 1.0 + uSaturation);
  float sat = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
  color = mix(vec3(l), color, 1.0 + uVibrance * (1.0 - clamp(sat, 0.0, 1.0)));
  if (abs(uHue) > 0.0001) color = hueRotate(color, uHue);

  l = clamp(luma(color), 0.0, 1.0);
  color += (uShadowTint - 0.5) * uSplit * (1.0 - l) + (uHighlightTint - 0.5) * uSplit * l;
  color = mix(color, vec3(0.1) + color * 0.84, uFade);

  float vd = distance(vUv, vec2(0.5)) * 1.414;
  color *= 1.0 - uVignette * smoothstep(0.35, 1.1, vd);
  color += (hash(vUv * uResolution + uTime) - 0.5) * uGrain * 0.14;

  if (isFx(3.0)) {
    float lv = luma(color);
    color = mix(color, vec3(lv), 0.25 * uFxAmount);
    color *= 0.88 + 0.12 * sin(vUv.y * uResolution.y * 1.6);
    float band = smoothstep(0.0, 0.02, abs(fract(vUv.y - uTime * 0.08) - 0.5) - 0.47);
    color = mix(color + 0.12, color, mix(1.0, band, uFxAmount));
    color += (hash(vec2(floor(vUv.y * 240.0), uTime)) - 0.5) * 0.08 * uFxAmount;
  } else if (isFx(6.0)) {
    vec2 c1 = vec2(0.05 + 0.25 * sin(uTime * 0.6), 0.15);
    vec2 c2 = vec2(0.95, 0.85 + 0.15 * cos(uTime * 0.45));
    vec3 leak = vec3(1.0, 0.42, 0.18) * (1.0 - smoothstep(0.0, 0.75, distance(vUv, c1)));
    leak += vec3(1.0, 0.25, 0.5) * (1.0 - smoothstep(0.0, 0.6, distance(vUv, c2))) * 0.7;
    color = 1.0 - (1.0 - color) * (1.0 - leak * uFxAmount);
  } else if (isFx(7.0)) {
    float lv = clamp(luma(color), 0.0, 1.0);
    vec3 duo = mix(vec3(0.09, 0.11, 0.42), vec3(1.0, 0.56, 0.68), smoothstep(0.05, 0.95, lv));
    color = mix(color, duo, uFxAmount);
  }

  if (uHasMask > 0.5 && uBgBlur > 0.001) {
    float bg = (1.0 - person) * min(1.0, uBgBlur * 1.4);
    if (abs(uBgMode - 2.0) < 0.5) {
      color = mix(color, vec3(luma(color)), bg);
    } else if (abs(uBgMode - 3.0) < 0.5) {
      vec3 backdrop = mix(vec3(0.93, 0.92, 0.95), vec3(0.62, 0.66, 0.78), smoothstep(0.0, 1.0, vUv.y));
      backdrop *= 1.0 - 0.18 * smoothstep(0.3, 0.9, distance(vUv, vec2(0.5, 0.45)));
      color = mix(color, backdrop, bg);
    }
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`

type UniformMap = Record<string, WebGLUniformLocation | null>

export class FilterRenderer {
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private uniforms: UniformMap = {}
  private videoTexture: WebGLTexture
  private maskTexture: WebGLTexture

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false, alpha: false })
    if (!gl) throw new Error('webgl-unsupported')
    this.gl = gl
    this.program = this.createProgram()
    gl.useProgram(this.program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(this.program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    this.videoTexture = this.createTexture(0)
    this.maskTexture = this.createTexture(1)
    gl.uniform1i(this.uniform('uVideo'), 0)
    gl.uniform1i(this.uniform('uMask'), 1)
  }

  private createProgram() {
    const gl = this.gl
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader-error')
      return shader
    }
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link-error')
    return program
  }

  private createTexture(unit: number) {
    const gl = this.gl
    const texture = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([255]))
    return texture
  }

  private uniform(name: string) {
    if (!(name in this.uniforms)) this.uniforms[name] = this.gl.getUniformLocation(this.program, name)
    return this.uniforms[name]
  }

  private set1(name: string, value: number) {
    this.gl.uniform1f(this.uniform(name), value)
  }

  private set2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.uniform(name), x, y)
  }

  render(input: RenderInput) {
    const gl = this.gl
    const sourceWidth = input.source.videoWidth || input.source.width || 0
    const sourceHeight = input.source.videoHeight || input.source.height || 0
    if (!sourceWidth || !sourceHeight) return false

    const { width, height } = this.canvas
    gl.viewport(0, 0, width, height)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input.source)

    const hasMask = Boolean(input.mask && input.effects.background !== 'none' && input.effects.backgroundBlur > 0)
    if (hasMask && input.mask) {
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.maskTexture)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, input.mask.width, input.mask.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, input.mask.data)
    }

    const sourceAspect = sourceWidth / sourceHeight
    const canvasAspect = width / height
    let scaleX = 1
    let scaleY = 1
    if (sourceAspect > canvasAspect) scaleX = canvasAspect / sourceAspect
    else scaleY = sourceAspect / canvasAspect
    this.set2('uCropScale', scaleX, scaleY)
    this.set2('uCropOffset', (1 - scaleX) / 2, (1 - scaleY) / 2)
    this.set1('uMirror', input.mirror ? 1 : 0)
    this.set2('uTexel', 1 / sourceWidth, 1 / sourceHeight)
    this.set1('uAspect', sourceAspect)
    this.set2('uResolution', width, height)
    this.set1('uTime', input.time % 1000)

    const face = input.face
    this.set1('uHasFace', face ? 1 : 0)
    if (face) {
      this.set2('uLeftEye', face.leftEye.x, face.leftEye.y)
      this.set2('uRightEye', face.rightEye.x, face.rightEye.y)
      this.set2('uFaceCenter', face.center.x, face.center.y)
      this.set2('uLeftCheek', face.leftCheek.x, face.leftCheek.y)
      this.set2('uRightCheek', face.rightCheek.x, face.rightCheek.y)
      this.set2('uLeftJaw', face.leftJaw.x, face.leftJaw.y)
      this.set2('uRightJaw', face.rightJaw.x, face.rightJaw.y)
      this.set2('uChin', face.chin.x, face.chin.y)
      this.set2('uNose', face.nose.x, face.nose.y)
      this.set1('uFaceWidth', face.width)
      this.set2('uMouth', face.mouth.x, face.mouth.y)
      this.set2('uLeftBlush', face.leftBlush.x, face.leftBlush.y)
      this.set2('uRightBlush', face.rightBlush.x, face.rightBlush.y)
      this.set1('uMouthWidth', face.mouthWidth)
    }

    const { beauty, color } = input
    this.set1('uSmooth', beauty.smooth)
    this.set1('uWhiten', beauty.whiten)
    this.set1('uSlim', face ? beauty.slim : 0)
    this.set1('uEyes', face ? beauty.eyes : 0)
    this.set1('uJaw', face ? beauty.jaw : 0)
    this.set1('uNoseSlim', face ? beauty.nose : 0)
    this.set1('uHasMask', hasMask ? 1 : 0)
    this.set1('uBgBlur', input.effects.backgroundBlur)
    this.set1('uBgMode', backgroundCode(input.effects.background))
    this.set1('uFx', fxCode(input.effects.fx))
    this.set1('uFxAmount', input.effects.fxAmount)
    this.set1('uLipstick', face ? beauty.lipstick : 0)
    this.set1('uBlush', face ? beauty.blush : 0)
    this.set1('uClarity', color.clarity)

    this.set1('uExposure', color.exposure)
    this.set1('uContrast', color.contrast)
    this.set1('uSaturation', color.saturation)
    this.set1('uVibrance', color.vibrance)
    this.set1('uTemperature', color.temperature)
    this.set1('uTint', color.tint)
    this.set1('uHighlights', color.highlights)
    this.set1('uShadows', color.shadows)
    this.set1('uHue', color.hue)
    this.set1('uFade', Math.max(0, color.fade))
    this.set1('uSharpen', Math.max(0, color.sharpen))
    this.set1('uVignette', Math.max(0, color.vignette))
    this.set1('uGrain', Math.max(0, color.grain))
    this.set1('uGlow', Math.max(0, color.glow))
    gl.uniform3fv(this.uniform('uShadowTint'), color.shadowTint)
    gl.uniform3fv(this.uniform('uHighlightTint'), color.highlightTint)
    this.set1('uSplit', Math.max(0, color.splitAmount))

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return true
  }

  dispose() {
    const gl = this.gl
    gl.deleteTexture(this.videoTexture)
    gl.deleteTexture(this.maskTexture)
    gl.deleteProgram(this.program)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
