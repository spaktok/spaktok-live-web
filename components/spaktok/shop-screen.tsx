'use client'
import {ChevronRight,ShoppingBag,ShieldCheck,Sparkles,Store,Box} from 'lucide-react'

/** Storefront requires verified merchants, real inventory and order fulfillment.
 * Old fake product listings and checkout links were removed. */
export function ShopScreen({onBack}:{onBack?:()=>void}){
 return <div className="spak-discover min-h-dvh pb-28 text-white" dir="rtl">
   <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080d1e]/90 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-2xl">
    <div className="mx-auto flex max-w-2xl items-center gap-3">
     <button type="button" aria-label="العودة" onClick={onBack} className="spak-icon-control"><ChevronRight className="size-5"/></button>
     <div><p className="text-[10px] font-bold tracking-[.2em] text-[#90adff]">SPAKTOK MARKET</p><h1 className="text-2xl font-bold">المتجر</h1></div>
    </div>
   </header>
   <main className="mx-auto max-w-lg px-5 pt-14 text-center">
    <div className="relative mx-auto mb-9 flex size-32 items-center justify-center rounded-[38px] border border-[#91aaff]/25 bg-gradient-to-br from-[#324eac]/55 via-[#16254e] to-[#090e1e] shadow-[0_26px_90px_rgba(62,91,213,.22)]">
     <ShoppingBag className="size-14 text-[#b6c9ff]"/>
     <Sparkles className="absolute -left-3 -top-3 size-7 text-[#93b4ff]"/>
    </div>
    <div className="text-[11px] font-bold tracking-[.25em] text-[#92acff]">MARKETPLACE • COMING SOON</div>
    <h2 className="mt-4 text-3xl font-extrabold leading-tight">التسوق داخل SpakTok، قريبًا</h2>
    <p className="mx-auto mt-5 max-w-sm text-sm leading-8 text-white/55">
     نبني متجرًا يعتمد على بائعين حقيقيين ومنتجات متوفرة وطلبات يمكن تتبعها.
     لا نعرض حاليًا منتجات وهمية، ولا نستقبل طلبات شراء قبل اكتمال نظام المتاجر.
    </p>
    <div className="mt-10 grid grid-cols-2 gap-3 text-right">
      <div className="spak-creator-card p-4"><Store className="mb-3 size-6 text-[#aac1ff]"/><p className="text-sm font-semibold">متاجر موثقة</p><p className="mt-2 text-xs leading-6 text-white/45">التحقق من التجار وحماية المشتري</p></div>
      <div className="spak-creator-card p-4"><ShieldCheck className="mb-3 size-6 text-[#aac1ff]"/><p className="text-sm font-semibold">طلبات آمنة</p><p className="mt-2 text-xs leading-6 text-white/45">الدفع والإرجاع وتتبع الطلبات</p></div>
    </div>
    <button type="button" onClick={onBack} className="spak-primary-button mt-10">العودة إلى SpakTok</button>
   </main>
  </div>
}
