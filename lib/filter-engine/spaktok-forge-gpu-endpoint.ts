/** Exact origin-pinned browser-direct GPU endpoints.
 * NEVER allow arbitrary hosts/ports; the operator must configure the exact
 * TLS host separately from each request. A Vast quick tunnel is disposable
 * and MUST point to the dedicated Forge API port (not the Jupyter portal).
 */
export type ForgeGpuProvider='runpod'|'vast-quick-tunnel'
export function isForgeGpuEndpoint(urlText:string,host:string,provider:string):boolean{
 if(host!==host.toLowerCase()||host.length>253)return false
 try{
  const url=new URL(urlText)
  if(url.protocol!=='https:'||url.hostname!==host||
   url.port||url.username||url.password||url.search||url.hash||
   url.pathname!=='/v1/generate')return false
  if(provider==='runpod')
   return /^[a-z0-9-]+-8000\.proxy\.runpod\.net$/.test(host)
  if(provider==='vast-quick-tunnel')
   return /^[a-z0-9]+(?:-[a-z0-9]+){2,}\.trycloudflare\.com$/.test(host)
  return false
 }catch{return false}
}
