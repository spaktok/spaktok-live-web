"use client";

import React from "react"

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { APP_LOGO_URL, APP_NAME } from "@/lib/brand";

type AuthMode = "welcome" | "login" | "signup" | "recover";

interface AuthScreenProps {
  onComplete?: () => void;
  initialError?: string | null;
}

/**
 * Genericize the credential/existence signal to avoid account enumeration,
 * while still surfacing actionable states (unconfirmed email, rate limits).
 */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }
  if (m.includes("email not confirmed")) {
    return "لم يتم تأكيد بريدك الإلكتروني بعد. تحقق من بريدك الوارد.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "تعذّر إكمال العملية. جرّب تسجيل الدخول أو طلب رابط تأكيد جديد.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  }
  if (m.includes("password")) {
    return "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "صيغة البريد الإلكتروني غير صحيحة.";
  }
  return "تعذّر إكمال العملية. حاول مرة أخرى.";
}

export function AuthScreen({ onComplete, initialError }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError === 'native_auth_not_configured'
    ? 'قاعدة بيانات Cloudflare لم تُربط بعد. التسجيل والدخول سيتاحان بعد إكمال إعداد D1.'
    : initialError === 'auth_unavailable' ? 'تعذر الوصول إلى خدمة الحسابات الجديدة.' : null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copyState, setCopyState] = useState(false);


  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    inviteCode: "",
    recoveryCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfoMessage(null)
    const email=formData.email.trim().toLowerCase()
    const password=formData.password
    if (!email || password.length < 10) {
      setError('أدخل بريدًا صحيحًا وكلمة مرور من 10 أحرف على الأقل.')
      return
    }
    setIsLoading(true)
    try {
      const response=await fetch('/api/native/auth',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        cache:'no-store',
        body:JSON.stringify({
          action:mode==='signup'?'register':mode==='recover'?'recover':'login',email,password,
          recoveryCode:formData.recoveryCode,
          username:formData.username.trim(), inviteCode:formData.inviteCode,
        }),
      })
      const body=await response.json() as {success?:boolean;error?:string;recoveryCode?:string}
      if (!response.ok || !body.success) {
        const errors:Record<string,string>={
          native_auth_not_configured:'قاعدة بيانات Cloudflare غير مُهيأة بعد. يلزم ربطها من إعدادات الإدارة.',
          registration_not_configured:'التسجيل بدعوة غير مُفعّل حتى يكمل المدير إعداد Cloudflare.',
          invalid_login:'البريد أو كلمة المرور غير صحيحة. إذا حذفت قاعدة الحسابات السابقة، عليك إنشاء حساب جديد.',
          already_registered:'الحساب موجود بالفعل. جرّب تسجيل الدخول.',
          invalid_invite:'رمز الدعوة غير صحيح.',
          too_many_attempts:'محاولات كثيرة. أعد المحاولة بعد 15 دقيقة.',
          invalid_credentials:'تحقق من البريد وكلمة المرور والاسم.',
          invalid_username:'اسم المستخدم يجب أن يكون بالإنجليزية، من 3 إلى 24 حرفًا.',
          invalid_recovery:'تعذر استعادة الحساب. تحقق من البريد ورمز الاسترداد.',
        }
        setError(errors[body.error||'']||'تعذر إتمام العملية. تحقق من إعدادات الخدمة.')
        return
      }
      if ((mode==='signup' || mode==='recover') && body.recoveryCode) {
        setRecoveryCode(body.recoveryCode)
        setCopyState(false)
        setFormData(current=>({...current,password:'',recoveryCode:''}))
        return
      }
      onComplete?.()
      window.location.assign('/')
    } catch {
      setError('تعذر الاتصال بخادم SpakTok. حاول مرة أخرى.')
    } finally {setIsLoading(false)}
  }

  if (recoveryCode) return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-white" dir="rtl">
      <section className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">احفظ رمز استرداد حسابك</h1>
        <p className="text-sm text-white/75">
          هذا الرمز يظهر مرة واحدة فقط. احفظه في مدير كلمات مرور آمن؛ ستحتاج إليه
          إذا نسيت كلمة المرور. لا ترسله لأحد ولا تحفظه في لقطة شاشة عامة.
        </p>
        <code dir="ltr" className="block select-all break-all rounded-xl border border-white/20 bg-black/70 p-4 text-sm text-white">{recoveryCode}</code>
        <Button type="button" variant="outline" className="w-full" onClick={() => {
          void navigator.clipboard?.writeText(recoveryCode).then(() => setCopyState(true)).catch(() => setCopyState(false))
        }}>
          {copyState?'تم النسخ':'نسخ رمز الاسترداد'}
        </Button>
        <Button className="w-full" onClick={() => {
          setRecoveryCode(null)
          if (mode==='recover') { setMode('login'); setInfoMessage('تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.') }
          else { onComplete?.(); window.location.assign('/') }
        }}>
          حفظت الرمز — متابعة
        </Button>
      </section>
    </main>
  )

  return (
    <div className="min-h-dvh w-full bg-background flex flex-col items-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/30 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-[#3155ff]/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-md min-h-dvh flex flex-col">
        <AnimatePresence mode="wait">
          {mode === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6"
            >
              {/* Logo */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 1 }}
  className="mb-8 h-28 w-28 overflow-hidden rounded-3xl bg-black shadow-2xl shadow-blue-600/30 ring-1 ring-blue-500/30"
  >
  <img src={APP_LOGO_URL} alt={`${APP_NAME} logo`} className="h-full w-full object-cover" />
  </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-[#3155ff] bg-clip-text text-transparent"
              >
                {APP_NAME}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground text-center mt-3 max-w-xs"
              >
                اكتشف مقاطع وأفكارًا جديدة، وشارك لحظاتك مع مجتمع SpakTok.
              </motion.p>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center gap-8 mt-10"
              >
                {[
                  { icon: "🎬", label: "مقاطع" },
                  { icon: "📡", label: "بث مباشر" },
                  { icon: "💬", label: "محادثات" },
                  { icon: "🛍️", label: "المتجر" },
                ].map((feature) => (
                  <div key={feature.label} className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{feature.icon}</span>
                    <span className="text-xs text-muted-foreground">{feature.label}</span>
                  </div>
                ))}
              </motion.div>

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="w-full max-w-sm mt-12 space-y-3"
              >
                <Button
                  onClick={() => setMode("signup")}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-[#3155ff] hover:opacity-90"
                >
                  إنشاء حساب جديد
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMode("login")}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-transparent border-2"
                >
                  تسجيل الدخول
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-xs text-muted-foreground text-center mt-6 max-w-xs"
              >
                مجتمع SpakTok يبدأ بلحظتك القادمة.
              </motion.p>
            </motion.div>
          )}

          {(mode === "login" || mode === "signup" || mode === "recover") && (
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex-1 flex flex-col justify-center p-6"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMode("welcome")}
                  className="rounded-full"
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">
                    {mode === "login" ? "مرحبًا بعودتك" : mode === "recover" ? "استعادة الحساب" : "إنشاء حساب"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {mode === "login"
                      ? "سجّل الدخول للمتابعة"
                      : mode === "recover" ? "أدخل رمز الاسترداد وكلمة المرور الجديدة"
                      : "انضم إلى مجتمع SpakTok"}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      placeholder="اسم المستخدم"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="h-14 pr-12 rounded-2xl bg-muted/50 border-0 text-right"
                    />
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="space-y-1">
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="رمز دعوة التسجيل من إدارة SpakTok"
                      value={formData.inviteCode}
                      onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
                      className="h-14 rounded-2xl border-0 bg-muted/50 text-right"
                      required
                    />
                    <p className="text-right text-xs text-muted-foreground">التسجيل بدعوة مؤقتًا حتى نفعّل البريد الإلكتروني والتحقق ضد الحسابات الآلية.</p>
                  </div>
                )}
                {mode === 'recover' && (
                  <div className="space-y-1">
                    <Input
                      value={formData.recoveryCode}
                      onChange={(e) => setFormData({ ...formData, recoveryCode: e.target.value })}
                      placeholder="رمز الاسترداد الذي حفظته عند إنشاء الحساب"
                      autoComplete="off" dir="ltr" required
                      className="h-14 rounded-2xl border-0 bg-muted/50 text-left"
                    />
                    <p className="text-right text-xs text-muted-foreground">الاسترداد عبر الرمز، وليس البريد الإلكتروني، حتى يتم تفعيل نظام البريد.</p>
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      autoComplete="email"
                      dir="ltr"
                      placeholder="البريد الإلكتروني"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="h-14 pr-12 rounded-2xl bg-muted/50 border-0 text-right"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      dir="ltr"
                      placeholder="كلمة المرور"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="h-14 pr-12 pl-12 rounded-2xl bg-muted/50 border-0 text-right"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 text-right"
                  >
                    {error}
                  </p>
                )}
                {infoMessage && (
                  <p
                    role="status"
                    className="text-sm text-primary bg-primary/10 rounded-xl px-4 py-3 text-right"
                  >
                    {infoMessage}
                  </p>
                )}

                {mode === 'login' && (
                  <p className="text-right text-xs text-muted-foreground">
                    إذا حذفت قاعدة Supabase القديمة، فلا يمكن استخدام كلمة مرور الحساب القديم. أنشئ حسابًا جديدًا برمز الدعوة.
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-[#3155ff] hover:opacity-90"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : mode === "login" ? (
                    "تسجيل الدخول"
                  ) : mode === "recover" ? (
                    "تغيير كلمة المرور"
                  ) : (
                    "إنشاء حساب"
                  )}
                </Button>

              </form>

              {mode === 'login' && (
                <button type="button" className="mt-4 w-full text-center text-sm text-primary underline"
                  onClick={() => {setError(null);setMode('recover')}}>
                  نسيت كلمة المرور؟ استخدم رمز الاسترداد
                </button>
              )}
              {/* Switch mode */}
              <div className="text-center mt-6">
                <span className="text-muted-foreground">
                  {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
                </span>{" "}
                <Button
                  variant="link"
                  className="text-primary p-0 h-auto font-semibold"
                  onClick={() => {
                    setError(null);
                    setInfoMessage(null);
                    setMode(mode === "login" ? "signup" : "login");
                  }}
                >
                  {mode === "login" ? "إنشاء حساب" : "تسجيل الدخول"}
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
