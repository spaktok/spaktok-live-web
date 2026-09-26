// GPU-accelerated camera filters.
// Each filter is expressed as a CSS/Canvas `filter` string so it can be applied
// live to the <video> element (composited on the GPU) and then burned into the
// captured frame with the exact same string via canvas `ctx.filter`, giving a
// pixel-identical, client-side flattened result with zero server load.

export type CameraFilterCategory = 'all' | 'face' | 'neon' | 'mood' | 'classic'

export interface CameraFilter {
  id: string
  nameAr: string
  category: Exclude<CameraFilterCategory, 'all'>
  /** CSS/Canvas filter string. Empty string means no processing. */
  css: string
  /** Optional color overlay burned on top of the frame after the filter. */
  overlay?: { color: string; blend: GlobalCompositeOperation; alpha: number }
  /** Neon strobe/flash: pulsing light bursts rendered live around and over the frame. */
  flash?: boolean
  /** Glossy "plastic skin" sheen highlight burned over the frame (radial white). */
  sheen?: boolean
}

export const cameraFilters: CameraFilter[] = [
  { id: 'none', nameAr: 'بدون', category: 'classic', css: '' },
  { id: 'clarendon', nameAr: 'كلارندون', category: 'classic', css: 'contrast(1.2) saturate(1.35) brightness(1.05)' },
  { id: 'gingham', nameAr: 'قنغهام', category: 'classic', css: 'sepia(0.15) contrast(0.9) brightness(1.08)' },
  { id: 'mono', nameAr: 'أحادي', category: 'classic', css: 'grayscale(1) contrast(1.1)' },
  { id: 'noir', nameAr: 'نوار', category: 'classic', css: 'grayscale(1) contrast(1.5) brightness(0.9)' },
  {
    id: 'aden',
    nameAr: 'عدن',
    category: 'mood',
    css: 'sepia(0.2) brightness(1.15) saturate(1.4) hue-rotate(-20deg)',
    overlay: { color: '#ff9a76', blend: 'soft-light', alpha: 0.2 },
  },
  {
    id: 'cyberpunk',
    nameAr: 'سايبر',
    category: 'neon',
    css: 'contrast(1.3) saturate(1.6) hue-rotate(190deg) brightness(1.05)',
    overlay: { color: '#00d4ff', blend: 'screen', alpha: 0.18 },
  },
  {
    id: 'sunset',
    nameAr: 'غروب',
    category: 'mood',
    css: 'saturate(1.4) brightness(1.05) contrast(1.05)',
    overlay: { color: '#ff006e', blend: 'soft-light', alpha: 0.25 },
  },
  { id: 'vintage', nameAr: 'كلاسيكي', category: 'classic', css: 'sepia(0.45) contrast(1.1) brightness(1.05) saturate(1.2)' },
  { id: 'chill', nameAr: 'هدوء', category: 'mood', css: 'saturate(0.85) brightness(1.08) contrast(0.95) hue-rotate(10deg)' },
  {
    id: 'dream',
    nameAr: 'حلم',
    category: 'face',
    css: 'blur(0.4px) brightness(1.12) saturate(1.25) contrast(0.95)',
    overlay: { color: '#a855f7', blend: 'soft-light', alpha: 0.2 },
  },
  {
    id: 'iridescent',
    nameAr: 'إيريديسنت',
    category: 'face',
    css: 'brightness(1.08) contrast(1.08) saturate(1.5) hue-rotate(12deg)',
    overlay: { color: '#86f7ff', blend: 'soft-light', alpha: 0.18 },
  },
  {
    id: 'porcelain',
    nameAr: 'بورسلان',
    category: 'face',
    // Strong "plastic skin": blur softens pores, high brightness/contrast gives the
    // glossy figurine look, slight desaturation keeps it porcelain rather than orange.
    css: 'blur(1.1px) brightness(1.2) contrast(1.32) saturate(0.92)',
    overlay: { color: '#ffe3ef', blend: 'soft-light', alpha: 0.28 },
    sheen: true,
  },
  {
    id: 'glass-doll',
    nameAr: 'دمية زجاجية',
    category: 'face',
    // Even glossier variant tuned toward the reference: cool porcelain + iridescent sheen.
    css: 'blur(1.4px) brightness(1.24) contrast(1.4) saturate(1.05) hue-rotate(-6deg)',
    overlay: { color: '#c9b8ff', blend: 'screen', alpha: 0.2 },
    sheen: true,
  },
  {
    id: 'hologlow',
    nameAr: 'هولوغلو',
    category: 'face',
    css: 'brightness(1.05) contrast(1.18) saturate(1.7) hue-rotate(28deg)',
    overlay: { color: '#b7a2ff', blend: 'screen', alpha: 0.22 },
  },
  {
    id: 'neon-frame',
    nameAr: 'إطار نيون',
    category: 'neon',
    css: 'contrast(1.16) saturate(1.45) brightness(0.94)',
    overlay: { color: '#3224ff', blend: 'screen', alpha: 0.2 },
  },
  {
    id: 'ultraviolet',
    nameAr: 'فوق بنفسجي',
    category: 'neon',
    css: 'contrast(1.25) saturate(1.8) hue-rotate(265deg) brightness(1.04)',
    overlay: { color: '#8c4dff', blend: 'screen', alpha: 0.24 },
  },
  {
    id: 'electric-blue',
    nameAr: 'أزرق كهربائي',
    category: 'neon',
    css: 'contrast(1.22) saturate(1.55) hue-rotate(180deg) brightness(1.06)',
    overlay: { color: '#3155ff', blend: 'screen', alpha: 0.2 },
  },
]


export function getFilterById(id: string | null): CameraFilter {
  if (!id) return cameraFilters[0]
  return cameraFilters.find((f) => f.id === id) ?? cameraFilters[0]
}

/**
 * Flattens a single video frame into a filtered JPEG data URL entirely on the
 * client. The chosen filter is burned in via canvas `ctx.filter`, mirroring the
 * spec's "Client-Side Canvas Flattening" requirement.
 */
export function captureFilteredFrame(
  video: HTMLVideoElement,
  filter: CameraFilter,
  mirror: boolean,
): string | null {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.save()
  if (mirror) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }
  if (filter.css) ctx.filter = filter.css
  ctx.drawImage(video, 0, 0, width, height)
  ctx.restore()

  if (filter.overlay) {
    ctx.save()
    ctx.globalCompositeOperation = filter.overlay.blend
    ctx.globalAlpha = filter.overlay.alpha
    ctx.fillStyle = filter.overlay.color
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}
