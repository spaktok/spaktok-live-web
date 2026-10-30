/** Pure, testable world-space centering for any private GLB.
 * Three.js scene hierarchy can contain nonzero root transforms. The
 * normalized preview wrapper keeps that hierarchy intact and rotates
 * around its REAL world-space bounding-box center.
 */
export type PreviewVec3=Readonly<{x:number;y:number;z:number}>
export function centeredPreviewTransform(
 center:PreviewVec3,size:PreviewVec3,displayExtent=2,
):Readonly<{scale:number;offset:PreviewVec3}>{
 if(!Number.isFinite(displayExtent)||displayExtent<=0||displayExtent>10)
  throw Error('studio_preview_display_extent_invalid')
 for(const p of [center,size])
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z))
   throw Error('studio_preview_nonfinite_extent')
 const longest=Math.max(size.x,size.y,size.z)
 if(longest<=1e-8||longest>1000||
  Math.min(size.x,size.y,size.z)<0)
  throw Error('studio_preview_invalid_bounds')
 const scale=displayExtent/longest
 return {
  scale,
  offset:{
   x:center.x===0?0:-center.x*scale,
   y:center.y===0?0:-center.y*scale,
   z:center.z===0?0:-center.z*scale,
  },
 }
}
