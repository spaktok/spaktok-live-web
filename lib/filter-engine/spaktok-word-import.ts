import {auditStudioGlbBytes,type StudioGlbAudit} from './reality-production-glb-audit'
import {REALITY_HANDOFF_MAX_BYTES} from './reality-local-asset-handoff'
export const WORD_MAX_RESULT_BYTES=35*1024*1024
export type WordGeneratedInspection=Readonly<{
 audit:StudioGlbAudit
 canOpenInAvatar:boolean
 requiresMobileOptimization:boolean
 fileName:string
 size:number
}>
/** Never call generated assets publication-ready. The validator is purely a
 * structural QA gate; it makes no claims about image fidelity, face rig,
 * commercial rights or thermal FPS.
 */
export function inspectWordGeneratedGlb(
 bytes:ArrayBuffer,
 filename='spaktok-word-rodin-result.glb',
):WordGeneratedInspection{
 if(bytes.byteLength<28||bytes.byteLength>WORD_MAX_RESULT_BYTES)
  throw Error('word_generated_glb_out_of_bounds')
 const audit=auditStudioGlbBytes(bytes)
 if(!audit.valid||!audit.selfContained||!audit.triangles)
  throw Error('word_generated_glb_failed_structural_qa')
 return {
  audit,canOpenInAvatar:bytes.byteLength<=REALITY_HANDOFF_MAX_BYTES,
  requiresMobileOptimization:bytes.byteLength>REALITY_HANDOFF_MAX_BYTES||
   audit.triangles>150000||audit.textures>12,
  fileName:filename,size:bytes.byteLength,
 }
}
