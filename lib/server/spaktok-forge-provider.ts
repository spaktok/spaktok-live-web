/** Strict provider and engine selection; never read upstream URLs from clients. */
import {isIP} from 'node:net'
import {parseForgeDailyJobLimit} from './spaktok-forge-budget'

export type ForgeGpuEngine='stable-fast-3d'|'trellis-v1'|'trellis2'
export type ForgeGpuProvider='runpod'|'vast'
export interface ForgeGpuBackend {
 url:string
 token:string
 globalCap:number
 engine:ForgeGpuEngine
 provider:ForgeGpuProvider
}
export function resolveForgeGpuBackend(
 env:Record<string,string|undefined>,origin:string,
):ForgeGpuBackend|null{
 if(env.SPAKTOK_FORGE_GPU_ENABLED!=='true'||
  env.SPAKTOK_FORGE_GPU_DIRECT_ENABLED!=='true')return null
 const globalCap=parseForgeDailyJobLimit(env.SPAKTOK_FORGE_GPU_DAILY_LIMIT)
 if(globalCap===null)return null
 const expectedOrigin=env.SPAKTOK_FORGE_GPU_BROWSER_ORIGIN??''
 const host=env.SPAKTOK_FORGE_GPU_HOST??''
 const rawUrl=env.SPAKTOK_FORGE_GPU_URL??''
 const token=env.SPAKTOK_FORGE_GPU_TOKEN??''
 const provider=env.SPAKTOK_FORGE_GPU_PROVIDER??'runpod'
 const engine=env.SPAKTOK_FORGE_GPU_ENGINE??'stable-fast-3d'
 if((provider!=='runpod'&&provider!=='vast')||
  (engine!=='stable-fast-3d'&&engine!=='trellis-v1'&&engine!=='trellis2')||
  !expectedOrigin||expectedOrigin!==origin||
  !rawUrl||!host||token.length<32)return null
 try{
  const url=new URL(rawUrl)
  const ownOrigin=new URL(expectedOrigin)
  if(ownOrigin.protocol!=='https:'||ownOrigin.origin!==expectedOrigin||
   url.protocol!=='https:'||url.hostname!==host||
   url.port||url.username||url.password||url.hash||url.search||
   url.pathname!=='/v1/generate'||isIP(host)!==0||
   !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host)||
   /\.(?:localhost|local|internal|test|invalid|example|onion)$/i.test(host))
   return null
  if(provider==='runpod'){
   if(!host.endsWith('.proxy.runpod.net'))return null
  }else{
   // Vast GPU must be reachable ONLY through an operator-owned HTTPS
   // tunnel hostname, pinned independently from the endpoint URL.
   // No raw mapped HTTP IP:port, quick tunnel URL or user URL allowed.
   const pinned=env.SPAKTOK_FORGE_GPU_VAST_HOSTNAME??''
   if(!['trellis-v1','trellis2'].includes(engine)||pinned!==host||host.endsWith('.proxy.runpod.net')||
    host.endsWith('.trycloudflare.com')||host==='trycloudflare.com')
    return null
  }
  return {url:url.toString(),token,globalCap,provider,engine}
 }catch{return null}
}
