import type {FaceMorphSettings} from './reality-face-morph'

export interface ColorParams {
  exposure: number
  contrast: number
  saturation: number
  vibrance: number
  temperature: number
  tint: number
  highlights: number
  shadows: number
  hue: number
  fade: number
  sharpen: number
  clarity: number
  vignette: number
  grain: number
  glow: number
  shadowTint: [number, number, number]
  highlightTint: [number, number, number]
  splitAmount: number
}


export interface BeautyParams {
  smooth: number
  whiten: number
  slim: number
  eyes: number
  jaw: number
  nose: number
  lipstick: number
  blush: number
}

/** Shader codes follow array order — append only, never reorder. */
export const fxList = ['none', 'rgb-split', 'glitch', 'vhs', 'shake', 'zoom-blur', 'light-leak', 'duotone', 'mirror', 'kaleido', 'fisheye', 'pixel'] as const
export type FxId = (typeof fxList)[number]

export const backgroundModes = ['none', 'blur', 'splash', 'studio'] as const
export type BackgroundMode = (typeof backgroundModes)[number]

export interface EffectParams {
  background: BackgroundMode
  /** Strength of the background effect (0..1). Named for backwards compatibility. */
  backgroundBlur: number
  fx: FxId
  fxAmount: number
}

export const neutralEffects: EffectParams = { background: 'none', backgroundBlur: 0, fx: 'none', fxAmount: 0.6 }

export const fxCode = (fx: FxId) => Math.max(0, fxList.indexOf(fx))
export const backgroundCode = (mode: BackgroundMode) => Math.max(0, backgroundModes.indexOf(mode))

export function needsSegmentation(effects: EffectParams) {
  return effects.background !== 'none' && effects.backgroundBlur > 0
}


/** Original SpakTok face-attached AR, rendered into the captured WebGL canvas. */
export const faceFxCatalog = [
  { id: 'none', name: 'بدون قناع', icon: '🙂', group: 'all' },
  { id: 'neon-glasses', name: 'نظارات نيون', icon: '👓', group: 'fashion' },
  { id: 'midnight-shades', name: 'نظارات داكنة', icon: '🕶️', group: 'fashion' },
  { id: 'cat-ears', name: 'قطة لطيفة', icon: '🐱', group: 'fun' },
  { id: 'puppy', name: 'كلب صغير', icon: '🐶', group: 'fun' },
  { id: 'royal-crown', name: 'تاج ملكي', icon: '👑', group: 'fantasy' },
  { id: 'butterfly', name: 'فراشة', icon: '🦋', group: 'fantasy' },
  { id: 'cyber-visor', name: 'سايبر', icon: '🤖', group: 'fashion' },
  { id: 'heart-cheeks', name: 'قلوب', icon: '💗', group: 'fun' },
  { id: 'robot', name: 'روبوت', icon: '⚙️', group: 'fantasy' },
  { id: 'festival', name: 'احتفال', icon: '🎉', group: 'fun' },
  { id: 'bunny-ears', name: 'أرنب لطيف', icon: '🐰', group: 'animal' },
  { id: 'fox-mask', name: 'ثعلب', icon: '🦊', group: 'animal' },
  { id: 'panda', name: 'باندا', icon: '🐼', group: 'animal' },
  { id: 'tiger', name: 'نمر', icon: '🐯', group: 'animal' },
  { id: 'deer-antlers', name: 'قرون غزال', icon: '🦌', group: 'animal' },
  { id: 'devil-horns', name: 'قرون شيطان', icon: '😈', group: 'fantasy' },
  { id: 'angel-halo', name: 'هالة ملاك', icon: '😇', group: 'fantasy' },
  { id: 'elf-ears', name: 'أذنا قزم', icon: '🧝', group: 'fantasy' },
  { id: 'wizard-hat', name: 'قبعة ساحر', icon: '🧙', group: 'fantasy' },
  { id: 'cowboy-hat', name: 'قبعة رعاة', icon: '🤠', group: 'fashion' },
  { id: 'graduation-cap', name: 'قبعة تخرّج', icon: '🎓', group: 'fashion' },
  { id: 'pirate-patch', name: 'عين قرصان', icon: '🏴‍☠️', group: 'fashion' },
  { id: 'star-glasses', name: 'نظارات نجوم', icon: '🌟', group: 'fashion' },
  { id: 'pixel-shades', name: 'نظارات بكسل', icon: '👾', group: 'fashion' },
  { id: 'monocle', name: 'عدسة أنيقة', icon: '🧐', group: 'fashion' },
  { id: 'hero-mask', name: 'قناع بطل', icon: '🦸', group: 'fantasy' },
  { id: 'ice-crown', name: 'تاج جليدي', icon: '❄️', group: 'fantasy' },
  { id: 'rainbow-cheeks', name: 'خدود قوس قزح', icon: '🌈', group: 'fun' },
  { id: 'starry-eyes', name: 'عيون نجوم', icon: '⭐', group: 'reactive' },
  { id: 'comic-tears', name: 'دموع كرتونية', icon: '😭', group: 'reactive' },
  { id: 'sparkle-burst', name: 'لمعان متحرك', icon: '✨', group: 'reactive' },
  { id: 'confetti-rain', name: 'قصاصات احتفال', icon: '🎊', group: 'reactive' },
  { id: 'mouth-hearts', name: 'قلوب الفم', icon: '💞', group: 'reactive' },
  { id: 'magic-moustache', name: 'شارب سحري', icon: '🥸', group: 'reactive' },
  { id: 'bubble-mouth', name: 'فقاعات الكلام', icon: '🫧', group: 'reactive' },
  { id: 'sleepy-eyes', name: 'عيون ناعسة', icon: '😴', group: 'reactive' },
  { id: 'alien', name: 'كائن فضائي', icon: '👽', group: 'fantasy' },
  { id: 'space-helmet', name: 'خوذة فضاء', icon: '🧑‍🚀', group: 'fantasy' },
  { id: 'clown-nose', name: 'أنف مهرج', icon: '🤡', group: 'fun' },
  { id: 'lightning-bolt', name: 'برق الوجه', icon: '⚡', group: 'fun' },
  { id: '3d-lux-glasses', name: 'نظارات ثلاثية', icon: '🥽', group: '3d' },
  { id: '3d-gold-crown', name: 'تاج ثلاثي', icon: '👑', group: '3d' },
  { id: '3d-space-visor', name: 'خوذة فضاء', icon: '🪐', group: '3d' },
  { id: '3d-metal-cap', name: 'قبعة معدنية', icon: '🧢', group: '3d' },
  { id: '3d-crystal', name: 'جوهرة ثلاثية', icon: '💎', group: '3d' },
  { id: '3d-expression', name: 'قناع التعبيرات', icon: '🎭', group: '3d' },
  { id: '3d-photo-face', name: 'وجه GLB محلي متحرك', icon: '🧑', group: '3d' },

  { id: '3d-makeup-soft', name: 'مكياج ناعم', icon: '🌷', group: 'makeup' },
  { id: '3d-makeup-glam', name: 'مكياج سهرة', icon: '💄', group: 'makeup' },
  { id: '3d-makeup-bridal', name: 'إطلالة عروس', icon: '👰', group: 'makeup' },
  { id: '3d-makeup-smoky', name: 'عيون دخانية', icon: '🖤', group: 'makeup' },
  { id: '3d-makeup-rose', name: 'وردي مخملي', icon: '🌹', group: 'makeup' },
  { id: '3d-makeup-neon', name: 'نيون فني', icon: '🪩', group: 'makeup' },
  { id: '3d-makeup-golden', name: 'توهج ذهبي', icon: '✨', group: 'makeup' },
  { id: '3d-makeup-editorial', name: 'مكياج فني', icon: '🎨', group: 'makeup' },
  { id: 'face-morph', name: 'نحت الوجه الحي', icon: '✨', group: 'beauty' },
] as const
export type FaceFxId = (typeof faceFxCatalog)[number]['id']
export const faceFxCode = (id: FaceFxId) => Math.max(0, faceFxCatalog.findIndex(x=>x.id===id))
export type MakeupRegion = 'foundation'|'lips'|'eyeshadow'|'eyeliner'|'blush'|'contour'|'highlight'
export type MakeupOverrides = Partial<Record<MakeupRegion,number>>
export type FaceFxParams = { id: FaceFxId; strength: number; makeup?:MakeupOverrides; morph?: Partial<FaceMorphSettings> }
export const neutralFaceFx: FaceFxParams = { id: 'none', strength: 0.85 }
export const isFace3DSelected = (id:FaceFxId) => id.startsWith('3d-')
export const needsFaceFxTracking = (face: FaceFxParams) => face.id !== 'none' && face.strength > 0

export interface StudioState {
  presetId: string
  intensity: number
  color: ColorParams
  beauty: BeautyParams
  effects: EffectParams
  face: FaceFxParams
}

export const neutralColor: ColorParams = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  hue: 0,
  fade: 0,
  sharpen: 0,
  clarity: 0,
  vignette: 0,
  grain: 0,
  glow: 0,
  shadowTint: [0.5, 0.5, 0.5],
  highlightTint: [0.5, 0.5, 0.5],
  splitAmount: 0,
}

export const neutralBeauty: BeautyParams = { smooth: 0, whiten: 0, slim: 0, eyes: 0, jaw: 0, nose: 0, lipstick: 0, blush: 0 }
export const naturalBeauty: BeautyParams = { smooth: 0.35, whiten: 0.15, slim: 0.15, eyes: 0.15, jaw: 0.1, nose: 0.05, lipstick: 0, blush: 0 }

export type PresetCategory = 'trending' | 'portrait' | 'film' | 'vibe' | 'scene' | 'mono'
export const presetCategories: PresetCategory[] = ['trending', 'portrait', 'film', 'vibe', 'scene', 'mono']

export interface FilterPreset {
  id: string
  name: string
  category: PresetCategory
  color: Partial<ColorParams>
  swatch: string
}

const rgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

export const filterPresets: FilterPreset[] = [
  { id: 'original', name: 'Original', category: 'trending', color: {}, swatch: '#9aa3b2' },
  { id: 'clear', name: 'Clear', category: 'trending', color: { exposure: 0.08, contrast: 0.12, vibrance: 0.25, sharpen: 0.35, highlights: -0.15, shadows: 0.15 }, swatch: '#7fc7ff' },
  { id: 'glow-up', name: 'Glow Up', category: 'trending', color: { exposure: 0.12, contrast: -0.05, vibrance: 0.2, temperature: 0.08, glow: 0.35, fade: 0.05 }, swatch: '#ffc6a8' },
  { id: 'hk-night', name: 'HK Night', category: 'trending', color: { contrast: 0.2, saturation: 0.15, temperature: -0.25, tint: 0.12, shadowTint: rgb('#1f4dff'), highlightTint: rgb('#ff4fa0'), splitAmount: 0.35, vignette: 0.3, glow: 0.2 }, swatch: '#5b4dff' },
  { id: 'teal-orange', name: 'Teal & Orange', category: 'trending', color: { contrast: 0.18, saturation: 0.1, shadowTint: rgb('#0f6f7a'), highlightTint: rgb('#ffa25c'), splitAmount: 0.45, vignette: 0.15 }, swatch: '#1f9aa3' },
  { id: 'porcelain', name: 'Porcelain', category: 'portrait', color: { exposure: 0.15, contrast: 0.08, saturation: -0.12, temperature: -0.05, tint: 0.05, highlights: -0.2, glow: 0.3 }, swatch: '#f4dfe6' },
  { id: 'peach', name: 'Peach', category: 'portrait', color: { exposure: 0.08, temperature: 0.18, tint: 0.08, vibrance: 0.15, fade: 0.06, highlightTint: rgb('#ffc2a1'), splitAmount: 0.2 }, swatch: '#ffb38f' },
  { id: 'soft-skin', name: 'Soft', category: 'portrait', color: { exposure: 0.1, contrast: -0.1, saturation: -0.05, fade: 0.1, glow: 0.2 }, swatch: '#e9d6cc' },
  { id: 'cool-tone', name: 'Cool', category: 'portrait', color: { temperature: -0.22, tint: -0.03, contrast: 0.06, exposure: 0.05 }, swatch: '#9cc4ff' },
  { id: 'kodak', name: 'Kodak 200', category: 'film', color: { contrast: 0.1, temperature: 0.15, saturation: 0.05, fade: 0.12, grain: 0.3, shadowTint: rgb('#3a5a40'), highlightTint: rgb('#ffd39a'), splitAmount: 0.25 }, swatch: '#e8b46a' },
  { id: 'fuji', name: 'Fuji 400', category: 'film', color: { contrast: 0.08, temperature: -0.06, tint: -0.08, saturation: -0.05, fade: 0.1, grain: 0.25, shadowTint: rgb('#1e5a5a'), splitAmount: 0.25 }, swatch: '#6fa58f' },
  { id: 'retro', name: 'Retro', category: 'film', color: { contrast: -0.08, saturation: -0.2, temperature: 0.2, fade: 0.25, grain: 0.4, vignette: 0.35 }, swatch: '#c49a6c' },
  { id: 'cinema', name: 'Cinema', category: 'film', color: { contrast: 0.25, saturation: -0.1, highlights: -0.25, shadows: -0.05, shadowTint: rgb('#123a4a'), highlightTint: rgb('#f0b37e'), splitAmount: 0.35, vignette: 0.4 }, swatch: '#3e6273' },
  { id: 'neon-pop', name: 'Neon Pop', category: 'vibe', color: { contrast: 0.25, saturation: 0.45, hue: 0.04, glow: 0.4, shadowTint: rgb('#3a1cff'), highlightTint: rgb('#ff2fd0'), splitAmount: 0.3 }, swatch: '#b026ff' },
  { id: 'cyber', name: 'Cyber', category: 'vibe', color: { contrast: 0.3, saturation: 0.2, temperature: -0.35, tint: 0.2, glow: 0.3, vignette: 0.25 }, swatch: '#00d4ff' },
  { id: 'sunset', name: 'Sunset', category: 'vibe', color: { temperature: 0.3, tint: 0.12, saturation: 0.2, highlightTint: rgb('#ff7a59'), splitAmount: 0.3, glow: 0.2 }, swatch: '#ff7a59' },
  { id: 'dream', name: 'Dream', category: 'vibe', color: { exposure: 0.12, contrast: -0.12, fade: 0.15, glow: 0.5, tint: 0.1, highlightTint: rgb('#d9c2ff'), splitAmount: 0.3 }, swatch: '#c9b8ff' },
  { id: 'food', name: 'Food', category: 'scene', color: { exposure: 0.06, contrast: 0.12, vibrance: 0.35, temperature: 0.12, clarity: 0.3, sharpen: 0.25 }, swatch: '#ff9f43' },
  { id: 'landscape', name: 'Landscape', category: 'scene', color: { contrast: 0.15, vibrance: 0.4, highlights: -0.3, shadows: 0.2, clarity: 0.45, temperature: -0.04 }, swatch: '#2ecc71' },
  { id: 'golden-hour', name: 'Golden Hour', category: 'scene', color: { exposure: 0.05, temperature: 0.35, tint: 0.06, vibrance: 0.2, glow: 0.3, highlightTint: rgb('#ffcc70'), splitAmount: 0.3 }, swatch: '#ffc048' },
  { id: 'night-boost', name: 'Night', category: 'scene', color: { exposure: 0.3, shadows: 0.4, highlights: -0.25, contrast: 0.08, clarity: 0.2, temperature: -0.1, sharpen: 0.2 }, swatch: '#34495e' },
  { id: 'sky', name: 'Blue Sky', category: 'scene', color: { contrast: 0.1, vibrance: 0.3, temperature: -0.15, highlights: -0.35, clarity: 0.25 }, swatch: '#48dbfb' },
  { id: 'mono', name: 'Mono', category: 'mono', color: { saturation: -1, contrast: 0.12 }, swatch: '#8a8a8a' },
  { id: 'noir', name: 'Noir', category: 'mono', color: { saturation: -1, contrast: 0.45, exposure: -0.05, vignette: 0.5, grain: 0.2 }, swatch: '#2b2b2b' },
  { id: 'silver', name: 'Silver', category: 'mono', color: { saturation: -1, contrast: -0.05, exposure: 0.1, fade: 0.15, glow: 0.2 }, swatch: '#c9c9c9' },
  // Original SpakTok looks — parameter presets, not CapCut assets or cloned filters.
  { id: 'aurora', name: 'Aurora', category: 'trending', color: { contrast: 0.12, vibrance: 0.26, tint: 0.14, temperature: -0.12, shadowTint: rgb('#243f8e'), highlightTint: rgb('#cb90fc'), splitAmount: 0.36, glow: 0.2 }, swatch: '#8b91f5' },
  { id: 'crystal', name: 'Crystal', category: 'trending', color: { exposure: 0.07, sharpen: 0.35, clarity: 0.27, highlights: -0.19, shadows: 0.2, vibrance: 0.13 }, swatch: '#8bccf0' },
  { id: 'rose-hour', name: 'Rose Hour', category: 'portrait', color: { temperature: 0.17, tint: 0.15, exposure: 0.1, contrast: -0.1, glow: 0.28, highlightTint: rgb('#ffb9ca'), splitAmount: 0.25 }, swatch: '#f1a3bd' },
  { id: 'editorial', name: 'Editorial', category: 'portrait', color: { contrast: 0.17, saturation: -0.14, sharpen: 0.27, shadows: 0.09, fade: 0.04, vignette: 0.14 }, swatch: '#bdc2cf' },
  { id: 'analog-90', name: 'Analog 90', category: 'film', color: { temperature: 0.19, saturation: -0.08, contrast: -0.12, grain: 0.34, fade: 0.29, vignette: 0.22 }, swatch: '#ad896e' },
  { id: 'indie-night', name: 'Indie Night', category: 'film', color: { exposure: -0.08, contrast: 0.2, temperature: -0.12, tint: 0.08, grain: 0.28, shadowTint: rgb('#142c68'), highlightTint: rgb('#d88a78'), splitAmount: 0.38 }, swatch: '#555c8c' },
  { id: 'silver-screen', name: 'Silver Screen', category: 'film', color: { saturation: -0.62, contrast: 0.27, vignette: 0.32, grain: 0.15, highlights: -0.1 }, swatch: '#949bac' },
  { id: 'electric', name: 'Electric', category: 'vibe', color: { contrast: 0.24, vibrance: 0.53, temperature: -0.17, tint: 0.2, shadowTint: rgb('#151cf2'), highlightTint: rgb('#ff58da'), splitAmount: 0.49, glow: 0.33 }, swatch: '#8557ed' },
  { id: 'mint-cool', name: 'Mint Cool', category: 'vibe', color: { contrast: 0.09, saturation: 0.14, temperature: -0.3, tint: -0.18, shadowTint: rgb('#125c59'), highlightTint: rgb('#b0f4e9'), splitAmount: 0.3 }, swatch: '#70cdb8' },
  { id: 'dreamwave', name: 'Dreamwave', category: 'vibe', color: { exposure: 0.05, contrast: -0.15, saturation: 0.09, glow: 0.48, fade: 0.2, tint: 0.16 }, swatch: '#a5a1ec' },
  { id: 'streetlight', name: 'Streetlight', category: 'scene', color: { exposure: 0.2, shadows: 0.31, highlights: -0.24, contrast: 0.16, clarity: 0.18, temperature: -0.09, vignette: 0.23 }, swatch: '#435c93' },
  { id: 'coffee', name: 'Coffee', category: 'scene', color: { temperature: 0.33, exposure: 0.08, vibrance: 0.13, contrast: 0.15, vignette: 0.12, shadowTint: rgb('#583d2d'), splitAmount: 0.13 }, swatch: '#b27e48' },
  { id: 'ocean-air', name: 'Ocean Air', category: 'scene', color: { temperature: -0.21, vibrance: 0.25, contrast: 0.08, highlights: -0.3, shadows: 0.16, clarity: 0.33 }, swatch: '#3f9bc5' },
  { id: 'ink', name: 'Ink', category: 'mono', color: { saturation: -1, contrast: 0.65, shadows: -0.2, highlights: -0.15, vignette: 0.45 }, swatch: '#343841' },
  { id: 'soft-paper', name: 'Soft Paper', category: 'mono', color: { saturation: -1, contrast: -0.14, exposure: 0.22, fade: 0.31, grain: 0.16 }, swatch: '#c5c1b9' },
]

export function getPreset(id: string): FilterPreset {
  return filterPresets.find((preset) => preset.id === id) ?? filterPresets[0]
}

export function createStudioState(presetId = 'original'): StudioState {
  return { presetId, intensity: 1, color: { ...neutralColor }, beauty: { ...neutralBeauty }, effects: { ...neutralEffects }, face: { ...neutralFaceFx } }
}

/** Preset is applied at `intensity`, then user adjustments are added on top. */
export function resolveColor(state: StudioState): ColorParams {
  const preset = getPreset(state.presetId).color
  const k = state.intensity
  const out = { ...neutralColor }
  for (const key of Object.keys(neutralColor) as (keyof ColorParams)[]) {
    if (key === 'shadowTint' || key === 'highlightTint') {
      out[key] = (preset[key] as [number, number, number] | undefined) ?? state.color[key]
      continue
    }
    if (key === 'splitAmount') {
      out.splitAmount = (preset.splitAmount ?? 0) * k + state.color.splitAmount
      continue
    }
    out[key] = ((preset[key] as number | undefined) ?? 0) * k + (state.color[key] as number)
  }
  return out
}

export const colorSliders: { key: Exclude<keyof ColorParams, 'shadowTint' | 'highlightTint' | 'splitAmount'>; min: number; max: number }[] = [
  { key: 'exposure', min: -1, max: 1 },
  { key: 'contrast', min: -1, max: 1 },
  { key: 'saturation', min: -1, max: 1 },
  { key: 'vibrance', min: -1, max: 1 },
  { key: 'temperature', min: -1, max: 1 },
  { key: 'tint', min: -1, max: 1 },
  { key: 'highlights', min: -1, max: 1 },
  { key: 'shadows', min: -1, max: 1 },
  { key: 'hue', min: -0.5, max: 0.5 },
  { key: 'fade', min: 0, max: 1 },
  { key: 'clarity', min: -1, max: 1 },
  { key: 'sharpen', min: 0, max: 1 },
  { key: 'glow', min: 0, max: 1 },
  { key: 'vignette', min: 0, max: 1 },
  { key: 'grain', min: 0, max: 1 },
]

export const beautySliders: (keyof BeautyParams)[] = ['smooth', 'whiten', 'slim', 'eyes', 'jaw', 'nose', 'lipstick', 'blush']

/** Face geometry is only needed for warps and makeup; skin smoothing works without tracking. */
export function needsFaceTracking(beauty: BeautyParams) {
  return beauty.slim > 0 || beauty.eyes > 0 || beauty.jaw > 0 || beauty.nose > 0 || beauty.lipstick > 0 || beauty.blush > 0
}
