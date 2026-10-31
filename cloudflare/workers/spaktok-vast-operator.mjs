// Spaktok Vast.ai outbound-only operator bridge.
// No public SSH, no arbitrary shell, no public job creation.
// The operator uses authenticated Cloudflare D1 API to queue finite commands.
// GPU generates its bearer secret locally; only the SHA-256 hash is stored in D1.
const DEVICE=/^[a-f0-9]{32}$/;
const HASH=/^[a-f0-9]{64}$/;
const CODE=/^[A-F0-9]{8}$/;
const ID=/^[a-f0-9-]{36}$/;
const MAX_IMAGE=8*1024*1024;
const MAX_GLB=35*1024*1024;
const ACTIONS=new Set(['gpu_info','preflight','diagnose_dinov3','inspect_glb','finalize_glb','generate_one']);
const noStore={'cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...noStore,'content-type':'application/json'}});
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const clock=()=>Math.floor(Date.now()/1000);
const enrollmentOpen=env=>env.VAST_ENROLL_ENABLED==='true'&&Number(env.VAST_ENROLL_EXPIRES_AT||0)>clock();
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function limitedJson(req,limit=4096){
 const length=Number(req.headers.get('content-length')||'0');
 if(length>limit)throw Error('request_too_large');
 const raw=await req.text();
 if(raw.length>limit)throw Error('request_too_large');
 return JSON.parse(raw);
}
async function authenticate(req,env){
 const deviceId=req.headers.get('x-vast-device-id')||'';
 const authorization=req.headers.get('authorization')||'';
 if(!DEVICE.test(deviceId)||!/^Bearer [A-Za-z0-9_-]{48,160}$/.test(authorization))return null;
 const device=await env.VAST_DB.prepare('SELECT device_id,token_sha256,state,expires_at FROM vast_agent_devices WHERE device_id=?').bind(deviceId).first();
 if(!device||device.state==='revoked')return null;
 const actual=await sha(new TextEncoder().encode(authorization.slice(7)));
 if(!equal(actual,device.token_sha256))return null;
 return device;
}
async function leased(env,id,deviceId){
 return env.VAST_DB.prepare("SELECT * FROM vast_agent_jobs WHERE id=? AND device_id=? AND state='leased' AND lease_until>?").bind(id,deviceId,clock()).first();
}
async function respond(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(path==='/health'&&req.method==='GET')return json({service:'spaktok-vast-operator',configured:!!(env.VAST_DB&&env.VAST_ASSETS),gpuRented:false,publicCommandSubmission:false,enrollment:enrollmentOpen(env)});
 if(!env.VAST_DB||!env.VAST_ASSETS)return json({error:'operator_bindings_missing'},503);
 if(path==='/v1/agent/enroll'&&req.method==='POST'){
  if(!enrollmentOpen(env))return json({error:'enrollment_closed'},403);
  let input;try{input=await limitedJson(req,600)}catch{return json({error:'invalid_request'},400)}
  if(!DEVICE.test(input?.deviceId)||!HASH.test(input?.tokenSha256)||!CODE.test(input?.pairCode))return json({error:'invalid_enrollment'},422);
  const existing=await env.VAST_DB.prepare("SELECT COUNT(*) AS count FROM vast_agent_devices WHERE state='pending' AND expires_at>?").bind(clock()).first();
  if(Number(existing?.count)>0)return json({error:'enrollment_busy'},409);
  const result=await env.VAST_DB.prepare("INSERT OR IGNORE INTO vast_agent_devices(device_id,token_sha256,pair_code,state,created_at,expires_at) VALUES (?,?,?,'pending',?,?)").bind(input.deviceId,input.tokenSha256,input.pairCode,clock(),clock()+1800).run();
  if(result.meta?.changes!==1)return json({error:'device_already_registered'},409);
  return json({pending:true,deviceId:input.deviceId,expiresInSeconds:1800},202);
 }
 if(!path.startsWith('/v1/agent/'))return json({error:'not_found'},404);
 const device=await authenticate(req,env);
 if(!device)return json({error:'unauthorized'},401);
 if(path==='/v1/agent/claim'&&req.method==='POST'){
  if(device.state!=='approved')return json({paired:false,status:device.state},200);
  await env.VAST_DB.prepare('UPDATE vast_agent_devices SET last_seen=? WHERE device_id=?').bind(clock(),device.device_id).run();
  // No retries after crash: a leased job stays leased for manual investigation.
  const next=await env.VAST_DB.prepare(
   "UPDATE vast_agent_jobs SET state='leased',lease_until=? WHERE id=("+
   "SELECT id FROM vast_agent_jobs WHERE device_id=? AND state='queued' AND action IN ('gpu_info','preflight','diagnose_dinov3','inspect_glb','finalize_glb','generate_one') "+
   "AND (action NOT IN ('generate_one','diagnose_dinov3') OR approved_compute=1) "+
   "AND (action!='generate_one' OR rights_confirmed=1) ORDER BY created_at ASC LIMIT 1) "+
   "AND state='queued' RETURNING id,action,input_key,input_sha256,output_key,approved_compute,rights_confirmed,lease_until")
   .bind(clock()+3600,device.device_id).first();
  if(!next)return json({paired:true,job:null});
  if(!ACTIONS.has(next.action))return json({error:'unknown_action'},500);
  return json({paired:true,job:{id:next.id,action:next.action,inputKey:next.input_key,inputSha256:next.input_sha256,outputKey:next.output_key,approvedCompute:next.approved_compute,rightsConfirmed:next.rights_confirmed,leaseUntil:next.lease_until}});
 }
 const m=path.match(/^\/v1\/agent\/jobs\/([a-f0-9-]{36})\/(input|output|complete)$/);
 if(!m||!ID.test(m[1]))return json({error:'not_found'},404);
 if(device.state!=='approved')return json({error:'device_not_approved'},403);
 const job=await leased(env,m[1],device.device_id);
 if(!job)return json({error:'no_active_job'},409);
 if(m[2]==='input'&&req.method==='GET'){
  if(!job.input_key||!job.input_key.startsWith('vast-private/input/'))return json({error:'input_not_authorized'},403);
  const file=await env.VAST_ASSETS.get(job.input_key);
  if(!file||!file.body)return json({error:'input_missing'},404);
  if(file.size>MAX_GLB)return json({error:'input_oversize'},413);
  return new Response(file.body,{headers:{...noStore,'content-type':'application/octet-stream','content-length':String(file.size)}});
 }
 if(m[2]==='output'&&req.method==='PUT'){
  if(!['generate_one','finalize_glb'].includes(job.action)||!job.output_key||
      !job.output_key.startsWith('vast-private/output/')||job.output_sha256)return json({error:'output_not_authorized'},403);
  const size=Number(req.headers.get('content-length')||0);
  const hash=req.headers.get('x-content-sha256')||'';
  if(!Number.isSafeInteger(size)||size<28||size>MAX_GLB||!HASH.test(hash))return json({error:'invalid_output_metadata'},422);
  const raw=await req.arrayBuffer();
  if(raw.byteLength!==size||!(new TextDecoder().decode(new Uint8Array(raw,0,4))==='glTF')||
     new DataView(raw).getUint32(4,true)!==2||new DataView(raw).getUint32(8,true)!==size)
    return json({error:'invalid_glb'},422);
  const actual=await sha(raw);
  if(!equal(actual,hash))return json({error:'output_sha256_mismatch'},422);
  if(await env.VAST_ASSETS.head(job.output_key))return json({error:'object_exists_no_overwrite'},409);
  await env.VAST_ASSETS.put(job.output_key,raw,{httpMetadata:{contentType:'model/gltf-binary'},customMetadata:{sha256:actual,source:'vast-private-operator'}});
  const updated=await env.VAST_DB.prepare("UPDATE vast_agent_jobs SET output_sha256=?,output_bytes=? WHERE id=? AND state='leased' AND output_sha256 IS NULL").bind(actual,size,job.id).run();
  if(updated.meta?.changes!==1)return json({error:'output_record_conflict_review_r2'},409);
  return json({stored:true,sha256:actual,bytes:size});
 }
 if(m[2]==='complete'&&req.method==='POST'){
  let body;try{body=await limitedJson(req,4096)}catch{return json({error:'invalid_result'},400)}
  const state=body?.status==='succeeded'?'succeeded':body?.status==='failed'?'failed':null;
  if(!state)return json({error:'invalid_result_state'},422);
  if(state==='succeeded'&&['generate_one','finalize_glb'].includes(job.action)&&!job.output_sha256)return json({error:'output_missing'},409);
  const result=body?.result&&typeof body.result==='object'&&!Array.isArray(body.result)?body.result:{};
  const errorCode=body?.errorCode;
  if(errorCode!==undefined&&(!/^[a-z0-9_]{1,64}$/.test(errorCode)))return json({error:'bad_error_code'},422);
  const summary=JSON.stringify(result);
  if(summary.length>3000)return json({error:'result_too_large'},413);
  const saved=await env.VAST_DB.prepare("UPDATE vast_agent_jobs SET state=?,finished_at=?,result_json=?,error_code=? WHERE id=? AND state='leased'").bind(state,clock(),summary,state==='failed'?errorCode||'gpu_job_failed':null,job.id).run();
  return json({accepted:saved.meta?.changes===1});
 }
 return json({error:'method_not_allowed'},405);
}
export default {async fetch(req,env){
 try{return await respond(req,env)}catch(error){
  // Do not return SQL, access-token, runtime exception, or customer data.
  return json({error:'operator_internal_error'},500);
 }
}};
