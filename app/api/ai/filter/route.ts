import { generateText, Output } from 'ai'
import { z } from 'zod'
import { filterPresets } from '@/lib/filter-engine/params'

export const maxDuration = 30

const unit = z.number().min(-1).max(1)
const positive = z.number().min(0).max(1)

const gradeSchema = z.object({
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
    sharpen: positive,
  }),
  beauty: z.object({ smooth: positive, whiten: positive, slim: positive, eyes: positive, jaw: positive, nose: positive }),
  backgroundBlur: positive,
  summary: z.string().max(140),
})

const requestSchema = z.object({
  image: z.string().startsWith('data:image/').max(1_500_000),
  prompt: z.string().max(300).optional(),
  locale: z.string().max(16).optional(),
})

const presetGuide = filterPresets.map((preset) => `${preset.id} (${preset.category})`).join(', ')

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid-request' }, { status: 400 })
  const { image, prompt, locale } = parsed.data

  try {
    const { output } = await generateText({
      model: 'google/gemini-3-flash',
      output: Output.object({ schema: gradeSchema }),
      system: `You are a professional colorist and beauty retoucher for a short-video app (like CapCut / TikTok).
Analyze the camera frame: lighting, white balance, exposure problems, skin tones, scene type, and whether a person is present.
Return corrections that make the shot look professionally graded while keeping skin natural and realistic.
Rules:
- color values are ADDITIVE corrections on top of the preset (0 = no change). Fix real problems: underexposed -> raise exposure/shadows, blown highlights -> lower highlights, color cast -> counter with temperature/tint.
- beauty values must be subtle (usually 0.1-0.45) and 0 for all when no face is visible.
- backgroundBlur > 0 only when a person is the clear subject and the background is busy.
- choose the presetId that best matches the scene or the user's request. Available presets: ${presetGuide}.
- summary: one short sentence describing what you changed, written in the language with code "${locale || 'en'}".`,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt ? `User request: ${prompt}` : 'Auto-enhance this shot.' },
            { type: 'image', image },
          ],
        },
      ],
    })
    return Response.json(output)
  } catch (error) {
    console.error('[ai-filter]', error)
    return Response.json({ error: 'ai-unavailable' }, { status: 502 })
  }
}
