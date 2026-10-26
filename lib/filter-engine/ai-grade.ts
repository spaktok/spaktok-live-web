import { z } from 'zod'
import { backgroundModes, filterPresets, fxList, neutralBeauty, neutralColor, neutralFaceFx, type StudioState } from './params'

const unit = z.number().min(-1).max(1)
const positive = z.number().min(0).max(1)

export const gradeSchema = z.object({
  presetId: z.enum(filterPresets.map((preset) => preset.id) as [string, ...string[]]),
  intensity: positive,
  color: z.object({
    exposure: unit,
    contrast: unit,
    saturation: unit,
    vibrance: unit,
    temperature: unit,
    tint: unit,
    highlights: unit,
    shadows: unit,
    clarity: unit,
    sharpen: positive,
  }),
  beauty: z.object({
    smooth: positive,
    whiten: positive,
    slim: positive,
    eyes: positive,
    jaw: positive,
    nose: positive,
    lipstick: positive,
    blush: positive,
  }),
  background: z.enum(backgroundModes),
  backgroundStrength: positive,
  fx: z.enum(fxList),
  fxAmount: positive,
  summary: z.string().max(140),
})

export type Grade = z.infer<typeof gradeSchema>

export const gradeRequestSchema = z.object({
  image: z.string().startsWith('data:image/').max(1_500_000),
  prompt: z.string().max(300).optional(),
  locale: z.string().max(16).optional(),
})

export function gradeToState(grade: Grade): StudioState {
  return {
    presetId: grade.presetId,
    intensity: grade.intensity,
    color: { ...neutralColor, ...grade.color },
    beauty: { ...neutralBeauty, ...grade.beauty },
    face: { ...neutralFaceFx },
    effects: {
      background: grade.backgroundStrength > 0 ? grade.background : 'none',
      backgroundBlur: grade.backgroundStrength,
      fx: grade.fx,
      fxAmount: grade.fx === 'none' ? 0.6 : grade.fxAmount,
    },
  }
}
