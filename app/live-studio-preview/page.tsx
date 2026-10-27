'use client'

import {useState} from 'react'
import Link from 'next/link'
import {CameraScreen} from '@/components/spaktok/camera-screen'

/** Public, permission-gated LOCAL camera QA entry.
 * No authentication bypass for account APIs. Only mounts getUserMedia after
 * explicit user action; does not transmit, publish, save or upload any stream.
 */
export default function LiveStudioPreviewPage(){
 const [open,setOpen]=useState(false)
 if(open)return <CameraScreen initialMode="live" onClose={()=>setOpen(false)}/>
 return <main dir="rtl" className="min-h-dvh bg-[#070a12] px-5 py-14 text-white">
  <section className="mx-auto max-w-xl space-y-6 rounded-3xl border border-cyan-500/25 bg-[#111a2b] p-6 shadow-2xl sm:p-9">
   <p className="text-sm font-semibold tracking-wider text-cyan-300">SpakTok Reality • Local Live QA</p>
   <h1 className="text-3xl font-bold leading-snug">تجربة نحت الوجه المباشر من شبكتك الشخصية</h1>
   <p className="text-sm leading-7 text-slate-300">
    هنا يمكنك تجربة تنحيف الفك والذقن، توسيع العينين وتصغير الأنف في معاينة الكاميرا،
    دون الحاجة إلى تسجيل الدخول. تبدأ الكاميرا فقط بعد موافقتك.
   </p>
   <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-7 text-amber-100">
    <strong>معاينة محلية فقط:</strong> لا يبدأ بث للجمهور، ولا تُرسل صور الوجه أو نقاط التتبع إلى خادم
    من خلال هذه التجربة. لا تعمل كل المزايا الحسابية قبل تهيئة البنية الخلفية.
   </div>
   <button type="button" onClick={()=>setOpen(true)}
    className="w-full rounded-2xl bg-gradient-to-l from-[#3458ff] to-cyan-400 px-6 py-4 text-center text-base font-bold text-white">
    تشغيل الكاميرا وتجربة أدوات اللايف
   </button>
   <p className="text-xs leading-6 text-slate-400">
    إذا لم يظهر طلب السماح بالكاميرا داخل متصفح التطبيق، افتح هذا الرابط في Chrome،
    ثم اسمح باستخدام الكاميرا من إعدادات الموقع. تحتاج الكاميرا إلى HTTPS.
   </p>
   <Link href="/reality-studio" className="block text-center text-sm font-semibold text-cyan-300 underline">
    العودة إلى استوديو المجسمات والمؤثرات
   </Link>
  </section>
 </main>
}
