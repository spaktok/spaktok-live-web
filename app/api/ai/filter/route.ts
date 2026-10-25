import { generateText, Output } from 'ai'
import { filterPresets, fxList } from '@/lib/filter-engine/params'
import { gradeRequestSchema, gradeSchema } from '@/lib/filter-engine/ai-grade'

export const maxDuration = 30

const presetGuide = filterPresets.map((preset) => `${preset.id} (${preset.category})`).join(', ')

export async function POST(request: Request) {
  const parsed = gradeRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid-request' }, { status: 400 })
  const { image, prompt, locale } = parsed.data

  try {
    const { output } = await generateText({
      model: 'google/gemini-3-flash',
      output: Output.object({ schema: gradeSchema }),
      system: `You are a professional colorist, beauty retoucher and effects editor for a short-video app (like CapCut / TikTok).
Analyze the camera frame: lighting, white balance, exposure problems, skin tones, scene type, and whether a person is present.
Return corrections that make the shot look professionally graded while keeping skin natural and realistic.
Rules:
- color values are ADDITIVE corrections on top of the preset (0 = no change). Fix real problems: underexposed -> raise exposure/shadows, blown highlights -> lower highlights, color cast -> counter with temperature/tint. clarity adds local contrast (landscapes, food); keep it <= 0 for faces.
- beauty values must be subtle (usually 0.1-0.45) and 0 for all when no face is visible. lipstick and blush are makeup — only use them when the user asks for makeup or a glam look.
- background: "blur" (bokeh), "splash" (background turns black & white, person stays in color), "studio" (clean backdrop), or "none". Only when a person is the clear subject. backgroundStrength 0 when background is "none".
- fx: a creative camera effect (${fxList.join(', ')}). Use "none" unless the user asks for an effect, a retro/VHS/glitch/party vibe, etc.
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
