// Owner-only, short-lived interactive 3D viewer of the VERIFIED Royal Crown 01.
// Both model and reference are exact immutable private Cloudflare R2 objects.
// There is no public R2 bucket access and no upload, compute or GLB mutation.
const MODEL_KEY='vast-private/input/royal-crown-01/reference-locked-v2-source.glb';
const MODEL_SHA='ee5ec583041a9e2b55e31f718e42670ba5526d2cccfa249b549dece4ad81f129';
const MODEL_BYTES=3324548;
const SOURCE_KEY='vast-private/input/royal-crown-01/883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e.png';
const SOURCE_SHA='883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e';
const SOURCE_BYTES=2408236;
const NO_STORE={'cache-control':'private,no-store','x-content-type-options':'nosniff',
 'x-frame-options':'DENY','referrer-policy':'no-referrer','x-robots-tag':'noindex,nofollow',
 'cross-origin-resource-policy':'same-origin'};
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...NO_STORE,'content-type':'application/json; charset=utf-8'}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const hashBuffer=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
function constant(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
const isToken=s=>s.length===64&&/^[a-f0-9]+$/.test(s);
async function allow(token,db){
 if(!isToken(token))return false;
 const th=await hash(token);
 const row=await db.prepare('SELECT expires_at,revoked_at FROM studio_crown_private_view_tickets WHERE token_sha256=?').bind(th).first();
 return row&&row.revoked_at===null&&row.expires_at>Math.floor(Date.now()/1000);
}
function page(token){
 const model='/v1/model/'+token+'.glb',source='/v1/source/'+token+'.png';
 return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<title>Spaktok Studio | Royal Crown V2 — معاينة واجهة الصورة الأصلية</title>
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js"></script>
<style>
:root{color-scheme:dark;font-family:system-ui,'Segoe UI',sans-serif}
*{box-sizing:border-box}
body{margin:0;background:#0d101a;color:#f5f3ed}
header{padding:14px 18px;border-bottom:1px solid #333747;display:flex;justify-content:space-between;gap:12px;align-items:center}
h1{font-size:17px;margin:0}.chip{color:#d0ffde;background:#234532;border-radius:99px;font-size:11px;padding:5px 10px;white-space:nowrap}
.container{max-width:1200px;margin:auto;padding:14px;display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:14px}
.panel{background:linear-gradient(160deg,#1e2330,#121520);border:1px solid #333747;border-radius:16px;overflow:hidden}
.phead{padding:12px 15px;border-bottom:1px solid #34384a;font-weight:700;font-size:14px}
model-viewer{width:100%;height:min(69vh,650px);min-height:340px;background:radial-gradient(ellipse at 50% 45%,#343d53 0%,#181c28 62%,#11141f 100%);--poster-color:#11141f;touch-action:pan-y}
.original{min-height:260px;height:min(50vh,470px);display:flex;align-items:center;justify-content:center;background:radial-gradient(#2b2f42,#131722)}
.original img{width:100%;height:100%;object-fit:contain}
.controls{display:flex;flex-wrap:wrap;gap:7px;padding:12px;justify-content:center}
button,a.dl{background:#2b3042;border:1px solid #525a70;color:#f8f4ed;padding:9px 12px;border-radius:9px;font-size:13px;cursor:pointer;text-decoration:none}
button.selected{background:#9b7131;border-color:#dfbd6f;color:#fff}
.note{padding:12px 15px;color:#c3c7d2;font-size:12px;line-height:1.7}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px}
.stat{background:#242939;border-radius:10px;padding:11px}.stat b{display:block;color:#f0cd83;font-size:17px}.stat small{color:#b2bac9}
#msg{padding:8px 15px;color:#ffe2a3;font-size:13px;line-height:1.6}
footer{max-width:1200px;margin:auto;padding:12px 19px 22px;color:#abb2c5;font-size:12px;line-height:1.7}
@media(max-width:760px){.container{grid-template-columns:1fr}model-viewer{height:52vh;min-height:330px}.original{height:32vh;min-height:220px}}
</style></head><body>
<header><h1>Spaktok Studio · التاج الأول 3D</h1><span class="chip">معاينة خاصة مؤقتة</span></header>
<main class="container">
<section class="panel">
<div class="phead">Royal Crown V2 — المجسم الموجّه بالصورة الأصلية (2.5D)</div>
<model-viewer id="mv" src="${model}" alt="مجسم التاج المولد من الصورة الأصلية"
 camera-controls auto-rotate rotation-per-second="15deg"
 shadow-intensity="0.55" exposure="1.3" environment-image="neutral"
 camera-orbit="0deg 80deg auto" interaction-prompt="auto"
 loading="eager" reveal="auto"></model-viewer>
<div id="msg">حمّل المجسم ثم اسحب بإصبعك لتدويره، واستخدم إصبعين للتكبير والتصغير.</div>
<div class="controls">
 <button data-angle="0deg 80deg auto">الأمام</button>
 <button data-angle="90deg 80deg auto">الجانب</button>
 <button data-angle="180deg 80deg auto">الخلف</button>
 <button id="spin">إيقاف الدوران</button>
 <button id="capture">حفظ لقطة PNG من المجسم</button>
 <a class="dl" href="/v1/download/${token}.glb">حفظ GLB الخاص</a>
</div>
</section>
<aside class="panel">
<div class="phead">الصورة الأصلية — مرجع المطابقة</div>
<div class="original"><img src="${source}" alt="الصورة الأصلية للتاج" loading="lazy"></div>
<div class="stats">
 <div class="stat"><b>32,256</b><small>مثلث</small></div>
 <div class="stat"><b>3.32 MB</b><small>حجم المجسم</small></div>
 <div class="stat"><b>6</b><small>خامات PBR أولية</small></div>
 <div class="stat"><b>1</b><small>صورة PNG أصلية مدمجة</small></div>
</div>
<div class="note">هذه نسخة V2 جديدة تحفظ ملف PNG الأصلي كاملًا كخامة أمامية. العمق وحلقة الخلف مصممان بصورة تقريبية، وليسا إعادة بناء 100٪ من صورة واحدة. الخامات الست مبدئية، وتغيير الألوان يتطلب اختبارًا بصريًا قبل Live.</div>
</aside>
</main>
<footer>لا يزال المجسم خاصًا بالمالك، ولم ينشر كفلتر Live. يمكن فحصه بصريًا هنا أو حفظ نسخة GLB للمراجعة. الرابط مؤقت؛ لا تشاركه مع الآخرين.</footer>
<script>
 const model=document.getElementById('mv'),msg=document.getElementById('msg');
 model.addEventListener('load',()=>{msg.textContent='تم تحميل GLB الفعلي. قارن التفاصيل مع الصورة الأصلية بجانبه.'});
 model.addEventListener('error',()=>{msg.textContent='تعذّر عرض المجسم. حاول إعادة فتح الصفحة في Chrome أو استخدم خيار حفظ GLB.'});
 document.querySelectorAll('[data-angle]').forEach(b=>b.addEventListener('click',()=>{
  model.removeAttribute('auto-rotate');
  model.setAttribute('camera-orbit',b.dataset.angle);
  document.querySelectorAll('[data-angle]').forEach(v=>v.classList.remove('selected'));b.classList.add('selected');
  document.getElementById('spin').textContent='استئناف الدوران';
 }));
 document.getElementById('spin').addEventListener('click',e=>{
  if(model.hasAttribute('auto-rotate')){model.removeAttribute('auto-rotate');e.target.textContent='استئناف الدوران'}
  else{model.setAttribute('auto-rotate','');e.target.textContent='إيقاف الدوران'}
 });
 document.getElementById('capture').addEventListener('click',()=>{
  if(!model.loaded){msg.textContent='يجب تحميل المجسم قبل حفظ صورة المعاينة.';return}
  try{
   const url=model.toDataURL('image/png');
   if(!url.startsWith('data:image/png;base64,'))throw Error('capture_unavailable');
   const link=document.createElement('a');
   link.href=url;link.download='spaktok-royal-crown-01-3d-preview.png';
   document.body.appendChild(link);link.click();link.remove();
   msg.textContent='تم تجهيز صورة PNG من زاوية العرض الحالية.';
  }catch{msg.textContent='تعذر حفظ PNG مباشرة؛ يمكنك التقاط صورة للشاشة من الهاتف.'}
 });
</script></body></html>`;
}
async function serveFile(env,key,expectedSha,expectedSize,mime,download){
 const obj=await env.STUDIO_ASSETS.get(key);
 if(!obj||obj.size!==expectedSize||obj.customMetadata?.sha256!==expectedSha)return json({error:'private_asset_missing_or_unverified'},503);
 const bytes=await obj.arrayBuffer();
 if(bytes.byteLength!==expectedSize||!constant(await hashBuffer(bytes),expectedSha))return json({error:'private_asset_checksum_failed'},503);
 const headers={...NO_STORE,'content-type':mime,'content-length':String(expectedSize)};
 if(download)headers['content-disposition']='attachment; filename="spaktok-royal-crown-01-master.glb"';
 return new Response(bytes,{status:200,headers});
}
export default {async fetch(req,env){
 try{
  const u=new URL(req.url);
  if(req.method==='GET'&&u.pathname==='/health')return json({service:'spaktok-crown-private-preview',publicAccess:false});
  if(req.method!=='GET'||u.search||!env.STUDIO_ASSETS||!env.VAST_DB)return json({error:'not_found'},404);
  const pieces=u.pathname.split('/');
  let token='',what='';
  if(pieces.length===3&&pieces[1]==='view'){what='view';token=pieces[2]}
  else if(pieces.length===4&&pieces[1]==='v1'&&pieces[2]==='model'&&pieces[3].endsWith('.glb')){what='model';token=pieces[3].slice(0,-4)}
  else if(pieces.length===4&&pieces[1]==='v1'&&pieces[2]==='source'&&pieces[3].endsWith('.png')){what='source';token=pieces[3].slice(0,-4)}
  else if(pieces.length===4&&pieces[1]==='v1'&&pieces[2]==='download'&&pieces[3].endsWith('.glb')){what='download';token=pieces[3].slice(0,-4)}
  if(!await allow(token,env.VAST_DB))return json({error:'preview_link_expired_or_unavailable'},403);
  if(what==='view')return new Response(page(token),{headers:{...NO_STORE,'content-type':'text/html; charset=utf-8',
    'content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://ajax.googleapis.com; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; worker-src blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'"}});
  if(what==='model'||what==='download')return serveFile(env,MODEL_KEY,MODEL_SHA,MODEL_BYTES,'model/gltf-binary',what==='download');
  if(what==='source')return serveFile(env,SOURCE_KEY,SOURCE_SHA,SOURCE_BYTES,'image/png',false);
  return json({error:'not_found'},404);
 }catch{return json({error:'private_preview_unavailable'},500)}
}};
