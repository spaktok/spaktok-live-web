import type { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision'
import type { FaceGeometry, Point } from './renderer'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const SEGMENTER_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

let filesetPromise: Promise<Awaited<ReturnType<typeof import('@mediapipe/tasks-vision').FilesetResolver.forVisionTasks>>> | null = null
let facePromise: Promise<FaceLandmarker> | null = null
let segmenterPromise: Promise<ImageSegmenter> | null = null

async function loadFileset() {
  if (!filesetPromise) {
    filesetPromise = import('@mediapipe/tasks-vision').then(({ FilesetResolver }) => FilesetResolver.forVisionTasks(WASM_BASE))
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
      return withGpuFallback((delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }),
      )
    })()
    facePromise.catch(() => {
      facePromise = null
    })
  }
  return facePromise
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
    width: Math.hypot(dx, dy),
  }
}

const lerpPoint = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Temporal smoothing removes landmark jitter so reshaping stays locked to the face. */
export function smoothFace(previous: FaceGeometry | null, next: FaceGeometry, t = 0.55): FaceGeometry {
  if (!previous) return next
  const out = { ...next }
  for (const key of Object.keys(next) as (keyof FaceGeometry)[]) {
    if (key === 'width') out.width = previous.width + (next.width - previous.width) * t
    else out[key] = lerpPoint(previous[key] as Point, next[key] as Point, t) as never
  }
  return out
}
