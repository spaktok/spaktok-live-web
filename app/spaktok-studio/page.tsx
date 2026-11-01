import Link from 'next/link'
import SpaktokDirectorChat from '@/components/spaktok/spaktok-director-chat'

export const metadata={
 title:'Spaktok Studio AI Director | 3D, Avatar, Filters, Gifts & World',
 description:'Chat-first creative studio with private image-to-3D, VR/AR asset routing, inline 3D results and specialist engines.',
}
export default function SpaktokStudioPage(){
 return <main className="min-h-screen bg-[#050915] px-3 py-5 text-white sm:px-6 sm:py-8">
  <SpaktokDirectorChat/>
  <div dir="rtl" className="mx-auto max-w-6xl px-4 py-5">
   <Link href="/live-studio-preview" className="block max-w-xl rounded-2xl border border-amber-400/40 bg-amber-700/15 px-5 py-4 text-sm font-semibold text-amber-100">
    👑 افتح تاجك الملكي V2 داخل الفلاتر — تجربة محلية قابلة للتعديل دون جمهور
   </Link>
  </div>
  <div dir="rtl" className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-400">
   المحركات المتخصصة تعمل خلف الدردشة. للمراجعة الفنية المتقدمة:
   <Link href="/spaktok-word" className="mr-2 text-sky-300 underline">
    Spaktok Word
   </Link>
  </div>
 </main>
}
