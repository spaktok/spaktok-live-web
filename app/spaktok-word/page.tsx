import Link from 'next/link'
import SpaktokDirectorChat from '@/components/spaktok/spaktok-director-chat'
export const metadata={
 title:'Spaktok AI Director | Creative Engine',
 description:'One creative chat to operate Spaktok Studio, Avatar, Live, AR Filters, Gifts, World and Video 3D using private models.',
}
/** The six specialist studios run behind one conversation. Their original
 * editor pages remain available as optional advanced tooling, but ordinary
 * creator requests begin and end inside the chat.
 */
export default function SpaktokWordPage(){
 return <main className="min-h-screen bg-[#050915] px-3 py-5 text-white sm:px-6 sm:py-8">
  <SpaktokDirectorChat/>
  <nav dir="rtl" aria-label="أدوات المطورين المتقدمة" className="mx-auto max-w-6xl px-2 py-5">
   <details className="rounded-xl border border-white/10 bg-[#0b1425] p-3 text-xs text-slate-400">
    <summary className="cursor-pointer font-semibold text-slate-300">الاستوديوهات المتقدمة · للمراجعة الهندسية فقط</summary>
    <p className="my-3 leading-6">المحررات التقليدية باقية لاختبار Rig والخامات والمحاكاة، لكنها ليست ضرورية لتسليم GLB ومعاينته في AI Director.</p>
    <div className="flex flex-wrap gap-3 text-sky-300">
     <Link href="/reality-studio">Reality Studio</Link>
     <Link href="/avatar-studio">Avatar</Link>
     <Link href="/gift-studio">Gifts</Link>
     <Link href="/spaktok-world">World</Link>
     <Link href="/video-studio">Video 3D</Link>
    </div>
   </details>
  </nav>
 </main>
}
