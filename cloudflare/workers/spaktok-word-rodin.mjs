// Spaktok Word - private Rodin job coordinator for Cloudflare Workers
// Deployment is deliberately NOT automatic. Paid jobs require an operator-approved
// fixed credit quote, an API secret, a private R2 bucket and a bound D1 DB/Queue.
const BASE='https://api.hyper3d.com/api/v2'
const IDENT=/^[a-f0-9-]{36}$/i
const SHA=/^[a-f0-9]{64}$/i
const MB=8*1024*1024
const json=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json','cache-control':'private,no-store',
  'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'},
})
const hex=a=>Array.from(new Uint8Array(a)).map(v=>v.toString(16).padStart(2,'0')).join('')
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+
  '='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))
async function verify(req,env,path,bodyHash=''){
 const owner=req.headers.get('x-word-owner')||''
 const expires=req.headers.get('x-word-expires')||''
 const info=req.headers.get('x-word-info')||''
 const sig=req.headers.get('x-word-signature')||''
 if(!IDENT.test(owner)||!/^\d{10}$/.test(expires)||
  Math.abs(Number(expires)-Math.floor(Date.now()/1000))>100||
  info.length>3000||!SHA.test(bodyHash||'0'.repeat(64))||
  !/^[a-f0-9]{64}$/.test(sig)||!env.WORD_SIGNING_SECRET)return null
 const message=[req.method,path,owner,expires,bodyHash,info].join('\n')
 const key=await crypto.subtle.importKey('raw',
  new TextEncoder().encode(env.WORD_SIGNING_SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['verify'])
 const ok=await crypto.subtle.verify('HMAC',key,
  Uint8Array.from(sig.match(/.{2}/g),b=>parseInt(b,16)),
  new TextEncoder().encode(message))
 if(!ok)return null
 let metadata={}
 if(info){
  try{metadata=JSON.parse(new TextDecoder().decode(b64(info)))}
  catch{return null}
 }
 return {owner,metadata}
}
async function postProvider(env,path,body,form=false){
 const response=await fetch(BASE+path,{
  method:'POST',
  headers:{Authorization:'Bearer '+env.RODIN_API_KEY,
   ...(form?{}:{'content-type':'application/json'})},
  body:form?body:JSON.stringify(body),redirect:'error',
  signal:AbortSignal.timeout(45000),
 })
 if(response.status===429)throw Error('provider_rate_limited')
 if(!response.ok)throw Error('provider_http_'+response.status)
 const data=await response.json()
 if(data?.error)throw Error('provider_'+String(data.error).slice(0,70))
 return data
}
async function update(env,id,status,code='',extra={}){
 const fields=['status=?','error_code=?','updated_at=CURRENT_TIMESTAMP']
 const vals=[status,code]
 for(const [k,v] of Object.entries(extra)){
  if(!['provider_uuid','subscription_key','result_key','next_check_at','tries'].includes(k))
   throw Error('invalid_update_field')
  fields.push(k+'=?');vals.push(v)
 }
 vals.push(id)
 return env.WORD_DB.prepare('UPDATE word_rodin_jobs SET '+fields.join(',')+
   ' WHERE id=?').bind(...vals).run()
}
async function submitJob(env,id){
 // A queued message must never spend after an operator disables billing.
 if(env.WORD_PAID_ENABLED!=='true'||!env.RODIN_API_KEY||
  !env.RODIN_FIXED_JOB_CREDITS){
  const paused=await env.WORD_DB.prepare(
   "UPDATE word_rodin_jobs SET status='failed',error_code='paid_generation_disabled',"+
   "updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='queued' RETURNING source_key"
  ).bind(id).first()
  if(paused?.source_key)await env.WORD_ASSETS.delete(paused.source_key)
  return
 }
 // Atomically claim. A crash during POST is submission_uncertain, NEVER
 // silently retry a paid generation and charge twice.
 const claimed=await env.WORD_DB.prepare(
  "UPDATE word_rodin_jobs SET status='submitting',updated_at=CURRENT_TIMESTAMP "+
  "WHERE id=? AND status='queued' RETURNING *").bind(id).first()
 if(!claimed)return
 try{
  const source=await env.WORD_ASSETS.get(claimed.source_key)
  if(!source)throw Error('source_missing')
  const form=new FormData()
  form.append('images',new File([await source.arrayBuffer()],claimed.source_type==='image/jpeg'?'source.jpg':'source.png',
   {type:claimed.source_type}))
  form.append('tier',claimed.tier);form.append('mesh_mode',claimed.mesh_mode)
  form.append('quality',claimed.quality);form.append('material',claimed.material)
  form.append('geometry_file_format','glb')
  // No optional creative prompt: image-to-3D should derive prompt from source.
  const output=await postProvider(env,'/rodin',form,true)
  const uuid=output.uuid,token=output.jobs?.subscription_key
  if(!IDENT.test(uuid||'')||typeof token!=='string'||token.length<5)
   throw Error('provider_identifiers_missing')
  await update(env,id,'processing','',{
   provider_uuid:uuid,subscription_key:token,
   next_check_at:new Date(Date.now()+10000).toISOString(),
  })
 }catch(err){
  // Unknown whether the vendor charged before an error; require manual review
  // instead of submitting the same request twice.
  await update(env,id,'submission_uncertain',
   err instanceof Error?err.message.slice(0,70):'provider_submit_error')
 }
}
function safeDownloadURL(raw,env){
 const u=new URL(raw)
 const allow=(env.RODIN_DOWNLOAD_HOSTS||'').split(',').map(s=>s.trim().toLowerCase())
  .filter(Boolean)
 if(u.protocol!=='https:'||u.username||u.password||u.port||
  !allow.includes(u.hostname.toLowerCase())||
  /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))
  throw Error('unapproved_download_host')
 return u.toString()
}
async function downloadResult(env,row){
 const response=await postProvider(env,'/download',{task_uuid:row.provider_uuid})
 const result=response.list?.find(x=>/\.glb(?:$|\?)/i.test(x.name||'')||
  /^model\.glb$/i.test(x.name||''))
 if(!result?.url)throw Error('glb_missing_in_vendor_results')
 const url=safeDownloadURL(result.url,env)
 const body=await fetch(url,{method:'GET',redirect:'error',
  signal:AbortSignal.timeout(45000)})
 if(!body.ok)throw Error('download_http_'+body.status)
 const size=Number(body.headers.get('content-length'))
 if(Number.isFinite(size)&&size>35*1024*1024)throw Error('result_too_large')
 const data=await body.arrayBuffer()
 if(data.byteLength<24||data.byteLength>35*1024*1024)throw Error('result_size_invalid')
 const v=new DataView(data)
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||
  v.getUint32(8,true)!==data.byteLength||v.getUint32(16,true)!==0x4e4f534a)
  throw Error('result_invalid_glb')
 const n=v.getUint32(12,true)
 if(n<12||n>data.byteLength-20)throw Error('invalid_glb_json_chunk')
 let doc
 try{doc=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,n)))}
 catch{throw Error('invalid_glb_json')}
 if(!Array.isArray(doc.meshes)||doc.meshes.length===0||
  (doc.buffers||[]).some(x=>x.uri&&!x.uri.startsWith('data:'))||
  (doc.images||[]).some(x=>x.uri&&!x.uri.startsWith('data:'))||
  (doc.extensionsRequired||[]).length)
  throw Error('glb_external_resources_or_no_mesh')
 const key='word/rodin/'+row.user_id+'/'+row.id+'/result.glb'
 await env.WORD_ASSETS.put(key,data,{
  httpMetadata:{contentType:'model/gltf-binary'},
  customMetadata:{visibility:'private',ownerId:row.user_id,stage:'needs_art_review'},
 })
 await update(env,row.id,'needs_review','',{result_key:key})
 await env.WORD_ASSETS.delete(row.source_key)
}
async function pollJob(env,row){
 if(!['processing','polling'].includes(row.status))return
 const claimed=await env.WORD_DB.prepare(
  "UPDATE word_rodin_jobs SET status='polling',tries=tries+1,"+
  "next_check_at=datetime('now','+60 seconds'),updated_at=CURRENT_TIMESTAMP "+
  "WHERE id=? AND status IN ('processing','polling') AND "+
  "(next_check_at IS NULL OR datetime(next_check_at)<=CURRENT_TIMESTAMP) "+
  "RETURNING *").bind(row.id).first()
 if(!claimed)return
 if(claimed.tries>50){
  await update(env,row.id,'failed','generation_timeout');return
 }
 try{
  const body=await postProvider(env,'/status',
   {subscription_key:claimed.subscription_key})
  if(!Array.isArray(body.jobs)||body.jobs.length===0)
   throw Error('empty_vendor_status')
  if(body.jobs.some(j=>j.status==='Failed')){
   await update(env,row.id,'failed','vendor_failed')
   await env.WORD_ASSETS.delete(claimed.source_key)
  }else if(body.jobs.every(j=>j.status==='Done')){
   await downloadResult(env,claimed)
  }else{
   await update(env,row.id,'processing','',{
    next_check_at:new Date(Date.now()+Math.min(30000,5000+claimed.tries*5000)).toISOString(),
   })
  }
 }catch(err){
  await update(env,row.id,'processing',
   err instanceof Error?err.message.slice(0,70):'poll_error',{
   next_check_at:new Date(Date.now()+60000).toISOString(),
  })
 }
}
export default {
 async fetch(req,env){
  const path=new URL(req.url).pathname
  if(path==='/health'&&req.method==='GET')
   return json({ok:true,paidEnabled:env.WORD_PAID_ENABLED==='true'&&
    !!env.RODIN_API_KEY&&!!env.WORD_SIGNING_SECRET&&
    !!env.RODIN_FIXED_JOB_CREDITS,publicBroadcast:false})
  const match=/^\/v1\/jobs(?:\/([a-f\d-]{36})(?:\/(asset))?)?$/.exec(path)
  if(!match)return json({error:'not_found'},404)
  const isCreate=req.method==='POST'&&!match[1]
  const isRead=req.method==='GET'&&match[1]
  const isDelete=req.method==='DELETE'&&match[1]&&!match[2]
  if(!isCreate&&!isRead&&!isDelete)
   return json({error:'method_not_allowed'},405)
  if(!env.WORD_DB||!env.WORD_ASSETS||!env.WORD_QUEUE||!env.WORD_SIGNING_SECRET)
   return json({error:'word_service_unconfigured'},503)
  let image=null
  let digest=''
  if(isCreate){
   const size=Number(req.headers.get('content-length')||0)
   if(!Number.isSafeInteger(size)||size<128||size>MB)
    return json({error:'invalid_source_size'},413)
   image=await req.arrayBuffer()
   if(image.byteLength!==size)return json({error:'invalid_source_size'},413)
   digest=hex(await crypto.subtle.digest('SHA-256',image))
  }
  const auth=await verify(req,env,path,digest)
  if(!auth)return json({error:'unauthorized'},401)
  if(isCreate){
   if(env.WORD_PAID_ENABLED!=='true'||!env.RODIN_API_KEY||
    !env.RODIN_FIXED_JOB_CREDITS)return json({error:'paid_generation_disabled'},503)
   const v=auth.metadata
   if(!v||v.acceptTerms!==true||v.confirmCharge!==true||
    v.rights!=='original'&&v.rights!=='licensed'||
    v.tier!=='Gen-2.5-Medium'||v.mesh!=='Quad'||
    v.quality!=='medium'||v.material!=='PBR'||
    v.approvedCredits!==Number(env.RODIN_FIXED_JOB_CREDITS)||
    !/^[a-zA-Z0-9_-]{12,70}$/.test(v.idempotency||''))
    return json({error:'required_approval_or_fixed_quote_missing'},422)
   const bytes=new Uint8Array(image)
   const mime=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?
    'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':null
   if(!mime)return json({error:'only_png_jpeg_source_supported'},415)
   const existing=await env.WORD_DB.prepare(
    'SELECT id,status FROM word_rodin_jobs WHERE user_id=? AND idempotency_key=?'
   ).bind(auth.owner,v.idempotency).first()
   if(existing)return json({id:existing.id,status:existing.status,duplicate:true},200)
   const id=crypto.randomUUID(),key='word/rodin/'+auth.owner+'/'+id+'/source'
   const result=await env.WORD_DB.prepare(
    "INSERT INTO word_rodin_jobs(id,user_id,idempotency_key,status,"+
    "tier,mesh_mode,quality,material,rights,approved_credits,source_key,source_type,source_bytes) "+
    "SELECT ?,?,?,'queued',?,?,?,?,?,?,?,?,? WHERE "+
    "(SELECT COUNT(*) FROM word_rodin_jobs WHERE user_id=? AND "+
    "created_at>=datetime('now','-1 day'))<3 RETURNING id"
   ).bind(id,auth.owner,v.idempotency,v.tier,v.mesh,v.quality,v.material,
    v.rights,v.approvedCredits,key,mime,bytes.length,auth.owner).first()
   if(!result)return json({error:'daily_job_limit'},429)
   try{
    await env.WORD_ASSETS.put(key,image,{httpMetadata:{contentType:mime},
     customMetadata:{ownerId:auth.owner,visibility:'private',rights:v.rights}})
    await env.WORD_QUEUE.send({type:'submit',id})
   }catch{
    await update(env,id,'failed','queue_or_r2_unavailable')
    await env.WORD_ASSETS.delete(key).catch(()=>{})
    return json({error:'infrastructure_unavailable'},503)
   }
   return json({id,status:'queued',billingApprovalRecorded:true},202)
  }
  const row=await env.WORD_DB.prepare(
   'SELECT id,status,error_code,result_key,source_key,created_at,updated_at FROM word_rodin_jobs '+
   'WHERE id=? AND user_id=?'
  ).bind(match[1],auth.owner).first()
  if(!row)return json({error:'not_found'},404)
  if(isDelete){
   // A submitted vendor job cannot be reliably cancelled or refunded;
   // refuse deletion until results are terminal. Queued jobs are claim-safe.
   if(!['queued','failed','needs_review','submission_uncertain'].includes(row.status))
    return json({error:'vendor_task_in_progress_cannot_cancel_or_refund'},409)
   const result=await env.WORD_DB.prepare(
    "UPDATE word_rodin_jobs SET status='failed',"+
    "error_code='creator_assets_deleted',updated_at=CURRENT_TIMESTAMP "+
    "WHERE id=? AND user_id=? AND status IN ('queued','failed','needs_review','submission_uncertain') "+
    "RETURNING id"
   ).bind(match[1],auth.owner).first()
   if(!result)return json({error:'task_not_deletable'},409)
   await Promise.allSettled([
    env.WORD_ASSETS.delete(row.source_key),
    ...(row.result_key?[env.WORD_ASSETS.delete(row.result_key)]:[]),
   ])
   return json({deleted:true,remoteGenerationCancelled:false,
    refundPromised:false,retainedLedger:true})
  }
  if(match[2]==='asset'){
   if(row.status!=='needs_review'||!row.result_key)
    return json({error:'asset_not_ready'},409)
   const object=await env.WORD_ASSETS.get(row.result_key)
   if(!object)return json({error:'asset_missing'},503)
   return new Response(object.body,{
    headers:{'content-type':'model/gltf-binary','cache-control':'private,no-store',
     'x-content-type-options':'nosniff','content-length':String(object.size)},
   })
  }
  return json({id:row.id,status:row.status,hasAsset:row.status==='needs_review',
   error:row.error_code||null,createdAt:row.created_at,updatedAt:row.updated_at})
 },
 async queue(batch,env){
  for(const message of batch.messages){
   if(message.body?.type!=='submit'||!IDENT.test(message.body?.id||'')){
    message.ack();continue
   }
   try{await submitJob(env,message.body.id);message.ack()}
   catch{message.retry()}
  }
 },
 async scheduled(_event,env){
  const rows=await env.WORD_DB.prepare(
   "SELECT * FROM word_rodin_jobs WHERE status IN ('processing','polling') "+
   "AND (next_check_at IS NULL OR datetime(next_check_at)<=CURRENT_TIMESTAMP) LIMIT 10"
  ).all()
  await Promise.allSettled((rows.results||[]).map(row=>pollJob(env,row)))
 },
}
