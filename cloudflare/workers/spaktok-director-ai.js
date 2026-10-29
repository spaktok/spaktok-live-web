// Spaktok AI Director: owner-private Cloudflare Workers AI model inference.
// Uses the FREE daily Workers AI neuron allocation while available.
// Completely isolated from R2/video/gifts/auth Workers; DOES NOT execute tools.
// The existing authenticated Spaktok Node server signs EACH model decision.
// No anonymous public prompting and no arbitrary model selection.
const AI_DOMAIN='spaktok-director-ai-step-v1';
const ED_PUBLIC='MCowBQYDK2VwAyEAN/tgkUKQRZ7J3fpryNYw3JFrK8OqQOxPpZDp05LcsLw=';
const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const LIMIT=8000;
const actions=['inspect_asset','generate_relief','generate_3d_gpu',
  'recolor_asset','dispatch_asset','finish'];
const targets=['avatar','live','filter','gift','world','video'];
const colors=['gold','silver','red','blue','green','purple','black','white'];
const schema={
 type:'object',properties:{
  action:{type:'string',enum:actions},
  targets:{type:'array',items:{type:'string',enum:targets},minItems:1,maxItems:6},
  color:{type:'string',enum:[...colors,'none']},
  message:{type:'string',maxLength:500},
 },required:['action','targets','color','message'],additionalProperties:false,
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json','cache-control':'private,no-store',
  'x-content-type-options':'nosniff'},
});
const pubKey=crypto.subtle.importKey('spki',
 Uint8Array.from(atob(ED_PUBLIC),c=>c.charCodeAt(0)),
 {name:'Ed25519'},false,['verify']);
const hex=(bytes)=>Array.from(new Uint8Array(bytes)).map(
 v=>v.toString(16).padStart(2,'0')).join('');
async function signatureIsValid(request,body){
 const expires=request.headers.get('x-spaktok-director-expires')||'';
 const signature=request.headers.get('x-spaktok-director-signature')||'';
 if(!/^\\d{10}$/.test(expires)||!/^[a-zA-Z0-9_-]{86}$/.test(signature))return false;
 const now=Math.floor(Date.now()/1000),exp=Number(expires);
 if(exp<now||exp>now+60)return false;
 const hash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)));
 const payload=[AI_DOMAIN,hash,expires].join('\\n');
 try{
  const key=await pubKey;
  const raw=signature.replace(/-/g,'+').replace(/_/g,'/')+'==';
  return await crypto.subtle.verify('Ed25519',key,
    Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),
    new TextEncoder().encode(payload));
 }catch{return false}
}
async function handle(request){
 const url=new URL(request.url);
 if(url.pathname==='/health'&&request.method==='GET')
  return json({ok:true,provider:'cloudflare-workers-ai',
   auth:'signed-server-only',model:MODEL,freeTier:'quota-limited'});
 if(request.method!=='POST'||url.pathname!=='/v1/agent/step')
  return json({error:'not_found'},404);
 const declared=Number(request.headers.get('content-length'));
 if(!Number.isSafeInteger(declared)||declared<4||declared>LIMIT)
  return json({error:'invalid_size'},413);
 const body=await request.text();
 if(body.length>LIMIT)return json({error:'invalid_size'},413);
 if(!await signatureIsValid(request,body))return json({error:'unauthorized'},401);
 let input;
 try{input=JSON.parse(body)}catch{return json({error:'invalid_json'},422)}
 if(typeof input!=='object'||!input||
    typeof input.instruction!=='string'||
    input.instruction.length>7000||
    typeof input.system!=='string'||input.system.length>3500)
  return json({error:'invalid_payload'},422);
 // The Worker cannot execute GLB edits, publish, spend GPU, or call databases.
 // It decides the next permitted tool; Node and the browser validate again.
 try{
  const result=await AI.run(MODEL,{
   messages:[
    {role:'system',content:input.system+'\\nReturn one JSON decision. color=none unless recolor_asset is used.'},
    {role:'user',content:input.instruction},
   ],
   response_format:{type:'json_schema',json_schema:schema},
   max_tokens:240,temperature:0,
  });
  const candidate=result?.response||result?.choices?.[0]?.message?.content;
  const parsed=typeof candidate==='string'?JSON.parse(candidate):candidate;
  if(!parsed||!actions.includes(parsed.action)||
     !Array.isArray(parsed.targets)||parsed.targets.length<1||
     parsed.targets.length>6||parsed.targets.some(x=>!targets.includes(x))||
     ![...colors,'none'].includes(parsed.color)||
     typeof parsed.message!=='string'||parsed.message.length>500)
   return json({error:'invalid_model_step'},502);
  return json({ok:true,step:{action:parsed.action,targets:parsed.targets,
   color:parsed.color==='none'?null:parsed.color,message:parsed.message},
   model:MODEL,usage:result?.usage?{neurons:result.usage.neurons}:null});
 }catch(error){
  // A free allowance can be exhausted. Never fall back to an unconsented
  // paid model or an unauthenticated public endpoint.
  return json({error:'workers_ai_unavailable',cause:String(error).slice(0,120)},503);
 }
}
addEventListener('fetch',event=>event.respondWith(handle(event.request)));
