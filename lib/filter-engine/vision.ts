import type { FaceLandmarker, ImageSegmenter, HandLandmarker } from '@mediapipe/tasks-vision'
import type { FaceGeometry, Point } from './renderer'

const WASM_BASE = 'https://spaktok-face-assets.spaktok.workers.dev/wasm'
const WASM_BACKUP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const FACE_MODEL = 'https://spaktok-face-assets.spaktok.workers.dev/face_landmarker.task'
const SEGMENTER_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'
/** Publicly versioned official model. Camera pixels remain on-device. The
 * model bundle is fetched by browser once, not user content uploaded. */
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

let filesetPromise: Promise<Awaited<ReturnType<typeof import('@mediapipe/tasks-vision').FilesetResolver.forVisionTasks>>> | null = null
let facePromise: Promise<FaceLandmarker> | null = null
let forcedCpu = false
let extraFace3DEnabled=false
let segmenterPromise: Promise<ImageSegmenter> | null = null
let handPromise: Promise<HandLandmarker> | null = null

async function loadFileset() {
  if (!filesetPromise) {
    filesetPromise = import('@mediapipe/tasks-vision').then(({ FilesetResolver }) => FilesetResolver.forVisionTasks(WASM_BASE).catch(() => FilesetResolver.forVisionTasks(WASM_BACKUP)))
    filesetPromise.catch(() => {
      filesetPromise = null
    })
  }
  return filesetPromise
}

async function withGpuFallback<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>) {
  try {
    return await create('GPU')
  } catch {
    return create('CPU')
  }
}

export function loadFaceLandmarker() {
  if (!facePromise) {
    facePromise = (async () => {
      const [{ FaceLandmarker }, fileset] = await Promise.all([import('@mediapipe/tasks-vision'), loadFileset()])
      const create = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes:extraFace3DEnabled,
          outputFacialTransformationMatrixes:extraFace3DEnabled,
          minFaceDetectionConfidence: 0.45,
          minFacePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        })
      return forcedCpu ? create('CPU') : withGpuFallback(create)
    })()
    facePromise.catch(() => {
      facePromise = null
    })
  }
  return facePromise
}

/** MediaPipe may initialize GPU successfully then throw at runtime on some
 * mobile WebGL drivers. Retry exactly once with the CPU delegate. */
export async function recoverFaceLandmarkerOnCpu(): Promise<FaceLandmarker | null> {
  if (forcedCpu) return null
  forcedCpu = true
  const previous = facePromise
  facePromise = null
  // Ensure the old model does not compete with the new inference backend.
  try { (await previous)?.close() } catch {}
  return loadFaceLandmarker()
}

export async function configureFace3DExtras(enabled:boolean){
 if(extraFace3DEnabled===enabled)return
 const model=await loadFaceLandmarker()
 await model.setOptions({outputFaceBlendshapes:enabled,outputFacialTransformationMatrixes:enabled})
 extraFace3DEnabled=enabled
}
/** Lazy model load; NEVER run hand ML unless creator opted into interaction QA.
 * GPU first with CPU fallback; no camera/hand landmarks leave the browser.
 */
export function loadHandLandmarker():Promise<HandLandmarker>{
 if(!handPromise){
  handPromise=(async()=>{
   const [{HandLandmarker},fileset]=await Promise.all([
    import('@mediapipe/tasks-vision'),loadFileset(),
   ])
   return withGpuFallback(delegate=>HandLandmarker.createFromOptions(fileset,{
    baseOptions:{modelAssetPath:HAND_MODEL,delegate},
    runningMode:'VIDEO',numHands:2,
    minHandDetectionConfidence:.55,
    minHandPresenceConfidence:.55,
    minTrackingConfidence:.5,
   }))
  })()
  handPromise.catch(()=>{handPromise=null})
 }
 return handPromise
}
export function loadSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const [{ ImageSegmenter }, fileset] = await Promise.all([import('@mediapipe/tasks-vision'), loadFileset()])
      return withGpuFallback((delegate) =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        }),
      )
    })()
    segmenterPromise.catch(() => {
      segmenterPromise = null
    })
  }
  return segmenterPromise
}

type Landmark = { x: number; y: number }

const avg = (a: Landmark, b: Landmark): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const pt = (l: Landmark): Point => ({ x: l.x, y: l.y })

/** Converts the 478-point MediaPipe face mesh into the anchors used by the reshape shader. */
export function toFaceGeometry(landmarks: Landmark[], aspect: number): FaceGeometry {
  const leftCheek = pt(landmarks[234])
  const rightCheek = pt(landmarks[454])
  const dx = (rightCheek.x - leftCheek.x) * aspect
  const dy = rightCheek.y - leftCheek.y
  return {
    leftEye: avg(landmarks[33], landmarks[133]),
    rightEye: avg(landmarks[362], landmarks[263]),
    center: { x: (leftCheek.x + rightCheek.x) / 2, y: landmarks[1].y },
    leftCheek,
    rightCheek,
    leftJaw: pt(landmarks[172]),
    rightJaw: pt(landmarks[397]),
    chin: pt(landmarks[152]),
    nose: pt(landmarks[4]),
    mouth: avg(landmarks[13], landmarks[14]),
    leftBlush: pt(landmarks[205]),
    rightBlush: pt(landmarks[425]),
    mouthWidth: Math.hypot((landmarks[291].x - landmarks[61].x) * aspect, landmarks[291].y - landmarks[61].y),
    width: Math.hypot(dx, dy),
    expression: {
      mouthOpen: Math.min(1,Math.max(0,(
        Math.hypot((landmarks[13].x-landmarks[14].x)*aspect,landmarks[13].y-landmarks[14].y)/
        Math.max(0.01, Math.hypot((landmarks[61].x-landmarks[291].x)*aspect,landmarks[61].y-landmarks[291].y))
        -0.045)*3.5)),
      leftEyeOpen: Math.min(1,Math.max(0,
        Math.hypot((landmarks[159].x-landmarks[145].x)*aspect,landmarks[159].y-landmarks[145].y)/
        Math.max(0.01,Math.hypot((landmarks[33].x-landmarks[133].x)*aspect,landmarks[33].y-landmarks[133].y)) / 0.23)),
      rightEyeOpen: Math.min(1,Math.max(0,
        Math.hypot((landmarks[386].x-landmarks[374].x)*aspect,landmarks[386].y-landmarks[374].y)/
        Math.max(0.01,Math.hypot((landmarks[362].x-landmarks[263].x)*aspect,landmarks[362].y-landmarks[263].y)) / 0.23)),
    },
  }
}

const lerpPoint = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Temporal smoothing removes landmark jitter so reshaping stays locked to the face. */
export function smoothFace(previous: FaceGeometry | null, next: FaceGeometry, t = 0.55): FaceGeometry {
  if (!previous) return next
  const out = { ...next }
  for (const key of Object.keys(next) as (keyof FaceGeometry)[]) {
    if (key === 'expression') {
      if(previous.expression && next.expression) out.expression={
        mouthOpen:previous.expression.mouthOpen*(1-t)+next.expression.mouthOpen*t,
        leftEyeOpen:previous.expression.leftEyeOpen*(1-t)+next.expression.leftEyeOpen*t,
        rightEyeOpen:previous.expression.rightEyeOpen*(1-t)+next.expression.rightEyeOpen*t,
      }
    }
    else if (key === 'width' || key === 'mouthWidth') out[key] = previous[key] + (next[key] - previous[key]) * t
    else out[key] = lerpPoint(previous[key] as Point, next[key] as Point, t) as never
  }
  return out
}
