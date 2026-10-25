import Link from 'next/link'
export default function RecoveryPage(){
 return <main className="min-h-dvh bg-black px-6 py-20 text-center text-white" dir="rtl">
   <h1 className="mb-4 text-xl font-bold">استعادة حساب SpakTok</h1>
   <p className="mx-auto max-w-md text-sm text-white/70">
     النظام الجديد لا يدعم استعادة كلمة المرور بالبريد حتى تفعيل خدمة البريد والتحقق.
     احتفظ بكلمة مرورك ورمز الدعوة في مكان آمن. حسابات Supabase المحذوفة لا يمكن استعادتها من التطبيق.
   </p>
   <Link className="mt-8 inline-block rounded-xl bg-white px-5 py-3 text-black" href="/">العودة</Link>
 </main>
}
