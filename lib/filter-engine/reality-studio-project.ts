/** SpakTok Reality Studio V2 project contract.
 * Deterministic data, no arbitrary shaders/JavaScript/network execution.
 * Draft != approval; creators cannot mark unlicensed content as published.
 */
export const REALITY_PROJECT_VERSION=2 as const
export type RealitySceneKind=
 'camera'|'face-tracker'|'hand-tracker'|'face-morph'|'model-3d'|
 'directional-light'|'material'|'post-fx'
export type RealitySceneNode=Readonly<{
 id:string;kind:RealitySceneKind;name:string
 parentId:string|null;enabled:boolean
 position:readonly [number,number,number]
 rotation:readonly [number,number,number]
 scale:readonly [number,number,number]
}>
export type RealityEvent='smile'|'blink'|'hand-pinch'|'hand-release'|'head-turn'
export type RealityAction='rotate'|'scale'|'show'|'hide'
export type RealityEventLink=Readonly<{
 id:string;event:RealityEvent
 targetId:string;action:RealityAction
 amount:number;durationMs:number
}>
export type RealityKeyframe=Readonly<{timeMs:number;value:number}>
export type RealityTimelineTrack=Readonly<{
 targetId:string;property:'rotation-z'|'scale'|'opacity'
 keyframes:readonly RealityKeyframe[]
}>
export type RealityProjectV2=Readonly<{
 format:'SpakTokRealityProject'
 version:2;id:string;name:string
 nodes:readonly RealitySceneNode[]
 links:readonly RealityEventLink[]
 timeline:readonly RealityTimelineTrack[]
 assetSource:'local-only'|'private-r2'|'approved-library'
 rights:'unverified'|'original'|'licensed'
 review:'draft'|'submitted'
}>
const ID=/^[a-z][a-z0-9-]{0,39}$/
const safeVec=(a:readonly number[],limit:number)=>{
 return a.length===3&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<=limit)
}
export function validateRealityProject(value:RealityProjectV2):void{
 if(value.version!==2||value.format!=='SpakTokRealityProject'||
    !ID.test(value.id)||!value.name.trim()||value.name.length>90||
    value.nodes.length<1||value.nodes.length>48||
    value.links.length>80||value.timeline.length>48)
  throw Error('reality_project_invalid_manifest')
 const map=new Map<string,RealitySceneNode>()
 for(const n of value.nodes){
  if(!ID.test(n.id)||map.has(n.id)||!n.name.trim()||
   !safeVec(n.position,50)||!safeVec(n.rotation,Math.PI*20)||
   !safeVec(n.scale,100)||n.scale.some(s=>s<=0))
    throw Error('reality_project_invalid_node')
  map.set(n.id,n)
 }
 for(const node of value.nodes){
  const ancestors=new Set([node.id]);let parent=node.parentId
  while(parent!==null){
   if(ancestors.has(parent)||!map.has(parent))
    throw Error('reality_project_bad_hierarchy')
   ancestors.add(parent)
   parent=map.get(parent)!.parentId
  }
 }
 const keys=new Set<string>()
 for(const link of value.links){
  if(!ID.test(link.id)||keys.has(link.id)||!map.has(link.targetId)||
   !['smile','blink','hand-pinch','hand-release','head-turn'].includes(link.event)||
   !['rotate','scale','show','hide'].includes(link.action)||
   !Number.isFinite(link.amount)||Math.abs(link.amount)>6.28||
   !Number.isSafeInteger(link.durationMs)||link.durationMs<0||link.durationMs>10000)
    throw Error('reality_project_invalid_graph')
  keys.add(link.id)
 }
 for(const t of value.timeline){
  if(!map.has(t.targetId)||t.keyframes.length>100||
    t.keyframes.length<2)
    throw Error('reality_project_invalid_timeline')
  let time=-1
  for(const f of t.keyframes){
   if(!Number.isSafeInteger(f.timeMs)||f.timeMs<=time||
    f.timeMs>60000||!Number.isFinite(f.value)||Math.abs(f.value)>10)
    throw Error('reality_project_invalid_timeline')
   time=f.timeMs
  }
 }
 if(!['local-only','private-r2','approved-library'].includes(value.assetSource)||
   !['unverified','original','licensed'].includes(value.rights)||
   !['draft','submitted'].includes(value.review))
  throw Error('reality_project_invalid_rights')
 if(value.review==='submitted'&&value.rights==='unverified')
  throw Error('reality_project_rights_required')
}
/** Only a review candidate: approval and distribution are server-controlled. */
export function realityProjectReview(value:RealityProjectV2){
 validateRealityProject(value)
 const warnings:string[]=[]
 if(value.rights==='unverified')warnings.push('missing_asset_rights')
 if(value.assetSource==='local-only')warnings.push('no_approved_asset_distribution')
 if(value.nodes.filter(n=>n.kind==='model-3d').length>4)
  warnings.push('mobile_draw_call_budget')
 if(!value.nodes.some(n=>n.kind==='camera'))
  warnings.push('no_camera_node')
 if(!value.nodes.some(n=>n.kind==='face-tracker'))
  warnings.push('no_face_tracker')
 return {canSubmit:warnings.length===0,warnings,
   published:false as const,needsMobileQa:true as const}
}
export function createRealityProject():RealityProjectV2{
 const at=(id:string,kind:RealitySceneKind,parentId:string|null):RealitySceneNode=>({
  id,kind,name:id,parentId,enabled:true,
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
 })
 return {
  format:'SpakTokRealityProject',version:2,id:'my-reality-project',
  name:'SpakTok Reality Project',rights:'unverified',
  assetSource:'local-only',review:'draft',
  nodes:[
   at('camera','camera',null),
   at('face-tracker','face-tracker','camera'),
   at('face-morph','face-morph','face-tracker'),
   at('hand-tracker','hand-tracker','camera'),
   at('light','directional-light','camera'),
  ],
  links:[],timeline:[],
 }
}
export function runRealityEvent(
 project:RealityProjectV2,event:RealityEvent,
):ReadonlyArray<RealityEventLink>{
 validateRealityProject(project)
 return project.links.filter(x=>x.event===event)
}
/** Deterministic keyframe interpolation for authoring preview, no eval. */
export function sampleRealityTrack(track:RealityTimelineTrack,timeMs:number){
 if(!Number.isFinite(timeMs)||!track.keyframes.length)return 0
 const frames=track.keyframes
 if(timeMs<=frames[0].timeMs)return frames[0].value
 for(let i=1;i<frames.length;i++){
  if(timeMs<=frames[i].timeMs){
   const a=frames[i-1],b=frames[i]
   const t=(timeMs-a.timeMs)/(b.timeMs-a.timeMs)
   const smooth=t*t*(3-2*t)
   return a.value+(b.value-a.value)*smooth
  }
 }
 return frames[frames.length-1].value
}
