// Spaktok PRIVATE first GPU GLB pilot — read-only R2 binding.
// Deploy only with a private R2 binding named STUDIO_ASSETS to
// the existing spaktok-private-drafts bucket, and SPAKTOK_WEB_ORIGIN
// set to the exact reviewed HTTPS Spaktok web origin.
// GET requires a short-lived ED25519 signature produced by the
// authenticated, operator-only Next.js ticket route. No public key URL.
// Exact public half of SPAKTOK_D1_BRIDGE_SIGNING_KEY must be bound as secret
// SPAKTOK_STUDIO_ED25519_PUBLIC_KEY (base64 DER SPKI), never checked in.
const DOMAIN="spaktok-studio-pilot-read-v1";
const OBJECTS=Object.freeze({
 first:Object.freeze({
  key:"studio/private/pilot-20261030/33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa.glb",
  bytes:5343540,
 }),
 lod0:Object.freeze({
  key:"studio/private/pilot-20261030/lods/lod0.glb",
  bytes:5343540,
 }),
 lod1:Object.freeze({
  key:"studio/private/pilot-20261030/lods/lod1.glb",
  bytes:2825124,
 }),
 lod2:Object.freeze({
  key:"studio/private/pilot-20261030/lods/lod2.glb",
  bytes:1448404,
 }),
 lod1c:Object.freeze({
  key:"studio/private/pilot-20261030/professional-candidates-v1/lod1-conservative.glb",
  bytes:5087128,
 }),
 lod2c:Object.freeze({
  key:"studio/private/pilot-20261030/professional-candidates-v1/lod2-conservative.glb",
  bytes:4992732,
 }),
});
const LOD_PATH=/^\/v1\/pilot\/(first|lod0|lod1|lod2|lod1c|lod2c)\.glb$/;
const b64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));

const deny=(status=404)=>new Response(JSON.stringify({error:status===401?"unauthorized":"not_found"}),{
 status,headers:{"content-type":"application/json","cache-control":"private,no-store","x-content-type-options":"nosniff"},
});
function allowedOrigin(origin,env){
 const allowed=env.SPAKTOK_WEB_ORIGIN;
 return typeof allowed==="string" && /^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(allowed) &&
  !allowed.includes("..") && origin===allowed;
}
function corsHeaders(origin){
 return {"access-control-allow-origin":origin,"access-control-allow-methods":"GET, OPTIONS",
  "access-control-allow-headers":"X-Spaktok-Studio-Signature, X-Spaktok-Studio-Expires, X-Spaktok-Studio-User",
  "access-control-max-age":"60","vary":"Origin"};
}
async function authorized(request,origin,assetId,env){
 const user=request.headers.get("x-spaktok-studio-user")??"";
 const expires=request.headers.get("x-spaktok-studio-expires")??"";
 const signature=request.headers.get("x-spaktok-studio-signature")??"";
 if(!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(user)||
    !/^\d{10}$/.test(expires)||!/^[a-zA-Z0-9_-]{86}$/.test(signature))
  return false;
 const now=Math.floor(Date.now()/1000);
 if(Number(expires)<now||Number(expires)>now+90)return false;
 const payload=[DOMAIN,"GET",user,assetId,expires,origin].join("\n");
 try{
  if(typeof env.SPAKTOK_STUDIO_ED25519_PUBLIC_KEY!=="string")return false;
  const key=await crypto.subtle.importKey("spki",b64(env.SPAKTOK_STUDIO_ED25519_PUBLIC_KEY),{name:"Ed25519"},false,["verify"]);
  const raw=signature.replace(/-/g,"+").replace(/_/g,"/")+"==";
  return await crypto.subtle.verify("Ed25519",key,b64(raw),
   new TextEncoder().encode(payload));
 }catch{return false;}
}
export default {
 async fetch(req,env){
  const url=new URL(req.url);
  const assetId=LOD_PATH.exec(url.pathname)?.[1];
  if(!assetId||url.search||url.hash)return deny();
  const origin=req.headers.get("origin")??"";
  if(!allowedOrigin(origin,env))return deny(403);
  if(req.method==="OPTIONS")
   return new Response(null,{status:204,headers:corsHeaders(origin)});
  if(req.method!=="GET"||!await authorized(req,origin,assetId,env))return deny(401);
  if(!env.STUDIO_ASSETS)return deny(503);
  try{
   const asset=OBJECTS[assetId];
   const glb=await env.STUDIO_ASSETS.get(asset.key);
   if(!glb||glb.size!==asset.bytes)return deny(503);
   return new Response(glb.body,{status:200,headers:{
    ...corsHeaders(origin),
    "content-type":"model/gltf-binary",
    "content-length":String(asset.bytes),
    "content-disposition":'attachment; filename="spaktok-first-'+assetId+'.glb"',
    "cache-control":"private,no-store",
    "x-content-type-options":"nosniff",
    "cross-origin-resource-policy":"cross-origin",
   }});
  }catch{return deny(503);}
 },
};
