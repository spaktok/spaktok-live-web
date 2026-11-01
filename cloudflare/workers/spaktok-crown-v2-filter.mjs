// Owner-only, in-app Spaktok Live/Story draft lens for Royal Crown V2.
// Source: exact owner-approved, source-locked GLB in PRIVATE Cloudflare R2.
// This is a development preview only, NOT a public filter or a broadcast URL.
const OBJECT='studio/private/filters/crown/royal-crown-01/v2-source-locked/master.glb';
const SHA='ee5ec583041a9e2b55e31f718e42670ba5526d2cccfa249b549dece4ad81f129';
const BYTES=3324548;
const DOMAIN='spaktok-crown-v2-owner-filter-v1';
const PATH='/v1/crown-v2/draft.glb';
const deny=(status=404)=>new Response(JSON.stringify({error:'not_found'}),{
 status,headers:{'content-type':'application/json','cache-control':'private,no-store',
 'x-content-type-options':'nosniff'}});
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function originAllowed(origin,env){
 const configured=env.SPAKTOK_WEB_ORIGIN;
 return typeof configured==='string'&&/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(configured)
  &&origin===configured&&!configured.includes('..');
}
const cors=o=>({'access-control-allow-origin':o,'access-control-allow-methods':'GET, OPTIONS',
 'access-control-allow-headers':'X-Spaktok-Crown-User,X-Spaktok-Crown-Expires,X-Spaktok-Crown-Signature',
 'access-control-max-age':'60','vary':'Origin'});
async function authorized(req,origin,env){
 const user=req.headers.get('x-spaktok-crown-user')||'';
 const exp=req.headers.get('x-spaktok-crown-expires')||'';
 const sig=req.headers.get('x-spaktok-crown-signature')||'';
 if(!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(user)
    ||!/^[0-9]{10}$/.test(exp)||!/^[A-Za-z0-9_-]{86}$/.test(sig))return false;
 const now=Math.floor(Date.now()/1000);
 if(Number(exp)<now||Number(exp)>now+90)return false;
 const payload=[DOMAIN,'GET',user,'crown-v2',exp,origin].join('\n');
 try{
  const key=await crypto.subtle.importKey('spki',b64(env.SPAKTOK_CROWN_V2_ED25519_PUBLIC_KEY),{name:'Ed25519'},false,['verify']);
  const base64=sig.replace(/-/g,'+').replace(/_/g,'/')+'==';
  return await crypto.subtle.verify('Ed25519',key,b64(base64),
   new TextEncoder().encode(payload));
 }catch{return false}
}
export default {async fetch(req,env){
 const url=new URL(req.url);
 if(url.pathname!==PATH||url.search||url.hash)return deny();
 const origin=req.headers.get('origin')||'';
 if(!originAllowed(origin,env))return deny(403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='GET'||!await authorized(req,origin,env))return deny(401);
 if(!env.STUDIO_ASSETS)return deny(503);
 try{
  const file=await env.STUDIO_ASSETS.get(OBJECT);
  if(!file||file.size!==BYTES||file.customMetadata?.sha256!==SHA)return deny(503);
  const buffer=await file.arrayBuffer();
  if(buffer.byteLength!==BYTES)return deny(503);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)))
   .map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==SHA)return deny(503);
  return new Response(buffer,{status:200,headers:{...cors(origin),
   'content-type':'model/gltf-binary','content-length':String(BYTES),
   'cache-control':'private,no-store','x-content-type-options':'nosniff',
   'cross-origin-resource-policy':'cross-origin',
   'content-disposition':'attachment; filename="spaktok-royal-crown-v2-draft.glb"'}});
 }catch{return deny(503)}
}};
