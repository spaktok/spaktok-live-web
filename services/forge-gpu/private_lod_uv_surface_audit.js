/**
 * PRIVATE owner-only offline GLB UV/geometry health audit.
 * Computes actual UV triangle degeneracy, 3D surface area and UV windings.
 * No model uploads, GPU, network, rendering or publication.
 *
 * UV-positive vs negative is not inherently an error: mirrored UV islands
 * are legitimate. 3D area and UV area are *proxies*, not visual QA.
 */
function auditPrivateGlbUvSurface(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<28||bytes.length>35*1024*1024)
  throw Error('private_uv_audit_invalid_bytes')
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||
  v.getUint32(8,true)!==bytes.length||v.getUint32(16,true)!==0x4e4f534a)
  throw Error('private_uv_audit_invalid_glb')
 const jl=v.getUint32(12,true),start=20+jl;
 if(jl%4||jl<16||start+8>bytes.length||
    v.getUint32(start+4,true)!==0x004e4942)
  throw Error('private_uv_audit_invalid_chunks')
 const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,start)))
 const p=json.meshes?.[0]?.primitives?.[0],a=json.accessors,vw=json.bufferViews,
       binarySize=v.getUint32(start,true),binary=start+8;
 if(json.meshes?.length!==1||json.meshes[0].primitives.length!==1||
  (p?.mode??4)!==4||!a||!vw||
  !json.buffers||json.buffers.length!==1||json.buffers[0]?.uri||
  binary+binarySize>bytes.length)throw Error('private_uv_audit_unsupported_glb')
 const get=(id,components,datatype)=>{
  const acc=a[id],b=vw[acc?.bufferView],off=(b?.byteOffset??0)+(acc?.byteOffset??0),
        width=datatype===5125?4:datatype===5123?2:datatype===5126?4:0;
  if(!b||acc.type!==({1:'SCALAR',2:'VEC2',3:'VEC3'})[components]||
   acc.componentType!==datatype||!Number.isSafeInteger(acc.count)||acc.count<3||
   b.buffer!==0||b.byteStride||acc.sparse||!width||
   !Number.isSafeInteger(b.byteLength)||off<0||
   (acc.byteOffset||0)+acc.count*components*width>b.byteLength||
   off+acc.count*components*width>binarySize||
   (binary+off)%width)throw Error('private_uv_audit_invalid_accessor')
  const absolute=bytes.byteOffset+binary+off,len=acc.count*components;
  return {count:acc.count,data:datatype===5123?
   new Uint16Array(bytes.buffer,absolute,len):datatype===5125?
   new Uint32Array(bytes.buffer,absolute,len):
   new Float32Array(bytes.buffer,absolute,len)}
 }
 const ix=get(p.indices,1,5125),pos=get(p.attributes.POSITION,3,5126),
       uv=get(p.attributes.TEXCOORD_0,2,5126);
 if(ix.count%3||pos.count!==uv.count||ix.count>500000)
  throw Error('private_uv_audit_bad_counts')
 const pt=pos.data,u=uv.data,ids=ix.data;
 let threeDimArea=0,uvArea=0,uvCollapsed=0,threeDimCollapsed=0,
     uvOutOfRange=0,windingPositive=0,windingNegative=0;
 let boundsMin=[Infinity,Infinity,Infinity],boundsMax=[-Infinity,-Infinity,-Infinity];
 for(let k=0;k<pt.length;k+=3)for(let c=0;c<3;c++){
  const value=pt[k+c]
  if(!Number.isFinite(value))throw Error('private_uv_audit_nonfinite_position')
  boundsMin[c]=Math.min(boundsMin[c],value);boundsMax[c]=Math.max(boundsMax[c],value)
 }
 const diagonal=Math.hypot(...boundsMin.map((x,i)=>boundsMax[i]-x))
 if(!Number.isFinite(diagonal)||diagonal<1e-8)throw Error('private_uv_audit_no_extent')
 const tiny3d=diagonal*diagonal*1e-11
 for(let i=0;i<ids.length;i+=3){
  const ai=ids[i],bi=ids[i+1],ci=ids[i+2]
  if(ai>=pos.count||bi>=pos.count||ci>=pos.count)throw Error('private_uv_audit_bad_index')
  const ak=ai*3,bk=bi*3,ck=ci*3;
  const abx=pt[bk]-pt[ak],aby=pt[bk+1]-pt[ak+1],abz=pt[bk+2]-pt[ak+2],
   acx=pt[ck]-pt[ak],acy=pt[ck+1]-pt[ak+1],acz=pt[ck+2]-pt[ak+2];
  const area3d=Math.hypot(aby*acz-abz*acy,abz*acx-abx*acz,
   abx*acy-aby*acx)*.5;
  if(area3d<=tiny3d)threeDimCollapsed++
  threeDimArea+=area3d
  const x=ai*2,y=bi*2,z=ci*2;
  const values=[u[x],u[x+1],u[y],u[y+1],u[z],u[z+1]]
  if(!values.every(Number.isFinite))throw Error('private_uv_audit_nonfinite_uv')
  uvOutOfRange+=Number(values.some(q=>q<-.001||q>1.001))
  const signed=((u[y]-u[x])*(u[z+1]-u[x+1])-
   (u[y+1]-u[x+1])*(u[z]-u[x]))*.5
  uvArea+=Math.abs(signed)
  if(Math.abs(signed)<=1e-10)uvCollapsed++
  else if(signed>0)windingPositive++
  else windingNegative++
 }
 return {
  schema:'spaktok-private-uv-surface-audit-v1',
  triangles:ids.length/3,vertices:pos.count,
  uvCollapsedTriangles:uvCollapsed,geometryTinyTriangles:threeDimCollapsed,
  uvCoordinatesOutsideUnitRangeTriangles:uvOutOfRange,
  uvWindingPositive:windingPositive,uvWindingNegative:windingNegative,
  triangle3DSurfaceArea:threeDimArea,triangleUVArea:uvArea,
  sourceDiagonal:diagonal,
  uvCollapsedFraction:uvCollapsed/(ids.length/3),
  geometryTinyFraction:threeDimCollapsed/(ids.length/3),
  untested:['rendered_texture_fidelity','uv_seam_visual_artifacts',
   'surface_correspondence','android_fps','rigging','rights_review'],
  approvedForLive:false,
 }
}
