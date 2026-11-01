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
const isToken=s=>(s.length===32||s.length===64)&&/^[a-f0-9]+$/.test(s);
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
function livePage(token){return "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head>\n<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"robots\" content=\"noindex,nofollow\"><meta name=\"referrer\" content=\"no-referrer\">\n<title>Spaktok Live QA — تاج Royal Crown V2</title>\n<script type=\"importmap\">{\"imports\":{\"three\":\"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js\",\"three/addons/\":\"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/\"}}</script>\n<style>\n*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#060913;color:#fff;font:14px system-ui}\n#video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:none}\n#gl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none}\n.top{position:absolute;top:max(12px,env(safe-area-inset-top));left:10px;right:10px;z-index:2;display:flex;justify-content:space-between;gap:8px}\n.tag{background:#0d1727e8;border:1px solid #4b5674;border-radius:12px;padding:9px;font-size:12px;line-height:1.7}\n.tag b{color:#fad08b}#state{color:#9af8c0}\n#intro{position:absolute;inset:0;z-index:5;background:#070d20ed;display:grid;place-items:center;padding:20px}\n#intro section{width:100%;max-width:420px;padding:24px;background:#151d32;border:1px solid #4e5b79;border-radius:23px;text-align:center}\nh1{font-size:25px}\nbutton{border:1px solid #4e5b79;border-radius:11px;padding:10px 12px;background:#273653;color:#fff;font:inherit;font-weight:600}\nbutton.primary{width:100%;padding:15px;background:#eabe68;color:#18120b;font-size:17px}\n#adjust{position:absolute;z-index:3;left:9px;right:9px;bottom:calc(9px + env(safe-area-inset-bottom));max-height:43vh;overflow:auto;background:#101628ed;border:1px solid #535d75;border-radius:16px;padding:12px;display:none}\n#adjust header{display:flex;align-items:center;justify-content:space-between}\nlabel{display:flex;justify-content:space-between;align-items:center;margin:9px 0;font-size:12px}\nlabel input{width:59%;accent-color:#e9ae54}\n.colors{display:flex;gap:7px;margin:7px 0}\n.colors button{flex:1;min-width:0;padding:9px 1px}\n.colors button[aria-pressed=true]{border:2px solid #f7c678}\n.actions{display:flex;gap:6px}.actions button{flex:1;font-size:12px}\n#notice{position:absolute;z-index:4;top:78px;left:12px;right:12px;text-align:center;color:#ffe3ae;font-size:12px}\n</style></head><body>\n<video id=\"video\" autoplay muted playsinline></video><canvas id=\"gl\"></canvas>\n<div class=\"top\"><div class=\"tag\">👑 <b>SPAKTOK LIVE</b> خاص<br><span id=\"state\">لا يوجد بث للجمهور</span></div><div class=\"tag\">Royal Crown V2<br>فلتر تطوير مؤقت</div></div>\n<div id=\"notice\" role=\"status\"></div>\n<div id=\"intro\"><section><h1>👑 جرّب تاجك على رأسك</h1>\n<p>لايف محلي بالكاميرا والتتبع، دون نشر بث أو إرسال بيانات وجهك لأي خادم.</p>\n<button class=\"primary\" id=\"start\">تشغيل اللايف التجريبي</button>\n<p id=\"msg\" style=\"font-size:12px;color:#e6bd7b;line-height:1.7\">افتح الصفحة في Chrome على هاتفك واسمح باستخدام الكاميرا.</p></section></div>\n<div id=\"adjust\"><header><b>👑 ضبط التاج V2</b><button id=\"hide\">إخفاء الضبط</button></header>\n<div id=\"adjustBody\">\n<label>الحجم <input id=\"size\" type=\"range\" min=\".5\" max=\"1.6\" step=\".05\" value=\"1\"><output id=\"sizev\">1.00</output></label>\n<label>الارتفاع <input id=\"lift\" type=\"range\" min=\"-.8\" max=\".8\" step=\".04\" value=\"0\"><output id=\"liftv\">0.00</output></label>\n<label>الدوران <input id=\"yaw\" type=\"range\" min=\"-40\" max=\"40\" step=\"2\" value=\"0\"><output id=\"yawv\">0</output></label>\n<div class=\"colors\">\n<button data-tint=\"original\" aria-pressed=\"true\">🌈 أصلي</button>\n<button data-tint=\"gold\" aria-pressed=\"false\">🥇 ذهب</button>\n<button data-tint=\"blue\" aria-pressed=\"false\">💠 أزرق</button>\n<button data-tint=\"pink\" aria-pressed=\"false\">🌸 وردي</button>\n<button data-tint=\"green\" aria-pressed=\"false\">💚 زمرد</button>\n</div>\n<div class=\"actions\"><button id=\"reset\">إعادة الضبط</button><button id=\"stop\">إغلاق الكاميرا</button></div>\n<p style=\"font-size:11px;color:#c0cbdc\">فلتر تجريبي 2.5D موجه بالصورة الأصلية؛ لا يمثل مجسمًا كامل التطابق من الخلف.</p>\n</div></div>\n<script src=\"https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js\"></script>\n<script type=\"module\">\nimport * as THREE from 'three';\nimport {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';\nconst $=id=>document.getElementById(id),video=$('video');\nlet renderer,scene,camera,model,landmarks,stream,faceMesh,lastFace=0,processing=false;\nconst p={size:1,lift:0,yaw:0},tints={original:'#ffffff',gold:'#d8b15d',blue:'#729beb',pink:'#d690b2',green:'#75c58d'},materials=[];\nfunction resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.position.z=1000;camera.updateProjectionMatrix()}\nwindow.addEventListener('resize',resize);\nfunction screen(pt){const w=video.videoWidth,h=video.videoHeight;if(!w||!h)return null;const k=Math.max(innerWidth/w,innerHeight/h),ox=(innerWidth-w*k)/2,oy=(innerHeight-h*k)/2;return{x:innerWidth-(ox+pt.x*w*k),y:oy+pt.y*h*k}}\nfunction render(){\n if(model&&landmarks&&performance.now()-lastFace<800){\n  const f=screen(landmarks[10]),left=screen(landmarks[33]),right=screen(landmarks[263]),nose=screen(landmarks[1]);\n  if(f&&left&&right&&nose){\n   const eye=Math.hypot(right.x-left.x,right.y-left.y),sc=eye*2/1.42*p.size;\n   const roll=Math.atan2(right.y-left.y,right.x-left.x);\n   const eyeX=(left.x+right.x)/2,eyeY=(left.y+right.y)/2;\n   model.visible=true;model.scale.setScalar(sc);\n   model.position.set(.75*f.x+.25*eyeX-innerWidth/2,innerHeight/2-(.8*f.y+.2*eyeY-eye*.13-p.lift*eye*.6)+sc*.39,0);\n   model.rotation.set(0,(nose.x-eyeX)/Math.max(1,eye)*.5+p.yaw*Math.PI/180,-roll);\n  }else model.visible=false;\n }else if(model)model.visible=false;\n if(renderer)renderer.render(scene,camera);\n requestAnimationFrame(render);\n}\nasync function detect(){\n if(!stream||!faceMesh)return;\n if(video.readyState>=2&&!processing){\n  processing=true;try{await faceMesh.send({image:video})}catch(e){$('notice').textContent='تعذر تتبع الوجه في المتصفح.'}finally{processing=false}\n }\n if(stream)setTimeout(detect,60);\n}\n$('start').addEventListener('click',async()=>{\n $('start').disabled=true;$('msg').textContent='جارٍ فتح الكاميرا وتحميل التاج…';\n try{\n  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:720},height:{ideal:1280},frameRate:{ideal:24}}});\n  video.srcObject=stream;video.style.display='block';await video.play();\n  renderer=new THREE.WebGLRenderer({canvas:$('gl'),alpha:true,antialias:false,powerPreference:'high-performance'});\n  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));\n  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;\n  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,2000);resize();\n  const gltf=await new GLTFLoader().loadAsync('__MODEL__');\n  model=gltf.scene;model.visible=false;\n  model.traverse(n=>{if(!n.isMesh)return;n.frustumCulled=false;const items=Array.isArray(n.material)?n.material:[n.material];const cloned=items.map(m=>{const c=m.clone();if(c.color)materials.push({material:c,original:c.color.clone()});return c});n.material=Array.isArray(n.material)?cloned:cloned[0]});\n  scene.add(model);\n  if(typeof window.FaceMesh!=='function')throw Error('مكتبة تتبع الوجه لم تُحمّل على الجهاز.');\n  faceMesh=new window.FaceMesh({locateFile:name=>'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/'+name});\n  faceMesh.setOptions({maxNumFaces:1,minDetectionConfidence:.5,minTrackingConfidence:.5});\n  faceMesh.onResults(r=>{if(r.multiFaceLandmarks&&r.multiFaceLandmarks[0]){landmarks=r.multiFaceLandmarks[0];lastFace=performance.now();$('state').textContent='✓ التاج يتبع حركة الرأس'}else if(performance.now()-lastFace>900)$('state').textContent='وجّه وجهك نحو الكاميرا'});\n  $('intro').style.display='none';$('adjust').style.display='block';$('gl').style.display='block';\n  requestAnimationFrame(render);void detect();\n }catch(e){$('msg').textContent=e.message||'فشل تشغيل الكاميرا؛ جرّب Chrome.';$('start').disabled=false;\n  if(stream){for(const t of stream.getTracks())t.stop();stream=null}}\n});\nfor(const key of Object.keys(p))$(key).addEventListener('input',e=>{p[key]=Number(e.target.value);$(key+'v').textContent=p[key].toFixed(key==='yaw'?0:2)});\n$('adjust').addEventListener('click',e=>{const btn=e.target.closest('button[data-tint]');if(!btn)return;const type=btn.dataset.tint;document.querySelectorAll('[data-tint]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));for(const v of materials){v.material.color.copy(type==='original'?v.original:v.original.clone().lerp(new THREE.Color(tints[type]),.5))}});\n$('reset').addEventListener('click',()=>{p.size=1;p.lift=0;p.yaw=0;for(const k of Object.keys(p)){$(k).value=p[k];$(k+'v').textContent=p[k].toFixed(k==='yaw'?0:2)}document.querySelector('[data-tint=original]').click()});\n$('stop').addEventListener('click',()=>{if(stream)for(const t of stream.getTracks())t.stop();stream=null;if(faceMesh)faceMesh.close();location.reload()});\n$('hide').addEventListener('click',()=>{const hide=$('adjustBody').style.display!=='none';$('adjustBody').style.display=hide?'none':'block';$('hide').textContent=hide?'إظهار الضبط':'إخفاء الضبط'});\n</script></body></html>".replaceAll('__MODEL__','/v1/model/'+token+'.glb')}
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
  if(req.method!=='GET'||!env.STUDIO_ASSETS||!env.VAST_DB)return json({error:'not_found'},404);
  // Query parameters added by Android Custom Tabs are presentation-only.
  // They never participate in ticket authentication or asset selection.
  // The ticket remains a 128/256-bit secret in the *path* and is verified in D1.
  const path=u.pathname.endsWith('/')&&u.pathname.length>1?u.pathname.slice(0,-1):u.pathname;
  if(path==='/')return new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spaktok Live</title><body style="font:16px system-ui;background:#101524;color:#fff;padding:28px"><h2>👑 Spaktok Live التجريبي</h2><p>الصفحة الرئيسية ليست رابط التجربة الخاص. افتح رابط اللايف كاملًا من المحادثة، بما فيه رمز الوصول بعد /live/.</p><p>يمكنك الضغط مطولًا على الرابط ثم اختيار فتح في Chrome.</p></body></html>',{headers:{...NO_STORE,'content-type':'text/html; charset=utf-8'}});
  const pieces=path.split('/');
  let token='',what='';
  if(pieces.length===3&&pieces[1]==='view'){what='view';token=pieces[2]}
  else if(pieces.length===3&&pieces[1]==='live'){what='live';token=pieces[2]}
  else if(pieces.length===4&&pieces[1]==='v1'&&pieces[2]==='model'&&pieces[3].endsWith('.glb')){what='model';token=pieces[3].slice(0,-4)}
  else if(pieces.length===4&&pieces[1]==='v1'&&pieces[2]==='source'&&pieces[3].endsWith('.png')){what='source';token=pieces[3].slice(0,-4)}
  else if(pieces.length===4&&pieces[1]==='v1'&&pieces[2]==='download'&&pieces[3].endsWith('.glb')){what='download';token=pieces[3].slice(0,-4)}
  if(!await allow(token,env.VAST_DB))return json({error:'preview_link_expired_or_unavailable'},403);
  if(what==='live')return new Response(livePage(token),{headers:{...NO_STORE,'content-type':'text/html; charset=utf-8',
    'permissions-policy':'camera=(self), microphone=()',
    'content-security-policy':"default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; connect-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; media-src blob:; worker-src blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'"}});
  if(what==='view')return new Response(page(token),{headers:{...NO_STORE,'content-type':'text/html; charset=utf-8',
    'content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://ajax.googleapis.com; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; worker-src blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'"}});
  if(what==='model'||what==='download')return serveFile(env,MODEL_KEY,MODEL_SHA,MODEL_BYTES,'model/gltf-binary',what==='download');
  if(what==='source')return serveFile(env,SOURCE_KEY,SOURCE_SHA,SOURCE_BYTES,'image/png',false);
  return json({error:'not_found'},404);
 }catch{return json({error:'private_preview_unavailable'},500)}
}};
