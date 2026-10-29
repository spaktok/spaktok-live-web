/** Public, non-sensitive GPU readiness contract shared by Studio and the API.
 * The rental is ephemeral; its URL must never be treated as a permanent backend.
 * Model licensing/access is explicitly attested by the operator (not inferred
 * from a repository being visible). Statuses never expose credentials.
 */
export type ForgeGpuReadiness='disabled'|'awaiting-model-access'|
 'model-access-unverified'|'provider-offline'|'ready'
export type ForgeModelAccess='approved'|'pending'|'unknown'
export function parseForgeModelAccess(value:string|undefined):ForgeModelAccess{
 return value==='approved'||value==='pending'?value:'unknown'
}
export function forgeGpuReadiness(input:Readonly<{
 enabled:boolean
 modelAccess:ForgeModelAccess
 online:boolean
}>):ForgeGpuReadiness{
 if(input.modelAccess==='pending')return 'awaiting-model-access'
 if(!input.enabled)return 'disabled'
 if(input.modelAccess!=='approved')return 'model-access-unverified'
 return input.online?'ready':'provider-offline'
}
export const FORGE_GPU_READINESS_AR:Readonly<Record<ForgeGpuReadiness,string>>={
 'disabled':'محرك GPU غير مفعّل. يمكنك إنشاء مجسم 2.5D محلي أو استيراد GLB.',
 'awaiting-model-access':'بانتظار موافقة مزوّد النموذج على صلاحية الوصول. لا تُشغّل GPU مدفوعًا خلال الانتظار.',
 'model-access-unverified':'لم يؤكد مشغّل Spaktok حقوق الوصول والترخيص؛ التوليد المدفوع معطّل.',
 'provider-offline':'الخادم GPU متوقف أو غير متصل حاليًا. ملفات GLB المحلية ما زالت قابلة للاستخدام.',
 'ready':'خادم توليد المجسمات جاهز بعد التحقق من الاتصال والتوقيع.',
}
