import type {DenseFaceTopology,FaceEdge} from './reality-face-topology'

export type FaceSemanticRegion =
 | 'lips'|'left_eye'|'right_eye'|'left_eyebrow'|'right_eyebrow'
 | 'left_iris'|'right_iris'|'face_oval'|'nose'|'forehead'
 | 'left_cheek'|'right_cheek'|'jaw'|'chin'
export type FaceRegionSource=Readonly<{
 lips:readonly FaceEdge[]
 leftEye:readonly FaceEdge[]
 rightEye:readonly FaceEdge[]
 leftEyebrow:readonly FaceEdge[]
 rightEyebrow:readonly FaceEdge[]
 leftIris:readonly FaceEdge[]
 rightIris:readonly FaceEdge[]
 faceOval:readonly FaceEdge[]
}>
export type FaceRegion=Readonly<{
 name:FaceSemanticRegion
 vertexIds:readonly number[]
 /** Indexed face mesh triangles touching this region. Iris only has points. */
 triangleIds:readonly number[]
 contourEdges:readonly FaceEdge[]
 approximate:boolean
}>
export type FaceSemanticAtlas=Readonly<Record<FaceSemanticRegion,FaceRegion>>

/** Expand a set of semantic landmarks through the real mesh adjacency. This
 * adds DENSITY to a region; it does NOT invent extra tracked landmark samples.
 */
export function expandFaceRegion(
 topology:DenseFaceTopology,
 seeds:readonly number[],
 rings:number,
):number[]{
 if(!Number.isInteger(rings)||rings<0||rings>8)throw Error('reality_bad_region_radius')
 const selected=new Set<number>()
 for(const v of seeds)if(Number.isSafeInteger(v)&&v>=0&&v<topology.vertexCount)
   selected.add(v)
 let frontier=Array.from(selected)
 for(let step=0;step<rings;step++){
  const next:number[]=[]
  for(const vertex of frontier){
   for(const neighbor of topology.neighbors[vertex]){
    if(!selected.has(neighbor)){
     selected.add(neighbor);next.push(neighbor)
    }
   }
  }
  frontier=next
 }
 return Array.from(selected).sort((a,b)=>a-b)
}

const EXTRA:Readonly<Record<'nose'|'forehead'|'left_cheek'|'right_cheek'|'jaw'|'chin',
 {seeds:readonly number[];rings:number}>>={
 nose:{seeds:[1,4,6,168,197,195,5,98,327],rings:1},
 forehead:{seeds:[10,9,108,337,109,338,151],rings:2},
 left_cheek:{seeds:[50,101,205,117,123],rings:2},
 right_cheek:{seeds:[280,330,425,346,352],rings:2},
 jaw:{seeds:[234,93,132,58,172,152,397,288,361,323,454],rings:1},
 chin:{seeds:[152,148,176,149,150,377,378,400],rings:1},
}

export function createFaceSemanticAtlas(
 topology:DenseFaceTopology,source:FaceRegionSource,
):FaceSemanticAtlas{
 const definitions:Readonly<Record<FaceSemanticRegion,{
  edges:readonly FaceEdge[];seeds:readonly number[];rings:number;approximate:boolean
 }>>={
  lips:{edges:source.lips,seeds:[],rings:0,approximate:false},
  left_eye:{edges:source.leftEye,seeds:[],rings:0,approximate:false},
  right_eye:{edges:source.rightEye,seeds:[],rings:0,approximate:false},
  left_eyebrow:{edges:source.leftEyebrow,seeds:[],rings:0,approximate:false},
  right_eyebrow:{edges:source.rightEyebrow,seeds:[],rings:0,approximate:false},
  left_iris:{edges:source.leftIris,seeds:[],rings:0,approximate:false},
  right_iris:{edges:source.rightIris,seeds:[],rings:0,approximate:false},
  face_oval:{edges:source.faceOval,seeds:[],rings:0,approximate:false},
  nose:{edges:[],...EXTRA.nose,approximate:true},
  forehead:{edges:[],...EXTRA.forehead,approximate:true},
  left_cheek:{edges:[],...EXTRA.left_cheek,approximate:true},
  right_cheek:{edges:[],...EXTRA.right_cheek,approximate:true},
  jaw:{edges:[],...EXTRA.jaw,approximate:true},
  chin:{edges:[],...EXTRA.chin,approximate:true},
 }
 const atlas={} as Record<FaceSemanticRegion,FaceRegion>
 for(const [name,item] of Object.entries(definitions) as [FaceSemanticRegion,typeof definitions[FaceSemanticRegion]][]){
  const seeds=[...item.seeds,...item.edges.flatMap(e=>[e.start,e.end])]
  const ids=expandFaceRegion(topology,seeds,item.rings)
  const tris=new Set<number>()
  for(const id of ids)for(const tri of topology.triangleIdsByVertex[id])
    tris.add(tri)
  atlas[name]={
   name,vertexIds:ids,triangleIds:Array.from(tris).sort((a,b)=>a-b),
   contourEdges:item.edges,
   approximate:item.approximate,
  }
 }
 return atlas
}
