// One-time, owner-approved structural audit and private download of Royal Crown 01.
// Only the exact immutable GLB from the approved TRELLIS.2 job can be exported.
const JOB='39ad267e-f1ed-2d10-12ef-4c5927616c86';
const KEY='vast-private/output/royal-crown-01/first-run-20261101.glb';
const INPUT='vast-private/input/royal-crown-01/qa-first-run.glb';
const AUDIT='studio/private/filters/crown/royal-crown-01/qa.json';
const EXPECT_SHA='3ce1d543317590c95b386e5f5f6747c048421cf9a93bbf7a37f2a8b39806822b';
const EXPECT_SIZE=4856516, MAX_SIZE=8*1024*1024;
const NO_STORE={'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const respond=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{...NO_STORE,'content-type':'application/json'}});
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(v=>v.toString(16).padStart(2,'0')).join('');
const now=()=>Math.floor(Date.now()/1000);
function auditGlb(bytes){
 if(bytes.byteLength!==EXPECT_SIZE||bytes.byteLength>MAX_SIZE)throw Error('glb_wrong_size');
 const b=new DataView(bytes);
 if(b.getUint32(0,true)!==0x46546c67||b.getUint32(4,true)!==2||b.getUint32(8,true)!==bytes.byteLength)throw Error('invalid_glb_header');
 if(b.getUint32(16,true)!==0x4e4f534a)throw Error('invalid_json_chunk');
 const len=b.getUint32(12,true);
 if(len<24||len>bytes.byteLength-20||len%4!==0)throw Error('invalid_json_chunk_length');
 let doc;
 try{doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes,20,len)))}
 catch{throw Error('invalid_glb_json')}
 if(doc?.asset?.version!=='2.0'||!Array.isArray(doc.meshes)||!Array.isArray(doc.accessors)||!doc.meshes.length)throw Error('invalid_geometry');
 let triangles=0,primitives=0,normals=0,uvs=0;
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives||[]){
  if((primitive.mode??4)!==4)continue;
  const attr=primitive.attributes||{},idx=primitive.indices??attr.POSITION;
  if(!Number.isInteger(idx)||idx<0||idx>=doc.accessors.length)throw Error('invalid_accessor');
  const count=doc.accessors[idx].count;
  if(!Number.isInteger(count)||count<3)throw Error('invalid_triangle_count');
  triangles+=Math.floor(count/3);primitives++;
  if(Number.isInteger(attr.NORMAL))normals++;
  if(Number.isInteger(attr.TEXCOORD_0))uvs++;
 }
 if(!primitives||!triangles)throw Error('empty_mesh');
 const mats=Array.isArray(doc.materials)?doc.materials:[],images=Array.isArray(doc.images)?doc.images:[];
 const external=[...images,...(Array.isArray(doc.buffers)?doc.buffers:[])].some(x=>typeof x.uri==='string'&&!x.uri.startsWith('data:'));
 const pbr=mats.filter(x=>x?.pbrMetallicRoughness).length;
 return {asset:'royal-crown-01',sourceJob:JOB,bytes:bytes.byteLength,sha256:EXPECT_SHA,
  meshes:doc.meshes.length,triangles,primitives,normalPrimitives:normals,
  uvPrimitives:uvs,materialCount:mats.length,pbrMaterialCount:pbr,
  embeddedOrDataImages:images.length,externalResources:external,
  materialNames:mats.map(x=>typeof x.name==='string'?x.name.slice(0,80):''),
  mobileStructuralPass:bytes.byteLength<=15*1024*1024&&triangles<=150000&&
   normals===primitives&&uvs===primitives&&pbr>0&&!external,
  referenceMatchVerified:false,materialSlotsVerified:false,faceTrackingVerified:false,
  livePublished:false,note:'Structure only, not a likeness or FPS certification.'};
}
async function main(req,env){
 const url=new URL(req.url);
 if(url.pathname==='/health'&&req.method==='GET')return respond({service:'private-crown-qa',publicModelAccess:false});
 const m=url.pathname.match(/^\/v1\/owner\/royal-crown-01\/download\/([a-f0-9]{64})$/);
 if(req.method!=='GET'||!m||url.search||!env.VAST_DB||!env.VAST_ASSETS)return respond({error:'not_found'},404);
 const token=m[1];
 const ticket=await env.VAST_DB.prepare('SELECT expires_at,used_at FROM vast_crown_review_tickets WHERE token=?').bind(token).first();
 if(!ticket||ticket.expires_at<now()||ticket.used_at!==null)return respond({error:'ticket_expired_or_used'},403);
 const job=await env.VAST_DB.prepare('SELECT state,output_sha256,output_bytes FROM vast_agent_jobs WHERE id=?').bind(JOB).first();
 if(job?.state!=='succeeded'||job.output_sha256!==EXPECT_SHA||job.output_bytes!==EXPECT_SIZE)return respond({error:'unverified_job'},409);
 const object=await env.VAST_ASSETS.get(KEY);
 if(!object||object.size!==EXPECT_SIZE||object.customMetadata?.sha256!==EXPECT_SHA)return respond({error:'unverified_object'},409);
 const bytes=await object.arrayBuffer();
 if(await sha(bytes)!==EXPECT_SHA)return respond({error:'sha_mismatch'},409);
 let result;
 try{result=auditGlb(bytes)}catch{return respond({error:'invalid_glb_structure'},422)}
 const claim=await env.VAST_DB.prepare('UPDATE vast_crown_review_tickets SET used_at=? WHERE token=? AND used_at IS NULL AND expires_at>=? RETURNING token').bind(now(),token,now()).first();
 if(!claim)return respond({error:'ticket_race'},409);
 await env.VAST_ASSETS.put(AUDIT,JSON.stringify(result),{httpMetadata:{contentType:'application/json'},customMetadata:{asset:'royal-crown-01',visibility:'private'}});
 if(!(await env.VAST_ASSETS.head(INPUT)))
  await env.VAST_ASSETS.put(INPUT,bytes,{httpMetadata:{contentType:'model/gltf-binary'},customMetadata:{sha256:EXPECT_SHA,visibility:'private'}});
 return new Response(bytes,{status:200,headers:{...NO_STORE,'content-type':'model/gltf-binary','content-length':String(bytes.byteLength),'content-disposition':'attachment; filename="spaktok-royal-crown-01-master.glb"'}});
}
async function internalAudit(env){
 const q=await env.VAST_DB.prepare("SELECT status FROM vast_crown_qa_results WHERE asset_id='royal-crown-01'").first();
 if(q)return;
 let result=null,errorCode=null;
 try{
  const job=await env.VAST_DB.prepare('SELECT state,output_sha256,output_bytes FROM vast_agent_jobs WHERE id=?').bind(JOB).first();
  if(job?.state!=='succeeded'||job.output_sha256!==EXPECT_SHA||job.output_bytes!==EXPECT_SIZE)
   throw Error('unverified_generation_job');
  const obj=await env.VAST_ASSETS.get(KEY);
  if(!obj||obj.size!==EXPECT_SIZE||obj.customMetadata?.sha256!==EXPECT_SHA)
   throw Error('private_glb_missing_or_mismatch');
  const bytes=await obj.arrayBuffer();
  if(await sha(bytes)!==EXPECT_SHA)throw Error('private_glb_hash_mismatch');
  result=auditGlb(bytes);
  if(!(await env.VAST_ASSETS.head(INPUT))){
   await env.VAST_ASSETS.put(INPUT,bytes,{httpMetadata:{contentType:'model/gltf-binary'},
     customMetadata:{sha256:EXPECT_SHA,asset:'royal-crown-01',visibility:'private'}});
  }
  await env.VAST_ASSETS.put(AUDIT,JSON.stringify(result),
   {httpMetadata:{contentType:'application/json'},customMetadata:{asset:'royal-crown-01',visibility:'private'}});
 }catch(error){
  const code=error instanceof Error?error.message:'internal_error';
  errorCode=/^[a-z0-9_]{1,60}$/.test(code)?code:'internal_error';
 }
 await env.VAST_DB.prepare("INSERT OR IGNORE INTO vast_crown_qa_results(asset_id,status,quality_json,completed_at,error_code) VALUES('royal-crown-01',?,?,?,?)")
  .bind(result?'succeeded':'failed',JSON.stringify(result||{}),now(),errorCode).run();
}
export default {
 async fetch(req,env){try{return await main(req,env)}catch{return respond({error:'private_review_unavailable'},500)}},
 async scheduled(event,env,ctx){ctx.waitUntil(internalAudit(env))}
};
export {auditGlb};
