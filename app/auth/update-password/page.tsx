'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let live = true
    try {
      const supabase = createClient()
      void supabase.auth.getUser().then(({ data, error }) => {
        if (live) {
          setReady(!error && Boolean(data.user))
          if (error || !data.user) setMessage('الرابط منتهي الصلاحية. اطلب رابط استعادة جديدًا.')
        }
      }).catch(() => { if (live) setMessage('تعذر التحقق من صلاحية رابط الاستعادة.') })
    } catch { setMessage('خدمة استعادة الحساب غير متاحة حاليًا.') }
    return () => { live = false }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (newPassword.length < 8 || newPassword !== confirm) {
      setMessage('استخدم 8 أحرف على الأقل وتأكد من تطابق كلمتي المرور.')
      return
    }
    setSending(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) throw new Error('invalid_session')
      const result = await supabase.auth.updateUser({ password: newPassword })
      if (result.error) throw result.error
      setSaved(true)
      setMessage('تم تحديث كلمة المرور. يمكنك العودة إلى التطبيق.')
    } catch {
      setMessage('تعذر تحديث كلمة المرور. قد يكون الرابط منتهي الصلاحية.')
    } finally { setSending(false) }
  }

  return (
    <main className="min-h-dvh bg-black px-5 py-12 text-white" dir="rtl">
      <div className="mx-auto max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">استعادة حساب SpakTok</h1>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-2">كلمة المرور الجديدة
            <input type="password" autoComplete="new-password" value={newPassword} minLength={8}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-white/10 p-3" required disabled={!ready || saved}/>
          </label>
          <label className="block space-y-2">تأكيد كلمة المرور
            <input type="password" autoComplete="new-password" value={confirm} minLength={8}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl bg-white/10 p-3" required disabled={!ready || saved}/>
          </label>
          <button type="submit" disabled={!ready || sending || saved}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50">
            {sending ? 'جارٍ الحفظ...' : 'تحديث كلمة المرور'}
          </button>
        </form>
        {message && <p role="status" className="text-sm text-white/75">{message}</p>}
        <Link href="/" className="inline-block underline">العودة إلى SpakTok</Link>
      </div>
    </main>
  )
}
