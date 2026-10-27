// SpakTok Face Draft Asset Worker — private Cloudflare R2
// User-supplied GLB remains private; only the authenticated Next.js server
// can issue a short-lived, Ed25519-signed request for a specific owner + asset.
const KEY="MCowBQYDK2VwAyEAN/tgkUKQRZ7J3fpryNYw3JFrK8OqQOxPpZDp05LcsLw=";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX=12*1024*1024;
const b64=s=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));
const imported=crypto.subtle.importKey('spki',b64(KEY),{name:'Ed25519'},false,['verify']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'content-type':'application/json','cache-control':'no-store',
 'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin',
}});
async function authorized(req,method,user,id,bytes){
 const signature=req.headers.get('x-spaktok-face-signature')??'';
 const expires=req.headers.get('x-spaktok-face-expires')??'';
 if(!/^[A-Za-z0-9_-]{86}$/.test(signature)||!/^\d{10}$/.test(expires))return false;
 const now=Math.floor(Date.now()/1000),time=Number(expires);
 if(time<now||time>now+120)return false;
 const payload=['spaktok-face-draft-v1',method,user,id,String(bytes),expires].join('\n');
 try{
  const key=await imported;
  const raw=signature.replace(/-/g,'+').replace(/_/g,'/')+'==';
  return await crypto.subtle.verify('Ed25519',key,b64(raw),new TextEncoder().encode(payload));
 }catch{return false;}
}
function validateGlb(data){
 if(data.byteLength<64||data.byteLength>MAX)return false;
 const view=new DataView(data);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||
    view.getUint32(8,true)!==data.byteLength||
    view.getUint32(16,true)!==0x4e4f534a)return false;
 const jsonLength=view.getUint32(12,true);
 if(jsonLength<16||jsonLength>data.byteLength-20)return false;
 try{
  const gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,jsonLength)));
  const mesh=gltf.meshes?.[0]?.primitives?.[0];
  const accessors=gltf.accessors??[];
  if(gltf.meshes?.length!==1||gltf.meshes[0].primitives.length!==1||
    !mesh||(mesh.mode??4)!==4||
    accessors[mesh.attributes?.POSITION]?.count!==468||
    accessors[mesh.attributes?.TEXCOORD_0]?.count!==468||
    accessors[mesh.indices]?.count!==2694||
    (gltf.images??[]).length!==1)return false;
  if((gltf.buffers??[]).some(b=>b.uri&&!b.uri.startsWith('data:'))||
     (gltf.images??[]).some(b=>b.uri&&!b.uri.startsWith('data:')))return false;
  if((gltf.extensionsRequired??[]).length)return false;
  return true;
 }catch{return false;}
}
export default {
 async fetch(req,env){
  const url=new URL(req.url);
  if(req.method==='GET'&&url.pathname==='/health')
   return json({ok:true,storage:'private-r2',upload:'signed-server-only'});
  const match=/^\/v1\/face\/([a-f0-9-]{36})\/([a-f0-9-]{36})\.glb$/.exec(url.pathname);
  if(!match||!['GET','PUT','DELETE'].includes(req.method))return json({error:'not_found'},404);
  const [,user,id]=match;
  if(!UUID.test(user)||!UUID.test(id))return json({error:'not_found'},404);
  const size=req.method==='PUT'?Number(req.headers.get('content-length')??0):0;
  if(req.method==='PUT'&&(!Number.isSafeInteger(size)||size<64||size>MAX||
    req.headers.get('content-type')!=='model/gltf-binary'))return json({error:'invalid_size'},413);
  if(!await authorized(req,req.method,user,id,size))
   return json({error:'not_authorized'},401);
  const key='face-drafts/'+user+'/'+id+'.glb';
  if(req.method==='PUT'){
   if(await env.FACE_DRAFTS.head(key))return json({error:'asset_exists'},409);
   const data=await req.arrayBuffer();
   if(data.byteLength!==size||!validateGlb(data))return json({error:'invalid_glb'},422);
   try{
    await env.FACE_DRAFTS.put(key,data,{httpMetadata:{contentType:'model/gltf-binary'},
     customMetadata:{visibility:'private',type:'face-draft-v1',ownerId:user}});
    return json({stored:true,key:id,size},201);
   }catch{return json({error:'storage_unavailable'},503);}
  }
  if(req.method==='DELETE'){
   await env.FACE_DRAFTS.delete(key);
   return json({deleted:true},200);
  }
  const asset=await env.FACE_DRAFTS.get(key);
  if(!asset)return json({error:'not_found'},404);
  return new Response(asset.body,{status:200,headers:{
   'content-type':'model/gltf-binary',
   'content-length':String(asset.size),
   'cache-control':'private,max-age=0,no-store',
   'x-content-type-options':'nosniff',
   'cross-origin-resource-policy':'same-origin',
  }});
 }
};
