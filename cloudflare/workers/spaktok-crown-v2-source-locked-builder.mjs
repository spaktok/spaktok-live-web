/**
 * Royal Crown 01 v2 — deterministic reference-locked geometry from ORIGINAL PNG.
 * This does NOT hallucinate a new texture from DINOv3. It preserves the exact
 * 2.4 MB original RGBA PNG as an embedded GLB image, and uses a gently curved
 * tessellated surface (2.5D) plus a real extruded oval rear headband.
 *
 * IMPORTANT: 100% reconstruction of an unseen backside is impossible from one
 * frontal image. The front texture is source-identical; mesh thickness is authored.
 *
 * Runs only as a one-time private scheduled Worker task. No public generation API.
 */
const SOURCE_KEY='vast-private/input/royal-crown-01/883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e.png';
const SOURCE_SHA='883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e';
const DEST_KEY='vast-private/input/royal-crown-01/reference-locked-v2-source.glb';
const SRC_BYTES=2408236, WIDTH=1448, HEIGHT=1086, COLS=144, ROWS=108;
const MATERIAL_NAMES=['metal_base','gem_main_center','gem_secondary','diamond_small','sparkle_layer','gold_backing_headband'];
const encoder=new TextEncoder();
const digits=a=>Array.from(new Uint8Array(a)).map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=b=>crypto.subtle.digest('SHA-256',b).then(digits);
const pad4=n=>(n+3)&~3;
const vertices=(COLS+1)*(ROWS+1);
function mat4(a){const d=Math.hypot(...a);return a.map(x=>x/d);}
function zone(u,v){
 // Semantic zones are initial review masks, not gem segmentation ground truth.
 if((Math.abs(u-.5)/.12+Math.abs(v-.52)/.285)<1.0&&v>.31&&v<.75)return 1;
 if((u>.46&&u<.54&&v>.03&&v<.32)||
    ((u<.26||u>.74)&&v>.16&&v<.68&&Math.sin(u*31+v*18)>.28))return 2;
 if(v>.715&&v<.855&&u>.015&&u<.985)return 3;
 if(v>.22&&v<.42&&u>.2&&u<.8&&Math.sin(65*u)*Math.sin(24*v)>.58)return 4;
 return 0;
}
function buildExactFront(bytes){
 const pos=new Float32Array(vertices*3);
 const norm=new Float32Array(vertices*3);
 const uv=new Float32Array(vertices*2);
 const width=1.42, height=width*(HEIGHT/WIDTH);
 for(let r=0;r<=ROWS;r++){
  for(let c=0;c<=COLS;c++){
   const j=r*(COLS+1)+c;
   const u=c/COLS,v=r/ROWS;
   const x=(u-.5)*width,y=(.5-v)*height;
   const relief=.009*Math.exp(-((u-.5)**2/.012+(v-.55)**2/.05));
   const z=.045*(1-(2*u-1)**2)+relief;
   pos.set([x,y,z],j*3);
   const dzdu=-.18*(u-.5)-relief*(2*(u-.5)/.012);
   const n=mat4([-dzdu/width,0,1]);
   norm.set(n,j*3);
   uv.set([u,1-v],j*2);
  }
 }
 const zones=[[],[],[],[],[]];
 for(let r=0;r<ROWS;r++){
  for(let c=0;c<COLS;c++){
   const u=(c+.5)/COLS,v=(r+.5)/ROWS;
   const z=zone(u,v);
   const a=r*(COLS+1)+c,b=a+1,d=a+(COLS+1),e=d+1;
   zones[z].push(a,d,b,b,d,e);
  }
 }
 const ringSegments=144;
 const rp=new Float32Array((ringSegments+1)*4*3);
 const rn=new Float32Array((ringSegments+1)*4*3);
 const rt=new Float32Array((ringSegments+1)*4*2);
 const faceIndices=[];
 const outer=.71,inner=.682,ringY=-height*.35,depth=.27;
 for(let t=0;t<=ringSegments;t++){
  const angle=(t/ringSegments)*2*Math.PI;
  const x0=Math.cos(angle),z0=Math.sin(angle);
  const pairs=[
   [outer,-.021],[outer,.021],[inner,-.021],[inner,.021],
  ];
  for(let j=0;j<4;j++){
   const index=t*4+j,rad=pairs[j][0],dy=pairs[j][1];
   const x=rad*x0,z=.032+depth*(z0-1);
   rp.set([x,ringY+dy,z],index*3);
   rn.set(mat4([x0,0,z0]),index*3);
   rt.set([t/ringSegments,j%2],index*2);
  }
 }
 for(let t=0;t<ringSegments;t++){
  const a=t*4,b=(t+1)*4;
  faceIndices.push(a,b,a+1,a+1,b,b+1); // outer face
  faceIndices.push(a+2,a+3,b+2,a+3,b+3,b+2); // inner face
  faceIndices.push(a+1,b+1,a+3,a+3,b+1,b+3); // top
  faceIndices.push(a,b,a+2,a+2,b,b+2); // bottom
 }
 return {pos,norm,uv,zones,ring:{pos:rp,norm:rn,uv:rt,indices:faceIndices}};
}
function buildGlb(png){
 const geom=buildExactFront(png);
 const buffers=[],bufferViews=[],accessors=[];
 let bytesLen=0;
 const append=(typed,target)=>{
  const b=new Uint8Array(typed.buffer??typed,typed.byteOffset??0,typed.byteLength??typed.byteLength);
  const viewIndex=bufferViews.length;
  bufferViews.push({buffer:0,byteOffset:bytesLen,byteLength:b.byteLength,...(target?{target}:{})});
  buffers.push(b);
  bytesLen+=pad4(b.byteLength);
  return viewIndex;
 };
 const acc=(view,count,type,componentType,extra={})=>{
  const idx=accessors.length;
  accessors.push({bufferView:view,componentType,count,type,...extra});
  return idx;
 };
 const pView=append(geom.pos,34962),nView=append(geom.norm,34962),tView=append(geom.uv,34962);
 const maxCoord=Math.max(...geom.pos.filter((_,i)=>i%3===2));
 const posIdx=acc(pView,vertices,'VEC3',5126,{min:[-.71,-.5335,-.01],max:[.71,.5335,maxCoord]});
 const norIdx=acc(nView,vertices,'VEC3',5126),uvIdx=acc(tView,vertices,'VEC2',5126);
 const primitives=[],counts=[];
 for(let i=0;i<5;i++){
  const indices=Uint32Array.from(geom.zones[i]);
  counts.push(indices.length/3);
  const view=append(indices,34963);
  primitives.push({attributes:{POSITION:posIdx,NORMAL:norIdx,TEXCOORD_0:uvIdx},
   indices:acc(view,indices.length,'SCALAR',5125),material:i,mode:4});
 }
 const ringP=append(geom.ring.pos,34962),ringN=append(geom.ring.norm,34962),ringT=append(geom.ring.uv,34962);
 const ringPos=acc(ringP,geom.ring.pos.length/3,'VEC3',5126,{min:[-.72,-.6,-.56],max:[.72,.6,.1]});
 const ringNorm=acc(ringN,geom.ring.norm.length/3,'VEC3',5126);
 const ringUV=acc(ringT,geom.ring.uv.length/2,'VEC2',5126);
 const ringIndices=Uint32Array.from(geom.ring.indices);
 const ringIndView=append(ringIndices,34963);
 primitives.push({attributes:{POSITION:ringPos,NORMAL:ringNorm,TEXCOORD_0:ringUV},
  indices:acc(ringIndView,ringIndices.length,'SCALAR',5125),material:5,mode:4});
 const pngView=append(png);
 const materials=MATERIAL_NAMES.map((name,i)=>i<5?({
  name,
  pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:0},
   metallicFactor:0,roughnessFactor:1},
  alphaMode:'BLEND',doubleSided:true,
  extensions:{KHR_materials_unlit:{}},
  extras:{zoneMapping:'provisional-grid-segmentation',sourceTextureLocked:true}
 }):({
  name,pbrMetallicRoughness:{baseColorFactor:[.90,.57,.16,1],metallicFactor:.88,roughnessFactor:.24},
  doubleSided:true}));
 const gltf={asset:{version:'2.0',generator:'Spaktok Studio crown-v2 exact-original-png reference lock'},
  extensionsUsed:['KHR_materials_unlit'],
  scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Royal Crown 01 — image locked v2'}],
  meshes:[{name:'royal-crown-01-source-locked',primitives}],
  accessors,bufferViews,buffers:[{byteLength:bytesLen}],materials,
  textures:[{source:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],
  images:[{bufferView:pngView,mimeType:'image/png',name:'EXACT original crown_reference_original.png'}],
  extras:{sourceSha256:SOURCE_SHA,sourceWidth:WIDTH,sourceHeight:HEIGHT,
   statement:'Original PNG is embedded verbatim; front geometry is authored 2.5D, not a certified 100% 3D reconstruction.',
   approvedForLive:false}};
 const json=encoder.encode(JSON.stringify(gltf)),jsonLen=pad4(json.byteLength);
 const total=12+8+jsonLen+8+bytesLen;
 if(total>35*1024*1024)throw Error('glb_too_large');
 const b=new Uint8Array(total),v=new DataView(b.buffer);
 const write32=(at,val)=>v.setUint32(at,val,true);
 write32(0,0x46546c67);write32(4,2);write32(8,total);
 write32(12,jsonLen);write32(16,0x4e4f534a);b.set(json,20);b.fill(0x20,20+json.length,20+jsonLen);
 const off=20+jsonLen;write32(off,bytesLen);write32(off+4,0x004e4942);
 let dst=off+8;
 for(const chunk of buffers){b.set(chunk,dst);dst+=pad4(chunk.byteLength)}
 if(dst!==total)throw Error('glb_length_mismatch');
 return {data:b,triangles:counts.reduce((a,n)=>a+n,0)+ringIndices.length/3,
  faceTriangleCount:counts.reduce((a,n)=>a+n,0),zoneTriangleCounts:counts,
  size:total,materials:MATERIAL_NAMES};
}
const j=(obj,status=200)=>new Response(JSON.stringify(obj),{status,
 headers:{'content-type':'application/json','cache-control':'no-store'}});
async function build(env){
 const old=await env.CROWN_DB.prepare("SELECT status FROM studio_crown_v2_build WHERE id='royal-crown-01'").first();
 if(old?.status==='succeeded')return;
 if(old?.status==='failed')await env.CROWN_DB.prepare("DELETE FROM studio_crown_v2_build WHERE id='royal-crown-01' AND status='failed'").run();
 let result={},error=null;
 try{
  const rights=await env.CROWN_DB.prepare(
   "SELECT 1 AS allowed FROM vast_crown_01_upload_tickets WHERE used_at IS NOT NULL AND rights_confirmed=1 AND object_key=? LIMIT 1"
  ).bind(SOURCE_KEY).first();
  if(!rights?.allowed)throw Error('owner_rights_not_confirmed');
  const asset=await env.CROWN_ASSETS.get(SOURCE_KEY);
  if(!asset||asset.size!==SRC_BYTES||asset.customMetadata?.sha256!==SOURCE_SHA)
   throw Error('original_png_not_verified');
  const raw=await asset.arrayBuffer();
  if(await digest(raw)!==SOURCE_SHA)throw Error('original_png_checksum_mismatch');
  const model=buildGlb(new Uint8Array(raw));
  const outputSha=await digest(model.data);
  if(await env.CROWN_ASSETS.head(DEST_KEY))throw Error('source_locked_v2_already_exists');
  await env.CROWN_ASSETS.put(DEST_KEY,model.data,{
   httpMetadata:{contentType:'model/gltf-binary'},
   customMetadata:{sha256:outputSha,sourceSha256:SOURCE_SHA,asset:'royal-crown-01',
    status:'source-locked-preview-not-for-live',visibility:'private'}});
  result={key:DEST_KEY,sha256:outputSha,bytes:model.size,
   triangles:model.triangles,frontTriangles:model.faceTriangleCount,zoneTriangles:model.zoneTriangleCounts,
   materials:model.materials,sourceSha256:SOURCE_SHA,sourcePngEmbeddedUnchanged:true,
   frontPixelsReused:true,backsideSourceUnknown:true,visualQa:false,
   full3dSimilarity100PercentGuaranteed:false,liveApproved:false};
 }catch(ex){const message=ex instanceof Error?ex.name+':'+ex.message:'unknown_error';error='build_error';result={diagnostic:message.slice(0,260)}}
 await env.CROWN_DB.prepare(
  "INSERT OR IGNORE INTO studio_crown_v2_build(id,status,result_json,error_code,completed_at) VALUES('royal-crown-01',?,?,?,?)"
 ).bind(error?'failed':'succeeded',JSON.stringify(result),error,Math.floor(Date.now()/1000)).run();
}
export default {
 async fetch(req,env,ctx){
  const u=new URL(req.url);
  if(u.pathname==='/health'&&req.method==='GET')return j({service:'crown-v2-private-builder',publicGeneration:false});
  const match=u.pathname.match(/^\/v1\/operator\/rebuild\/([a-f0-9]{64})$/);
  if(req.method!=='GET'||!match||u.search)return j({error:'not_found'},404);
  const tokenSha=await digest(encoder.encode(match[1]));
  const now=Math.floor(Date.now()/1000);
  const granted=await env.CROWN_DB.prepare(
   'UPDATE studio_crown_v2_tickets SET used_at=? WHERE token_sha256=? AND used_at IS NULL AND expires_at>=? RETURNING token_sha256'
  ).bind(now,tokenSha,now).first();
  if(!granted)return j({error:'invalid_or_expired_operator_ticket'},403);
  ctx.waitUntil(build(env));
  return j({accepted:true,job:'royal-crown-01-v2',public:false},202);
 },
 async scheduled(event,env,ctx){ctx.waitUntil(build(env))}
};
