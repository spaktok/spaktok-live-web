// Owner-private Spaktok Studio GLB bridge, isolated from face_drafts/video.
// Requires R2 binding STUDIO_DRAFTS (bucket spaktok-private-drafts), and
// STUDIO_ALLOWED_ORIGIN exact HTTPS owner Studio origin. NOT YET DEPLOYED.
// The public key matches the existing server signer and is safe to commit.
// Domain separated from all other workers; no anonymous list or asset URL.
const PUBLIC_KEY='MCowBQYDK2VwAyEAN/tgkUKQRZ7J3fpryNYw3JFrK8OqQOxPpZDp05LcsLw=';
const DOMAIN='spaktok-studio-draft-v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MAX=15*1024*1024;
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const keyPromise=crypto.subtle.importKey('spki',b64(PUBLIC_KEY),{name:'Ed25519'},false,['verify']);
const headers=(origin,allowed)=>({
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
 'cross-origin-resource-policy':'cross-origin',
 ...(origin===allowed?{
  'access-control-allow-origin':allowed,
  'access-control-allow-methods':'GET,PUT,HEAD,DELETE,OPTIONS',
  'access-control-allow-headers':'Content-Type,X-SpakTok-Studio-Signature,X-SpakTok-Studio-Expires,X-SpakTok-Studio-Sha256,X-SpakTok-Studio-Size',
  'access-control-expose-headers':'Content-Length,X-SpakTok-Asset-Sha256',
  vary:'Origin',
 }:{}),
});
const reply=(body,status,origin,allowed)=>new Response(JSON.stringify(body),{
 status,headers:{...headers(origin,allowed),'content-type':'application/json'}});
async function authorize(request,method,owner,id,sha,size){
 const expires=request.headers.get('x-spaktok-studio-expires')||'';
 const signature=request.headers.get('x-spaktok-studio-signature')||'';
 if(!/^\d{10}$/.test(expires)||!/^[A-Za-z0-9_-]{86}$/.test(signature))return false;
 const now=Math.floor(Date.now()/1000),end=Number(expires);
 if(end<now||end>now+360)return false;
 const payload=[DOMAIN,method,owner,id,sha,String(size),expires].join('\n');
 try{
  const key=await keyPromise;
  const raw=signature.replace(/-/g,'+').replace(/_/g,'/')+'==';
  return await crypto.subtle.verify('Ed25519',key,b64(raw),
   new TextEncoder().encode(payload));
 }catch{return false;}
}
function validateGlb(data){
 if(data.byteLength<128||data.byteLength>MAX)return false;
 const v=new DataView(data);
 if(v.getUint32(0,true)!==0x46546c67||
   v.getUint32(4,true)!==2||
   v.getUint32(8,true)!==data.byteLength||
   v.getUint32(16,true)!==0x4e4f534a)return false;
 const size=v.getUint32(12,true);
 if(size<20||size>data.byteLength-20)return false;
 try{
  const doc=JSON.parse(new TextDecoder('utf-8',{fatal:true})
   .decode(new Uint8Array(data,20,size)));
  if(doc.asset?.version!=='2.0'||!Array.isArray(doc.meshes)||
    !doc.meshes.length||!Array.isArray(doc.accessors))return false;
  if((doc.extensionsRequired||[]).length>0)return false;
  if((doc.buffers||[]).some(x=>x.uri&&!x.uri.startsWith('data:'))||
     (doc.images||[]).some(x=>x.uri&&!x.uri.startsWith('data:')))return false;
  if(!(doc.materials||[]).some(x=>x.pbrMetallicRoughness)||
     !(doc.images||[]).length)return false;
  let triangles=0,uv=false,normals=false;
  for(const m of doc.meshes){
   for(const p of m.primitives||[]){
    if((p.mode??4)!==4)continue;
    if(!Number.isInteger(p.indices))return false;
    const accessor=doc.accessors[p.indices];
    if(!accessor||!Number.isInteger(accessor.count))return false;
    triangles+=Math.floor(accessor.count/3);
    uv=uv||Number.isInteger(p.attributes?.TEXCOORD_0);
    normals=normals||Number.isInteger(p.attributes?.NORMAL);
   }
  }
  return triangles>0&&triangles<=150000&&uv&&normals;
 }catch{return false;}
}
// GitHub API application/javascript requires the classic Worker entrypoint.
// Bindings are available as global variables in the classic runtime.
addEventListener('fetch', event=>event.respondWith(handleRequest(event.request)));
async function handleRequest(request){
 const env={
  STUDIO_ALLOWED_ORIGIN:globalThis.STUDIO_ALLOWED_ORIGIN,
  STUDIO_DRAFTS:globalThis.STUDIO_DRAFTS,
 };
  const origin=request.headers.get('origin')||'';
  const allowed=env.STUDIO_ALLOWED_ORIGIN||'';
  if(!/^https:\/\//.test(allowed))return new Response('not_configured',{status:503});
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/health')
   return reply({ok:true,storage:'private-r2',modelAssets:'not-public'},200,origin,allowed);
  if(request.method==='OPTIONS'){
   if(origin!==allowed)return reply({error:'origin_denied'},403,origin,allowed);
   return new Response(null,{status:204,headers:headers(origin,allowed)});
  }
  const match=/^\/v1\/studio\/([a-f0-9-]{36})\/([a-f0-9-]{36})\.glb$/.exec(url.pathname);
  if(!match||!['GET','HEAD','PUT','DELETE'].includes(request.method))
   return reply({error:'not_found'},404,origin,allowed);
  const [,owner,id]=match;
  if(!UUID.test(owner)||!UUID.test(id))
   return reply({error:'not_found'},404,origin,allowed);
  const sha=request.headers.get('x-spaktok-studio-sha256')||'';
  const size=Number(request.headers.get('x-spaktok-studio-size')||0);
  if(!SHA.test(sha)||!Number.isSafeInteger(size)||size<128||size>MAX)
   return reply({error:'bad_claim'},422,origin,allowed);
  if(!await authorize(request,request.method,owner,id,sha,size))
   return reply({error:'invalid_signature'},401,origin,allowed);
  if(['PUT','GET'].includes(request.method)&&origin!==allowed)
   return reply({error:'invalid_origin'},403,origin,allowed);
  const objectKey='studio-drafts/'+owner+'/'+id+'.glb';
  try{
   if(request.method==='PUT'){
    if(request.headers.get('content-type')!=='model/gltf-binary'||
       Number(request.headers.get('content-length'))!==size)
     return reply({error:'invalid_upload_length'},413,origin,allowed);
    if(await env.STUDIO_DRAFTS.head(objectKey))
     return reply({error:'asset_exists'},409,origin,allowed);
    const data=await request.arrayBuffer();
    if(data.byteLength!==size||!validateGlb(data))
     return reply({error:'invalid_glb'},422,origin,allowed);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)))
     .map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==sha)return reply({error:'hash_mismatch'},422,origin,allowed);
    await env.STUDIO_DRAFTS.put(objectKey,data,{
     httpMetadata:{contentType:'model/gltf-binary'},
     customMetadata:{owner,sha256:sha,visibility:'owner-private',type:DOMAIN},
    });
    return reply({stored:true,id,bytes:size},201,origin,allowed);
   }
   if(request.method==='DELETE'){
    await env.STUDIO_DRAFTS.delete(objectKey);
    return reply({deleted:true},200,origin,allowed);
   }
   const object=request.method==='HEAD'?
    await env.STUDIO_DRAFTS.head(objectKey):
    await env.STUDIO_DRAFTS.get(objectKey);
   if(!object)return reply({error:'not_found'},404,origin,allowed);
   if(object.size!==size||object.customMetadata?.sha256!==sha||
      object.customMetadata?.owner!==owner)
    return reply({error:'integrity_check_failed'},409,origin,allowed);
   const h={...headers(origin,allowed),
    'content-length':String(size),'content-type':'model/gltf-binary',
    'x-spaktok-asset-sha256':sha};
   return request.method==='HEAD'?
    new Response(null,{status:200,headers:h}):
    new Response(object.body,{status:200,headers:h});
  }catch{return reply({error:'storage_unavailable'},503,origin,allowed);}
}
