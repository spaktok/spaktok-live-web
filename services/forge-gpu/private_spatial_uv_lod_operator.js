// Spaktok PRIVATE prototype LOD generator: topology-aware spatial-UV
// vertex clustering + original embedded PBR WebP textures.
// This is NOT equivalent to gltfpack/meshoptimizer edge collapse.
// All generated variants are PRIVATE PREVIEW assets and must pass visual QA.
// Security: no external input URLs, no glTF extensions downloaded, no scripts.
function decodePrivateGlb(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<28||bytes.length>35*1024*1024)
  throw Error('glb_invalid_size');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||
    view.getUint32(8,true)!==bytes.length)throw Error('glb_bad_header');
 const n=view.getUint32(12,true);
 if(n<16||n%4||n+28>bytes.length||view.getUint32(16,true)!==0x4e4f534a)
  throw Error('glb_bad_json');
 const offset=20+n;
 if(view.getUint32(offset+4,true)!==0x004e4942)throw Error('glb_bad_bin');
 const length=view.getUint32(offset,true);
 if(offset+8+length>bytes.length)throw Error('glb_bin_length');
 const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+n)));
 if(json.asset?.version!=='2.0'||json.buffers?.length!==1||
  json.buffers[0].uri||!Array.isArray(json.bufferViews)||
  json.buffers[0].byteLength>length)throw Error('glb_bad_asset');
 const primitive=json.meshes?.[0]?.primitives?.[0];
 if(json.meshes?.length!==1||json.meshes[0].primitives.length!==1||
    (primitive.mode??4)!==4||primitive.indices===undefined||
    json.skins?.length||json.animations?.length||
    (json.extensionsRequired||[]).some(e=>e!=='EXT_texture_webp'))
   throw Error('glb_unsupported_rig_or_geometry');
 const attrs=primitive.attributes||{};
 const idx=json.accessors[primitive.indices],p=json.accessors[attrs.POSITION],
       uv=json.accessors[attrs.TEXCOORD_0],normal=json.accessors[attrs.NORMAL];
 if(idx?.componentType!==5125||idx.type!=='SCALAR'||idx.count%3||
    p?.componentType!==5126||p.type!=='VEC3'||
    uv?.componentType!==5126||uv.type!=='VEC2'||
    normal?.componentType!==5126||normal.type!=='VEC3'||
    p.count!==uv.count||p.count!==normal.count||p.count>200000||
    !Array.isArray(p.min)||!Array.isArray(p.max))
  throw Error('glb_unsupported_accessors');
 const bin=bytes.subarray(offset+8,offset+8+length);
 const get=(acc,components,kind)=>{
  const v=json.bufferViews[acc.bufferView],o=(v?.byteOffset||0)+(acc.byteOffset||0),
    elem=components*4;
  if(v?.buffer!==0||v.byteStride||o<0||o+acc.count*elem>bin.length||
   (acc.byteOffset||0)+acc.count*elem>v.byteLength||o%4)
   throw Error('glb_accessor_unbacked');
  if(kind==='u32')return new Uint32Array(bin.buffer,bin.byteOffset+o,acc.count);
  return new Float32Array(bin.buffer,bin.byteOffset+o,acc.count*components);
 };
 const indices=get(idx,1,'u32'),positions=get(p,3,'f32'),uvs=get(uv,2,'f32'),
  normals=get(normal,3,'f32');
 for(let i=0;i<indices.length;i++)if(indices[i]>=p.count)
  throw Error('glb_bad_indices');
 for(const image of json.images||[]){
  const bv=json.bufferViews[image.bufferView];
  if(!bv||bv.buffer!==0||image.mimeType!=='image/webp'||
   bv.byteOffset+bv.byteLength>bin.length)
   throw Error('glb_unsupported_image');
 }
 return {json,bin,indices,positions,uvs,normals,primitive,
  idx,p,uv,normal,source:bytes};
}
function buildSpaktokClusterLod(src,grid){
 const {json,bin,indices,positions,uvs,normals,primitive,p,uv,normal,idx}=src;
 if(![48,24].includes(grid))throw Error('lod_grid_not_allowed');
 const min=p.min,max=p.max,clusters=new Map(),map=new Int32Array(p.count),
       sums=[],count=[];
 // Preserve coarse atlas seams by including the source UV region. This is a
 // preview-quality simplifier, NOT an artistic-quality UV-aware QEM solver.
 for(let i=0;i<p.count;i++){
  const px=positions[i*3],py=positions[i*3+1],pz=positions[i*3+2],
    u=uvs[i*2],v=uvs[i*2+1],nx=normals[i*3],ny=normals[i*3+1],nz=normals[i*3+2];
  if(![px,py,pz,u,v,nx,ny,nz].every(Number.isFinite))
   throw Error('lod_nonfinite_source_data');
  const key=[
   Math.floor((px-min[0])/(max[0]-min[0]+1e-9)*grid),
   Math.floor((py-min[1])/(max[1]-min[1]+1e-9)*grid),
   Math.floor((pz-min[2])/(max[2]-min[2]+1e-9)*grid),
   Math.floor(u*8),Math.floor(v*8)
  ].join(',');
  let id=clusters.get(key);
  if(id===undefined){id=sums.length;clusters.set(key,id);
   sums.push(new Float64Array(8));count.push(0);}
  map[i]=id;const a=sums[id];a[0]+=px;a[1]+=py;a[2]+=pz;a[3]+=u;a[4]+=v;
  a[5]+=nx;a[6]+=ny;a[7]+=nz;count[id]++;
 }
 const avg=new Float32Array(sums.length*8);
 for(let i=0;i<sums.length;i++){
  let a=sums[i],b=i*8,c=count[i];
  for(let j=0;j<8;j++)avg[b+j]=a[j]/c;
  let mag=Math.hypot(avg[b+5],avg[b+6],avg[b+7]);
  if(mag>1e-9){for(let j=5;j<8;j++)avg[b+j]/=mag;}
  else{avg[b+5]=0;avg[b+6]=0;avg[b+7]=1;}
 }
 const unique=new Set(),kept=[];
 let inverted=0,duplicates=0,degenerate=0;
 for(let i=0;i<indices.length;i+=3){
  const oa=indices[i],ob=indices[i+1],oc=indices[i+2],
    a=map[oa],b=map[ob],c=map[oc];
  if(a===b||a===c||b===c){degenerate++;continue;}
  const ai=a*8,bi=b*8,ci=c*8,ox=oa*3,oy=ob*3,oz=oc*3;
  const abx=avg[bi]-avg[ai],aby=avg[bi+1]-avg[ai+1],
    abz=avg[bi+2]-avg[ai+2],acx=avg[ci]-avg[ai],
    acy=avg[ci+1]-avg[ai+1],acz=avg[ci+2]-avg[ai+2];
  const cx=aby*acz-abz*acy,cy=abz*acx-abx*acz,cz=abx*acy-aby*acx;
  const area=Math.hypot(cx,cy,cz);
  if(area<1e-10){degenerate++;continue;}
  const oabx=positions[oy]-positions[ox],
    oaby=positions[oy+1]-positions[ox+1],
    oabz=positions[oy+2]-positions[ox+2],
    oacx=positions[oz]-positions[ox],
    oacy=positions[oz+1]-positions[ox+1],
    oacz=positions[oz+2]-positions[ox+2];
  const originalNormal=[oaby*oacz-oabz*oacy,
    oabz*oacx-oabx*oacz,oabx*oacy-oaby*oacx];
  if(cx*originalNormal[0]+cy*originalNormal[1]+cz*originalNormal[2]<=0){
   inverted++;continue;
  }
  const key=[a,b,c].sort((x,y)=>x-y).join(',');
  if(unique.has(key)){duplicates++;continue;}
  unique.add(key);kept.push(a,b,c);
 }
 const outN=kept.length/3,sourceN=indices.length/3;
 if(outN<1000||outN>=sourceN*.8)
  throw Error('lod_insufficient_safe_decimation');
 const remap=new Map(),outIdx=new Uint32Array(kept.length),
  pp=[],tt=[],nn=[];
 for(let i=0;i<kept.length;i++){
  const orig=kept[i];let next=remap.get(orig);
  if(next===undefined){
   next=remap.size;remap.set(orig,next);const k=orig*8;
   pp.push(avg[k],avg[k+1],avg[k+2]);
   tt.push(avg[k+3],avg[k+4]);
   nn.push(avg[k+5],avg[k+6],avg[k+7]);
  }
  outIdx[i]=next;
 }
 const outPos=new Float32Array(pp),outUV=new Float32Array(tt),
  outNormal=new Float32Array(nn);
 const outJson=JSON.parse(JSON.stringify(json));
 const re={
  0:new Uint8Array(outIdx.buffer),
  1:new Uint8Array(outPos.buffer),
  2:bin.subarray(json.bufferViews[2].byteOffset,
    json.bufferViews[2].byteOffset+json.bufferViews[2].byteLength),
  3:bin.subarray(json.bufferViews[3].byteOffset,
    json.bufferViews[3].byteOffset+json.bufferViews[3].byteLength),
  4:new Uint8Array(outUV.buffer),
  5:new Uint8Array(outNormal.buffer),
 };
 const slices=[],binfo=[],align4=n=>(n+3)&~3;let pos=0;
 for(let i=0;i<json.bufferViews.length;i++){
  const data=re[i];if(!data)throw Error('lod_unknown_binary_view');
  pos=align4(pos);binfo.push({offset:pos,length:data.length});
  slices.push({offset:pos,bytes:data});pos+=data.length;
 }
 const binSize=align4(pos),newBin=new Uint8Array(binSize);
 for(const s of slices)newBin.set(s.bytes,s.offset);
 outJson.bufferViews.forEach((v,i)=>{
  v.byteOffset=binfo[i].offset;v.byteLength=binfo[i].length;
  delete v.byteStride;
 });
 outJson.buffers[0].byteLength=binSize;
 outJson.accessors[primitive.indices].count=outIdx.length;
 outJson.accessors[primitive.indices].min=[0];
 outJson.accessors[primitive.indices].max=[remap.size-1];
 const bounds=(values,stride)=>{
  const lo=new Array(stride).fill(Infinity),hi=new Array(stride).fill(-Infinity);
  for(let i=0;i<values.length;i+=stride)for(let j=0;j<stride;j++){
   lo[j]=Math.min(lo[j],values[i+j]);hi[j]=Math.max(hi[j],values[i+j]);
  }return {min:lo,max:hi};
 };
 for(const [accessor,values,stride] of [[p,outPos,3],[uv,outUV,2],[normal,outNormal,3]]){
  const i=json.accessors.indexOf(accessor);outJson.accessors[i].count=remap.size;
  Object.assign(outJson.accessors[i],bounds(values,stride));
 }
 const encoded=new TextEncoder().encode(JSON.stringify(outJson));
 const jsonSize=align4(encoded.length),fileSize=20+jsonSize+8+binSize;
 if(fileSize>35*1024*1024)throw Error('lod_output_size_exceeds_limit');
 const result=new Uint8Array(fileSize),v=new DataView(result.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);
 v.setUint32(8,fileSize,true);v.setUint32(12,jsonSize,true);
 v.setUint32(16,0x4e4f534a,true);result.fill(32,20,20+jsonSize);
 result.set(encoded,20);
 const off=20+jsonSize;v.setUint32(off,binSize,true);
 v.setUint32(off+4,0x004e4942,true);result.set(newBin,off+8);
 // Re-parse to ensure each output is a complete, self-contained GLB.
 const checked=decodePrivateGlb(result);
 if(checked.idx.count!==outIdx.length||checked.p.count!==remap.size||
    (checked.json.images||[]).length!==(json.images||[]).length)
   throw Error('lod_postvalidation_failed');
 for(const imageView of [2,3]){
  const a=bin.subarray(json.bufferViews[imageView].byteOffset,
   json.bufferViews[imageView].byteOffset+json.bufferViews[imageView].byteLength);
  const bv=checked.json.bufferViews[imageView];
  const b=checked.bin.subarray(bv.byteOffset,bv.byteOffset+bv.byteLength);
  if(a.length!==b.length||a.some((x,i)=>x!==b[i]))
   throw Error('lod_pbr_texture_corruption');
 }
 return {file:result,meta:{gridCells:grid,triangles:outN,vertices:remap.size,
  fileBytes:fileSize,sourceTriangles:sourceN,
  droppedDegenerates:degenerate,droppedInverted:inverted,
  droppedDuplicates:duplicates,embeddedWebpPreserved:true,
  topologyMethod:'spatial-uv-clustering-preview',
  rigReady:false,visualQA:false,published:false}};
}
