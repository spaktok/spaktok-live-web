// Spaktok: restricted DINOv3 gated-checkpoint bridge.
//
// One fixed Meta model, exact allowlisted files. No public links to weights.
// The owner configures a scoped Hugging Face read token as a Cloudflare secret.
// The token never reaches Vast.ai or GitHub; the GPU uses its existing paired
// device bearer and an expiring D1 grant to download 8 MiB ranges.
//
// This Worker is NOT a model inference endpoint or a remote shell.
const MODEL='facebook/dinov3-vitl16-pretrain-lvd1689m';
const MAX_CHUNK=8*1024*1024;
const FILES=Object.freeze({
 'config.json':745,
 'preprocessor_config.json':585,
 'model.safetensors':1212559808,
 'LICENSE.md':7503,
});
const DEVICE=/^[a-f0-9]{32}$/;
const RET={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const j=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...RET,'content-type':'application/json'}});
const now=()=>Math.floor(Date.now()/1000);
const sha=async t=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const safeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
async function device(req,env){
 const id=req.headers.get('x-vast-device-id')||'';
 const auth=req.headers.get('authorization')||'';
 if(!DEVICE.test(id)||!/^Bearer [A-Za-z0-9_-]{48,160}$/.test(auth))return null;
 const record=await env.VAST_DB.prepare("SELECT device_id,token_sha256,state FROM vast_agent_devices WHERE device_id=?").bind(id).first();
 if(record?.state!=='approved'||!safeEqual(record.token_sha256,await sha(auth.slice(7))))return null;
 return record.device_id;
}
const permitted=async(env,id)=>{
 const grant=await env.VAST_DB.prepare("SELECT 1 AS ok FROM vast_model_grants WHERE device_id=? AND model_id=? AND enabled=1 AND expires_at>?").bind(id,MODEL,now()).first();
 return grant?.ok===1;
};
function strictRange(text,size){
 if(typeof text!=='string')return null;
 const match=text.match(/^bytes=(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/);
 if(!match)return null;
 const start=Number(match[1]),end=Number(match[2]);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||
     end<start||end>=size||end-start+1>MAX_CHUNK)return null;
 return {start,end,size};
}
const trustedRedirect=(loc)=>{
 try{
  const u=new URL(loc);
  return u.protocol==='https:'&&
   (u.hostname==='huggingface.co'||u.hostname.endsWith('.xethub.hf.co')||
   u.hostname.endsWith('.hf.co')||u.hostname.endsWith('.huggingface.co'));
 }catch{return false;}
};
async function fetchBounded(filename,range,secret){
 const source=new URL('https://huggingface.co/'+MODEL+'/resolve/main/'+encodeURIComponent(filename));
 let upstream=await fetch(source.toString(),{
  headers:{authorization:'Bearer '+secret,range:'bytes='+range.start+'-'+range.end,'accept-encoding':'identity'},
  redirect:'manual',cache:'no-store'
 });
 // HF LFS/Xet returns a signed CDN redirect. Follow once without forwarding
 // the Hugging Face bearer to a different host.
 for(let i=0;i<3&&[301,302,303,307,308].includes(upstream.status);i++){
  const raw=upstream.headers.get('location');
  if(!raw||!trustedRedirect(raw))return {error:'untrusted_checkpoint_redirect',status:502};
  const finalUrl=new URL(raw);
  upstream=await fetch(finalUrl.toString(),{
   headers:{range:'bytes='+range.start+'-'+range.end,'accept-encoding':'identity'},
   redirect:'manual',cache:'no-store'
  });
 }
 if(upstream.status===401||upstream.status===403)return {error:'huggingface_access_denied',status:424};
 if(upstream.status!==206)return {error:'checkpoint_range_unavailable',status:502};
 const parsed=(upstream.headers.get('content-range')||'').match(/^bytes (\d+)-(\d+)\/(\d+)$/);
 const received=Number(upstream.headers.get('content-length')||0);
 if(!parsed||Number(parsed[1])!==range.start||Number(parsed[2])!==range.end||
    Number(parsed[3])!==range.size||received!==range.end-range.start+1||
    received>MAX_CHUNK||!upstream.body)return {error:'checkpoint_range_mismatch',status:502};
 return {body:upstream.body,contentRange:upstream.headers.get('content-range'),length:received};
}
export default {async fetch(req,env){
 try{
  const url=new URL(req.url);
  if(url.pathname==='/health'&&req.method==='GET')
   return j({name:'spaktok-dinov3-bridge',publicModels:false});
  if(!env.VAST_DB)return j({error:'d1_not_configured'},503);
  const id=await device(req,env);
  if(!id)return j({error:'unauthorized'},401);
  if(req.method!=='GET')return j({error:'method_not_allowed'},405);
  const allowed=await permitted(env,id);
  if(url.pathname==='/v1/agent/dinov3/status')
   return j({paired:true,granted:allowed,tokenConfigured:!!env.HF_DINOV3_READ_TOKEN,model:MODEL});
  if(!allowed)return j({error:'model_grant_missing_or_expired'},403);
  if(!env.HF_DINOV3_READ_TOKEN)return j({error:'model_token_not_configured'},503);
  const match=url.pathname.match(/^\/v1\/agent\/dinov3\/file\/(config\.json|preprocessor_config\.json|model\.safetensors|LICENSE\.md)$/);
  if(!match||url.search)return j({error:'unknown_checkpoint_file'},404);
  const name=match[1],size=FILES[name];
  const range=strictRange(req.headers.get('range'),size);
  if(!range)return j({error:'bounded_range_required'},416);
  const result=await fetchBounded(name,range,env.HF_DINOV3_READ_TOKEN);
  if(result.error)return j({error:result.error},result.status);
  return new Response(result.body,{status:206,headers:{...RET,'content-type':'application/octet-stream',
   'accept-ranges':'bytes','content-range':result.contentRange,
   'content-length':String(result.length)}});
 }catch{return j({error:'model_bridge_internal_error'},500);}
}};
