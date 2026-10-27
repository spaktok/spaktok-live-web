/** Deterministic render order for SpakTok AR, inspired by documented
 * render-group concepts, but implemented with one GPU scene/context.
 * This is an execution plan, not a claim that we have ten physical cameras.
 */
export type RealityRenderStage =
 | 'camera-background' | 'beauty-and-color' | 'face-depth'
 | 'tracked-objects' | 'hand-foreground' | 'post-and-output'
export type RealityRenderNode = Readonly<{
 id:string
 stage:RealityRenderStage
 needs:readonly string[]
 enabled:boolean
}>
const PRIORITY:Readonly<Record<RealityRenderStage,number>>={
 'camera-background':0,'beauty-and-color':10,'face-depth':20,
 'tracked-objects':30,'hand-foreground':40,'post-and-output':50,
}
export function compileRealityRenderGraph(nodes:readonly RealityRenderNode[]):readonly RealityRenderNode[]{
 const all=new Map<string,RealityRenderNode>()
 for(const node of nodes){
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(node.id)||all.has(node.id)||
   !Object.hasOwn(PRIORITY,node.stage))throw Error('reality_invalid_render_node')
  all.set(node.id,node)
 }
 const sorted=nodes.filter(n=>n.enabled).slice().sort(
  (a,b)=>PRIORITY[a.stage]-PRIORITY[b.stage]||a.id.localeCompare(b.id)
 )
 const active=new Set(sorted.map(n=>n.id)),done=new Set<string>()
 for(const item of sorted){
  for(const dep of item.needs){
   const requirement=all.get(dep)
   if(!requirement||!active.has(dep)||!done.has(dep))
    throw Error('reality_render_dependency:'+item.id+':'+dep)
  }
  done.add(item.id)
 }
 return sorted
}
export function planRealityRenderGraph(opts:Readonly<{
 gpuV2:boolean;face:boolean;handOcclusion:boolean;post:boolean
}>):readonly RealityRenderNode[]{
 const nodes:RealityRenderNode[]=[
  {id:'camera',stage:'camera-background',needs:[],enabled:true},
  {id:'beauty',stage:'beauty-and-color',needs:['camera'],enabled:true},
  {id:'depth',stage:'face-depth',needs:['beauty'],enabled:opts.face},
  {id:'ar',stage:'tracked-objects',needs:[opts.face?'depth':'beauty'],enabled:opts.face},
  {id:'hands',stage:'hand-foreground',needs:['ar'],enabled:opts.face&&opts.gpuV2&&opts.handOcclusion},
  {id:'output',stage:'post-and-output',needs:[opts.face?(opts.gpuV2&&opts.handOcclusion?'hands':'ar'):'beauty'],enabled:true},
 ]
 // Stage order is stable; optional post effects are applied by the existing
 // camera shader until the full post-FX node migration is complete.
 void opts.post
 return compileRealityRenderGraph(nodes)
}
