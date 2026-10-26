import {
  assertRealityEffect,
  type RealityEffectManifest,
} from './reality-effect-manifest'

/** Asset-loader boundary for the AR runtime. No arbitrary remote fetches,
 * evaluation, plugins or user-supplied shader code.
 * The caller owns geometry/material disposal on effect replacement.
 */
export interface RealityEffectLoader<Node> {
  loadAuthoredGLB(uri:string):Promise<Node>
  createProceduralPreview(effect:RealityEffectManifest):Node
  calibrateAuthored(node:Node,effect:RealityEffectManifest):void
  /** Optional cleanup after calibration fails to avoid leaking GPU assets. */
  disposeFailedAuthored?(node:Node):void
}
export type RealityEffectInstance<Node>=Readonly<{
  node:Node
  quality:'hd'|'fallback'
  source:'authored-glb'|'procedural-preview'|'tracked-surface'
  definition:RealityEffectManifest
}>

/** Generic across every wearable + all current face-surface looks.
 * 2D/post/color/background effects are registered in the manifest but remain
 * handled by the existing camera shader or tracked face-surface pass.
 */
export class RealityEffectRuntime<Node> {
  constructor(private readonly loader:RealityEffectLoader<Node>){}
  async instantiate(effect:RealityEffectManifest):Promise<RealityEffectInstance<Node>>{
    assertRealityEffect(effect)
    if(!['wearable-3d','expression-3d','face-surface'].includes(effect.kind))
      throw Error('reality_not_a_3d_effect:'+effect.id)
    if(effect.kind==='face-surface')
      return {node:this.loader.createProceduralPreview(effect),quality:'fallback',
        source:'tracked-surface',definition:effect}
    if(effect.asset){
      let loaded:Node|undefined
      try{
        loaded=await this.loader.loadAuthoredGLB(effect.asset.uri)
        this.loader.calibrateAuthored(loaded,effect)
        return {node:loaded,quality:'hd',source:'authored-glb',definition:effect}
      }catch{
        // Free partially loaded assets if calibration rejects the GLB;
        // never leave GPU allocations behind when falling back.
        if(loaded!==undefined)this.loader.disposeFailedAuthored?.(loaded)
      }
    }
    return {node:this.loader.createProceduralPreview(effect),quality:'fallback',
      source:'procedural-preview',definition:effect}
  }
}
