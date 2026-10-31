export const FORGE_TEXT_IMAGE_MODEL='openai/gpt-image-2'
export const FORGE_TEXT_PROMPT_MIN=3
export const FORGE_TEXT_PROMPT_MAX=600
export const FORGE_TEXT_IMAGE_MAX_BYTES=4*1024*1024
export const FORGE_TEXT_IMAGE_MIME=['image/png','image/jpeg','image/webp'] as const

export function normalizeForgeTextPrompt(value:unknown):string|null{
 if(typeof value!=='string')return null
 // eslint-disable-next-line no-control-regex
 const clean=value.replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim()
 if(clean.length<FORGE_TEXT_PROMPT_MIN||clean.length>FORGE_TEXT_PROMPT_MAX)return null
 return clean
}

/** TRELLIS.2 conditions on a single image, so the concept image must show one
 * whole object, unoccluded, on a plain background with soft even lighting. */
export function buildForgeConceptPrompt(subject:string):string{
 return [
  'A single 3D-printable game asset concept: '+subject+'.',
  'Exactly one object, fully visible and centered, three-quarter front view,',
  'nothing cropped, no other objects, no text, no watermark, no ground clutter.',
  'Plain seamless light-gray studio background, soft even diffuse lighting,',
  'no harsh shadows, no motion blur, physically plausible materials, high detail.',
 ].join(' ')
}
