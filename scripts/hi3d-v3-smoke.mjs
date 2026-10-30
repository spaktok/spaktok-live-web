#!/usr/bin/env node
/** Single opt-in Hi3D v3.0 private smoke test; not a public Spaktok endpoint.
 * Usage: node scripts/hi3d-v3-smoke.mjs --image /path/to/owned.png
 * Paid: HI3D_CLIENT_ID=... HI3D_CLIENT_SECRET=... HI3D_ALLOW_PAID_TEST=YES
 *       node scripts/hi3d-v3-smoke.mjs --image ... --execute-paid
 * Resume without another charge: node ... --resume-task <task-id>
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,basename,join} from 'node:path'
import {setTimeout as sleep} from 'node:timers/promises'
import {
 HI3D_PLAN,getHi3dToken,imageMediaType,submitHi3dV3,
 queryHi3dTask,downloadHi3dGlb,filenameForTask,validateTaskId,
} from '../lib/server/hi3d-api.mjs'

const args=process.argv.slice(2)
const find=(key)=>{const i=args.indexOf(key);return i<0?null:args[i+1]}
const executable=args.includes('--execute-paid')
const resume=find('--resume-task')
const imagePath=find('--image')
const outputDir=resolve(find('--output-dir')||'./hi3d-private-results')
if(args.includes('--help')){
 console.log('Usage: node scripts/hi3d-v3-smoke.mjs --image <owned-image.png> [--execute-paid] [--output-dir <private-dir>]')
 console.log('Resume without re-submission: node scripts/hi3d-v3-smoke.mjs --resume-task <task-id> [--output-dir <private-dir>]')
 process.exit(0)
}
if(Boolean(imagePath)===Boolean(resume)){
 console.error('Provide exactly one of --image or --resume-task')
 process.exit(2)
}
let imageBytes=null
if(imagePath){
 imageBytes=await readFile(resolve(imagePath))
 imageMediaType(imageBytes,basename(imagePath))
 console.log('VALID PRIVATE IMAGE: '+imageBytes.length+' bytes')
}
console.log('HI3D V3.0 PRIVATE TEST PLAN: '+JSON.stringify(HI3D_PLAN))
console.log('No GPU rental or storage transfer is required for the API test.')
if(!resume&&!executable){
 console.log('DRY RUN ONLY. No upload or paid API call made.')
 console.log('To opt in, use --execute-paid and set HI3D_ALLOW_PAID_TEST=YES with private developer credentials.')
 process.exit(0)
}
if(!resume&&process.env.HI3D_ALLOW_PAID_TEST!=='YES'){
 console.error('Paid generation blocked: HI3D_ALLOW_PAID_TEST=YES required.')
 process.exit(2)
}
const id=process.env.HI3D_CLIENT_ID,secret=process.env.HI3D_CLIENT_SECRET
if(!id||!secret){
 console.error('Missing HI3D_CLIENT_ID and HI3D_CLIENT_SECRET (never place these in this chat or Git).')
 process.exit(2)
}
let token
try{
 token=await getHi3dToken(id,secret)
}catch(e){
 console.error('API AUTH ERROR: '+(e instanceof Error?e.message:'unknown'))
 process.exit(3)
}
let taskId=resume?validateTaskId(resume):null
if(!taskId){
 // SUBMIT IS THE ONLY ACTION THAT MAY CONSUME CREDITS.
 // No retry on network ambiguity: a lost response might already represent
 // a charged task. Preserve provider task ID as soon as it is returned.
 try{taskId=await submitHi3dV3(imageBytes,basename(imagePath),token)}
 catch(e){
  console.error('SUBMISSION UNKNOWN/FAILED: '+(e instanceof Error?e.message:'unknown'))
  console.error('Never auto-resubmit; inspect Hi3D console before a new paid run.')
  process.exit(4)
 }
 console.log('TASK SUBMITTED: '+taskId)
}
await mkdir(outputDir,{recursive:true,mode:0o700})
const marker=join(outputDir,'hi3d-task-'+filenameForTask(taskId).slice(14,-4)+'.json')
await writeFile(marker,JSON.stringify({
 provider:'Hi3D',model:HI3D_PLAN.model,version:'v3.0',
 resolution:HI3D_PLAN.resolution,taskId,at:new Date().toISOString(),
 state:'submitted',rights:'private-test-not-public',
},null,2),{flag:'wx',mode:0o600}).catch(e=>{
 if(e.code!=='EEXIST')throw e
})
console.log('Task metadata saved privately. To resume later use --resume-task '+taskId)
let modelUrl=null
for(let i=0;i<30;i++){
 let state
 try{
  const result=await queryHi3dTask(taskId,token)
  state=result.state
  if(state==='success'){modelUrl=result.modelUrl;break}
  if(state==='failed')throw Error('provider_task_failed')
 }catch(e){
  console.error('STATUS ERROR: '+(e instanceof Error?e.message:'unknown'))
  console.error('Task remains resumable; no new paid submission necessary.')
  process.exit(5)
 }
 console.log('Task state: '+state)
 await sleep(10000)
}
if(!modelUrl){
 console.error('Task still running. Resume using the previously printed --resume-task ID.')
 process.exit(6)
}
try{
 const bytes=await downloadHi3dGlb(modelUrl)
 const output=join(outputDir,filenameForTask(taskId))
 await writeFile(output,bytes,{flag:'wx',mode:0o600})
 console.log('PRIVATE GLB SAVED: '+output)
 console.log('BYTES: '+bytes.length+'; do not publish automatically.')
 if(bytes.length>35*1024*1024)
   console.log('Optimization required: above Spaktok Forge direct GLB 35 MiB limit.')
 if(bytes.length>15*1024*1024)
   console.log('Optimization required: above existing local studio handoff 15 MiB limit.')
}catch(e){
 console.error('RESULT DOWNLOAD/VALIDATION ERROR: '+(e instanceof Error?e.message:'unknown'))
 console.error('No new generation needed; inspect task ID and approved download host.')
 process.exit(7)
}
