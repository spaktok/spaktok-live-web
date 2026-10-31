// One-use, nonpublic original-image staging for Spaktok Royal Crown 01.
// Not a general-purpose file upload service or an arbitrary GPU-command route.
const MAGIC=[137,80,78,71,13,10,26,10];
const IMAGE_BYTES=2408236;
const IMAGE_SHA="883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e";
const OBJECT="vast-private/input/royal-crown-01/"+IMAGE_SHA+".png";
const TOK=/^[a-f0-9]{64}$/;
const safe={"cache-control":"private,no-store","x-content-type-options":"nosniff",
            "referrer-policy":"no-referrer","x-frame-options":"DENY",
            "permissions-policy":"camera=(),microphone=(),geolocation=()"};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),
  {status,headers:{...safe,"content-type":"application/json; charset=utf-8"}});
async function digest(input){
 return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",input)))
  .map(x=>x.toString(16).padStart(2,"0")).join("");
}
function equal(a,b){
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
 let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);
 return d===0;
}
function checkPng(raw){
 if(raw.byteLength!==IMAGE_BYTES)return false;
 const data=new Uint8Array(raw);
 if(!MAGIC.every((n,i)=>data[i]===n))return false;
 const view=new DataView(raw);
 return view.getUint32(16,false)===1448&&view.getUint32(20,false)===1086;
}
const html=token=>`<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spaktok Studio | Royal Crown 01</title>
<style>body{font-family:system-ui,sans-serif;max-width:620px;margin:32px auto;padding:0 18px;line-height:1.8;background:#111318;color:#f7f5f0}
main{background:#1c2028;padding:24px;border-radius:16px}h1{font-size:1.4rem;margin:0 0 14px}
button,input{font-size:1rem;margin-top:12px}button{border:0;border-radius:10px;padding:12px 20px;background:#e3ad4f;color:#18140e;font-weight:700}
button:disabled{opacity:.5}small{color:#c4bdac}#status{white-space:pre-wrap;word-break:break-word}label{display:block;margin:12px 0}</style></head>
<body><main><h1>رفع التاج الأول — Spaktok Studio</h1>
<p>اختر ملف <b>crown_reference_original.png</b> الأصلي. يتم التحقق من بصمته SHA-256 ثم حفظه في التخزين الخاص، دون نشر الصورة للآخرين.</p>
<input id="f" type="file" accept=".png,image/png">
<label><input id="rights" type="checkbox"> أؤكد أنني أملك حقوق استخدام هذه الصورة أو لدي ترخيص مناسب لإنتاج فلتر منها.</label>
<button id="b">رفع الملف الأصلي</button>
<p id="status" role="status"></p><small>التصريح لمرة واحدة، ولا ينفّذ التوليد أو يبدأ رسوم GPU تلقائيًا.</small></main>
<script>const ticket=${JSON.stringify(token)};
document.getElementById("b").onclick=async()=>{
const b=document.getElementById("b"),st=document.getElementById("status");
const f=document.getElementById("f").files[0];
if(!f||!document.getElementById("rights").checked){st.textContent="اختر صورة PNG الأصلية وأكد صلاحية استخدامها";return;}
if(f.type!=="image/png"||f.size!==2408236){st.textContent="الملف ليس نسخة التاج الأصلية المطلوبة (2,408,236 بايت)";return;}
b.disabled=true;st.textContent="جارٍ رفع الصورة إلى Cloudflare R2 الخاص...";
try{
 const r=await fetch("/v1/upload/"+ticket,{method:"POST",
  headers:{"content-type":"image/png","x-image-rights-confirmed":"yes"},body:f,
  credentials:"omit",referrerPolicy:"no-referrer",cache:"no-store"});
 const j=await r.json();
 st.textContent=r.ok&&j.stored?"تم حفظ الصورة الأصلية بشكل خاص. يمكنك العودة إلى المحادثة وكتابة: تم رفع التاج.":"تعذر إكمال الرفع: "+(j.error||r.status);
}catch{st.textContent="تعذر الاتصال. لم تُطلب إعادة توليد أو استخدام GPU."}
b.disabled=false;
};</script></body></html>`;
async function respond(req,env){
 const u=new URL(req.url);
 if(req.method==="GET"&&u.pathname==="/health")
  return reply({service:"spaktok-royal-crown-01-private-upload",publicAssets:false});
 if(!env.VAST_DB||!env.VAST_ASSETS)return reply({error:"storage_not_configured"},503);
 const path=u.pathname.match(/^\/(upload|v1\/upload)\/([a-f0-9]{64})$/);
 if(!path)return reply({error:"not_found"},404);
 const token=path[2];
 if(!TOK.test(token))return reply({error:"invalid_ticket"},403);
 const tokenHash=await digest(new TextEncoder().encode(token));
 const ticket=await env.VAST_DB.prepare(
  "SELECT expected_sha256,object_key,expires_at,used_at FROM vast_crown_01_upload_tickets WHERE token_sha256=?"
 ).bind(tokenHash).first();
 const now=Math.floor(Date.now()/1000);
 if(!ticket||ticket.expires_at<now)return reply({error:"ticket_invalid_or_expired"},403);
 if(req.method==="GET"&&path[1]==="upload"){
  if(ticket.used_at)return reply({error:"ticket_already_used"},409);
  return new Response(html(token),{headers:{...safe,
    "content-type":"text/html; charset=utf-8",
    "content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"}});
 }
 if(req.method!=="POST"||path[1]!=="v1/upload")
  return reply({error:"method_not_allowed"},405);
 if(ticket.used_at)return reply({error:"ticket_already_used"},409);
 if(req.headers.get("x-image-rights-confirmed")!=="yes")
  return reply({error:"rights_confirmation_required"},403);
 const origin=req.headers.get("origin");
 if(origin&&origin!==u.origin)return reply({error:"origin_mismatch"},403);
 if(req.headers.get("content-type")!=="image/png")
  return reply({error:"png_required"},415);
 const declared=Number(req.headers.get("content-length")||"0");
 if(declared&&declared!==IMAGE_BYTES)return reply({error:"wrong_image_size"},422);
 const body=await req.arrayBuffer();
 if(!checkPng(body)||!equal(await digest(body),IMAGE_SHA))
  return reply({error:"original_image_sha_mismatch"},422);
 if(ticket.object_key!==OBJECT||ticket.expected_sha256!==IMAGE_SHA)
  return reply({error:"ticket_object_mismatch"},403);
 // One-use ticket. Concurrent requests cannot both claim it.
 const claim=await env.VAST_DB.prepare(
  "UPDATE vast_crown_01_upload_tickets SET used_at=?,rights_confirmed=1 "+
  "WHERE token_sha256=? AND used_at IS NULL AND expires_at>=? RETURNING object_key"
 ).bind(now,tokenHash,now).first();
 if(!claim)return reply({error:"ticket_race_or_expired"},409);
 if(await env.VAST_ASSETS.head(OBJECT))
  return reply({error:"private_image_already_exists"},409);
 await env.VAST_ASSETS.put(OBJECT,body,{httpMetadata:{contentType:"image/png"},
  customMetadata:{sha256:IMAGE_SHA,asset:"royal-crown-01",visibility:"private"}});
 return reply({stored:true,private:true,sha256:IMAGE_SHA,bytes:IMAGE_BYTES,
               objectKey:OBJECT,queued:false,generated:false},201);
}
export default {async fetch(req,env){
 try{return await respond(req,env)}
 catch{return reply({error:"private_crown_upload_failed"},500)}
}};
