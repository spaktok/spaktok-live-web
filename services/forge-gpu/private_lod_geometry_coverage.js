/** CPU-only approximate geometric coverage for the PRIVATE first TRELLIS.2
 * real R2 LOD0/1/2. No GPU or image uploads. This IS NOT render fidelity,
 * silhouette similarity or surface Hausdorff distance; it is vertex sampling.
 *
 * Do not threshold on this to authorize live/AR use. Actual topology audit,
 * visual inspection and Android device performance remain required.
 */
function readGlbMeshPositions(file){
 if(!(file instanceof Uint8Array)||file.length<28||file.length>35*1024*1024)
  throw Error('invalid_private_lod_bytes')
 const v=new DataView(file.buffer,file.byteOffset,file.byteLength);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||
    v.getUint32(8,true)!==file.byteLength||v.getUint32(16,true)!==0x4e4f534a)
  throw Error('invalid_glb_header');
 const jsonLen=v.getUint32(12,true),off=20+jsonLen;
 if(jsonLen%4||jsonLen<16||off+8>file.length||
    v.getUint32(off+4,true)!==0x004e4942)throw Error('invalid_glb_chunks');
 const doc=JSON.parse(new TextDecoder().decode(file.subarray(20,off)));
 const mesh=doc.meshes?.[0]?.primitives?.[0];
 const accessor=doc.accessors?.[mesh?.attributes?.POSITION],bv=doc.bufferViews?.[accessor?.bufferView];
 if(doc.meshes?.length!==1||doc.meshes[0].primitives.length!==1||
    accessor?.type!=='VEC3'||accessor?.componentType!==5126||
    !Number.isSafeInteger(accessor?.count)||accessor.count<3||
    bv?.buffer!==0||bv?.byteStride||
    bv.byteLength<accessor.count*12)throw Error('unsupported_glb_positions');
 const binaryLen=v.getUint32(off,true),binaryStart=off+8;
 const start=binaryStart+(bv.byteOffset||0)+(accessor.byteOffset||0);
 if(start+accessor.count*12>binaryStart+binaryLen||start%4)
  throw Error('position_binary_out_of_bounds');
 const points=new Float32Array(file.buffer,file.byteOffset+start,accessor.count*3);
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<points.length;i+=3)for(let c=0;c<3;c++){
  const p=points[i+c];
  if(!Number.isFinite(p))throw Error('nonfinite_vertex')
  if(p<low[c])low[c]=p;if(p>high[c])high[c]=p
 }
 return {points,count:accessor.count,low,high};
}
function comparePrivateLodVertices(original,lod){
 // Fixed reproducible 4k samples per direction (deterministic stride).
 const diag=Math.hypot(...original.low.map((x,i)=>original.high[i]-x));
 if(!(diag>0))throw Error('zero_extent_model');
 const cell=diag/48;
 const key=(x,y,z)=>x+','+y+','+z;
 const nearest=(source,target)=>{
  const grid=new Map(),p=target.points;
  for(let i=0;i<target.count;i++){
   const k=i*3,x=Math.floor(p[k]/cell),y=Math.floor(p[k+1]/cell),
        z=Math.floor(p[k+2]/cell),id=key(x,y,z);
   let list=grid.get(id);if(!list){list=[];grid.set(id,list)}
   list.push(i)
  }
  const step=Math.max(1,Math.ceil(source.count/4000)),dist=[];
  for(let j=0;j<source.count;j+=step){
   const k=j*3,point=[source.points[k],source.points[k+1],source.points[k+2]],
     q=point.map(v=>Math.floor(v/cell));
   let best=Infinity;
   for(let radius=0;radius<=6;radius++){
    for(let x=-radius;x<=radius;x++)for(let y=-radius;y<=radius;y++)
    for(let z=-radius;z<=radius;z++){
     if(radius>0&&Math.max(Math.abs(x),Math.abs(y),Math.abs(z))!==radius)
      continue
     const entries=grid.get(key(q[0]+x,q[1]+y,q[2]+z));
     if(!entries)continue
     for(const index of entries){
      const t=index*3,
       dx=point[0]-p[t],dy=point[1]-p[t+1],dz=point[2]-p[t+2],
       d=dx*dx+dy*dy+dz*dz;
      if(d<best)best=d;
     }
    }
    // If a closer point could exist in the next cell, continue checking
    // rather than incorrectly returning the first non-empty cell.
    if(best!==Infinity&&Math.sqrt(best)<radius*cell)break;
   }
   if(best===Infinity)
    throw Error('nearest_point_outside_bounded_search')
   dist.push(Math.sqrt(best)/diag);
  }
  dist.sort((a,b)=>a-b);
  const sum=dist.reduce((a,b)=>a+b,0);
  return {sampled:dist.length,meanDiagonalFraction:sum/dist.length,
   p95DiagonalFraction:dist[Math.floor((dist.length-1)*.95)],
   maxDiagonalFraction:dist[dist.length-1]};
 };
 const forward=nearest(original,lod),reverse=nearest(lod,original);
 const bbox=lod.low.map((x,i)=>({
  minAbsoluteDrift:Math.abs(x-original.low[i]),
  maxAbsoluteDrift:Math.abs(lod.high[i]-original.high[i]),
 }));
 return {originalVertices:original.count,lodVertices:lod.count,
  originalToLod:forward,lodToOriginal:reverse,bboxDrift:bbox,
  method:'bounded-voxel-vertex-nearest-4k-samples-both-directions',
  limitations:'Vertex-to-vertex proxy; not surface Hausdorff, visual fidelity, texture QA or final topology',
  passForPublication:false};
}
