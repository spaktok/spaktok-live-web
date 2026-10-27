/**
 * Dense topology for MediaPipe's FaceLandmarker tesselation.
 * 478 detected points may include ten iris landmarks; the face triangulation
 * itself is a 468-point surface. Do not fabricate a metric head mesh.
 */
export const FACE_LANDMARK_COUNT = 478
export const FACE_SURFACE_VERTEX_COUNT = 468
export type FaceEdge = Readonly<{start:number;end:number}>
export type FaceTriangle = readonly [number,number,number]
export type DenseFaceTopology=Readonly<{
  vertexCount:number
  triangleCount:number
  /** Winding preserved EXACTLY from MediaPipe's 3 directed edges per face. */
  indices:Uint16Array
  triangles:readonly FaceTriangle[]
  neighbors:readonly (readonly number[])[]
  triangleIdsByVertex:readonly (readonly number[])[]
}>

/** MediaPipe emits each tessellation triangle as three ordered directed
 * connections: (a,b), (b,c), (c,a). Preserving winding prevents unreliable
 * normals from arbitrary alphabetically sorted triangle reconstruction.
 */
export function createDenseFaceTopology(edges:readonly FaceEdge[],vertexCount=FACE_LANDMARK_COUNT):DenseFaceTopology{
  if(!Number.isSafeInteger(vertexCount)||vertexCount<3||vertexCount>65535||
     edges.length===0||edges.length%3!==0)throw Error('reality_invalid_topology')
  const seen=new Set<string>()
  const triangles:FaceTriangle[]=[]
  const neighbors=Array.from({length:vertexCount},()=>new Set<number>())
  const triangleIds=Array.from({length:vertexCount},()=>[] as number[])
  for(let i=0;i<edges.length;i+=3){
    const first=edges[i],second=edges[i+1],third=edges[i+2]
    const a=first.start,b=first.end,c=second.end
    if(second.start!==b||third.start!==c||third.end!==a||
       ![a,b,c].every(n=>Number.isSafeInteger(n)&&n>=0&&n<vertexCount)||
       a===b||b===c||c===a)throw Error('reality_corrupt_triangle')
    const key=[a,b,c].sort((x,y)=>x-y).join(':')
    if(seen.has(key))throw Error('reality_duplicate_triangle')
    seen.add(key)
    const id=triangles.length
    triangles.push([a,b,c])
    triangleIds[a].push(id);triangleIds[b].push(id);triangleIds[c].push(id)
    neighbors[a].add(b);neighbors[a].add(c)
    neighbors[b].add(a);neighbors[b].add(c)
    neighbors[c].add(a);neighbors[c].add(b)
  }
  const indices=new Uint16Array(triangles.length*3)
  for(let i=0;i<triangles.length;i++)indices.set(triangles[i],i*3)
  return {
    vertexCount,
    triangleCount:triangles.length,
    indices,triangles,
    neighbors:neighbors.map(s=>Array.from(s).sort((a,b)=>a-b)),
    triangleIdsByVertex:triangleIds,
  }
}

/** Per-frame validation avoids attaching old meshes to broken landmark sets.
 * A failed frame is hidden rather than extrapolated into user content.
 */
export function isDenseFaceFrame(landmarks:ReadonlyArray<Readonly<{x:number;y:number;z?:number}>>){
 if(landmarks.length<FACE_LANDMARK_COUNT)return false
 for(let i=0;i<FACE_LANDMARK_COUNT;i++){
  const p=landmarks[i]
  if(!p||![p.x,p.y,p.z??0].every(Number.isFinite))return false
 }
 return true
}
