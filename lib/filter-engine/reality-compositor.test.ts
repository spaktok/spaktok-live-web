import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drawCoverFrame } from './face-overlay'
import { composeRealityFrame } from './reality-compositor'

vi.mock('./face-overlay', () => ({ drawCoverFrame: vi.fn(() => true) }))

const makeFixture = () => {
  const calls: Array<{ source: unknown; opacity: number }> = []
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(function (this: { globalAlpha: number }, source: unknown) {
      calls.push({ source, opacity: this.globalAlpha })
    }),
  } as unknown as CanvasRenderingContext2D
  const target = {
    width: 540,
    height: 960,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  const video = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement
  const filtered = { width: 540, height: 960 } as HTMLCanvasElement
  const overlay = { width: 540, height: 960 } as HTMLCanvasElement
  const face3d = { width: 540, height: 960 } as HTMLCanvasElement
  return { calls, ctx, target, video, filtered, overlay, face3d }
}

describe('Reality composition parity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records the graded camera BEFORE face masks and 3D geometry', () => {
    const f = makeFixture()
    const ok = composeRealityFrame({
      target: f.target, video: f.video, filtered: f.filtered,
      overlay: f.overlay, face3d: f.face3d, mirror: true,
      showEffects: true, effectOpacity: .45,
    })
    expect(ok).toBe(true)
    expect(f.calls.map(x => x.source)).toEqual([f.filtered, f.overlay, f.face3d])
    expect(f.calls.map(x => x.opacity)).toEqual([1, 1, .45])
    expect(drawCoverFrame).not.toHaveBeenCalled()
    expect(f.ctx.restore).toHaveBeenCalledOnce()
  })

  it('shows only the unmodified or neutralized camera during comparison', () => {
    const f = makeFixture()
    composeRealityFrame({
      target: f.target, video: f.video, filtered: f.filtered,
      overlay: f.overlay, face3d: f.face3d, mirror: false,
      showEffects: false, effectOpacity: 1,
    })
    expect(f.calls.map(x => x.source)).toEqual([f.filtered])
  })

  it('falls back to the native video when WebGL is unavailable', () => {
    const f = makeFixture()
    expect(composeRealityFrame({
      target: f.target, video: f.video, filtered: null,
      overlay: f.overlay, face3d: null, mirror: true,
      showEffects: true, effectOpacity: 1,
    })).toBe(true)
    expect(drawCoverFrame).toHaveBeenCalledWith(f.ctx, f.video, 540, 960, true)
    expect(f.calls.map(x => x.source)).toEqual([f.overlay])
  })

  it('rejects a missing capture surface without attempting GPU readback', () => {
    const f = makeFixture()
    expect(composeRealityFrame({
      target: null, video: f.video, filtered: f.filtered,
      overlay: f.overlay, face3d: f.face3d, mirror: true,
      showEffects: true, effectOpacity: 1,
    })).toBe(false)
  })
})
