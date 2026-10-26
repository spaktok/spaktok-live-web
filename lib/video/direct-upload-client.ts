/** Upload captured video bytes directly to the private R2 Worker.
 * Vercel never receives file bytes. All URLs are validated before use. */
export async function uploadVideoDirect(
 uploadURL:string,
 blob:Blob,
 onProgress:(percent:number)=>void,
 signal?:AbortSignal,
):Promise<void>{
 const url=new URL(uploadURL)
 if(url.protocol!=='https:'||url.hostname!=='spaktok-media-upload.spaktok.workers.dev'||
   url.pathname!=='/upload'||url.username||url.password)throw new Error('invalid_upload_url')
 if(signal?.aborted)throw new Error('upload_cancelled')
 return new Promise<void>((resolve,reject)=>{
  const xhr=new XMLHttpRequest()
  let done=false
  const cancel=()=>xhr.abort()
  const finish=(error?:Error)=>{
   if(done)return
   done=true
   signal?.removeEventListener('abort',cancel)
   if(error)reject(error)
   else resolve()
  }
  xhr.open('PUT',url.toString())
  xhr.timeout=300000
  xhr.setRequestHeader('Content-Type',blob.type.split(';')[0]||'video/webm')
  xhr.upload.onprogress=e=>{
   if(e.lengthComputable&&e.total>0)onProgress(Math.min(100,Math.round(e.loaded/e.total*100)))
  }
  xhr.onload=()=>finish(xhr.status>=200&&xhr.status<300?undefined:new Error('upload_failed'))
  xhr.onerror=()=>finish(new Error('network_error'))
  xhr.ontimeout=()=>finish(new Error('timeout'))
  xhr.onabort=()=>finish(new Error('upload_cancelled'))
  signal?.addEventListener('abort',cancel,{once:true})
  xhr.send(blob)
 })
}
