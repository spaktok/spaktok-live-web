'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'

/** Camera and AR dependencies are only downloaded after the user opens capture/live. */
const Camera = dynamic(
  () => import('@/components/spaktok/camera-screen').then((module) => module.CameraScreen),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-6 text-center text-sm text-white"
        role="status" aria-live="polite">
        جارٍ تجهيز الكاميرا والفلاتر…
      </div>
    ),
  },
)

type BoundaryProps = { children: ReactNode; onExit: () => void }
type BoundaryState = { failed: boolean; attempts: number }

class LiveCameraErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, attempts: 0 }

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only the browser console receives the diagnostic. Never transmit camera pixels,
    // facial landmarks, session credentials or error stacks to third-party telemetry.
    console.error('SpakTok local camera preview failed', error, info.componentStack)
  }

  retry = () => this.setState((state) => ({ failed: false, attempts: state.attempts + 1 }))

  render() {
    if (this.state.failed) {
      return (
        <main dir="rtl" role="alert" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#080b16] p-6 text-white">
          <section className="w-full max-w-md space-y-4 rounded-3xl border border-amber-300/25 bg-slate-900 p-6 text-center">
            <h1 className="text-xl font-bold">تعذّر تشغيل معاينة اللايف على هذا المتصفح</h1>
            <p className="text-sm leading-7 text-slate-300">
              لم يبدأ بث للجمهور. يمكنك إعادة المحاولة، أو فتح SpakTok في Chrome
              والسماح للكاميرا من إعدادات الموقع. لا تُرسل صورة الوجه من هذه المعاينة إلى الخادم.
            </p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={this.retry}
                className="rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white">
                إعادة تشغيل معاينة الكاميرا
              </button>
              <button type="button" onClick={this.props.onExit}
                className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white">
                العودة إلى التطبيق
              </button>
            </div>
          </section>
        </main>
      )
    }
    return <div key={this.state.attempts}>{this.props.children}</div>
  }
}

export function SafeLiveCamera({ onClose, initialMode = 'live' }: {
  onClose: () => void
  initialMode?: 'photo' | '15s' | '60s' | 'story' | 'live'
}) {
  return (
    <LiveCameraErrorBoundary onExit={onClose}>
      <Camera initialMode={initialMode} onClose={onClose} />
    </LiveCameraErrorBoundary>
  )
}
