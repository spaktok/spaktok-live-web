import { drawCoverFrame } from './face-overlay'

/** One deterministic composition contract for photo, recording and live video.
 * The camera GPU shader and Three.js AR may have different WebGL contexts for
 * mobile compatibility; output composition still uses the same source order.
 */
export interface RealityCompositeFrame {
  target: HTMLCanvasElement | null
  video: HTMLVideoElement
  filtered: HTMLCanvasElement | null
  overlay: HTMLCanvasElement | null
  face3d: HTMLCanvasElement | null
  mirror: boolean
  showEffects: boolean
  effectOpacity: number
}

const clamp01 = (n: number) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0

export function composeRealityFrame(frame: RealityCompositeFrame): boolean {
  const { target, video, filtered, overlay, face3d, mirror, showEffects, effectOpacity } = frame
  if (!target || target.width <= 0 || target.height <= 0) return false
  const ctx = target.getContext('2d', { alpha: false })
  if (!ctx) return false

  ctx.save()
  try {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    // FilterRenderer has already applied cover-crop and selfie mirroring to
    // its output. Do not flip/crop it a second time during capture.
    if (filtered && filtered.width > 0 && filtered.height > 0) {
      ctx.drawImage(filtered, 0, 0, target.width, target.height)
    } else if (!drawCoverFrame(ctx, video, target.width, target.height, mirror)) {
      return false
    }

    if (showEffects) {
      // 2D face mask is already intensity-correct inside its own drawing pass.
      if (overlay) ctx.drawImage(overlay, 0, 0, target.width, target.height)
      // Preserve the opacity seen in the interactive AR preview.
      if (face3d && effectOpacity > 0) {
        ctx.globalAlpha = clamp01(effectOpacity)
        ctx.drawImage(face3d, 0, 0, target.width, target.height)
        ctx.globalAlpha = 1
      }
    }
    return true
  } finally {
    ctx.restore()
  }
}
