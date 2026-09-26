"use client"

import type { ReactNode } from "react"
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react"

interface FeedbackStateProps {
  type: "loading" | "empty" | "error"
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}

export function FeedbackState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: FeedbackStateProps) {
  const defaultIcon = type === "loading" ? (
    <Loader2 className="h-6 w-6 animate-spin text-[#6d8dff]" aria-hidden="true" />
  ) : type === "error" ? (
    <AlertTriangle className="h-6 w-6 text-[#6d8dff]" aria-hidden="true" />
  ) : (
    <Inbox className="h-6 w-6 text-[#6d8dff]" aria-hidden="true" />
  )

  return (
    <div
      className="mx-auto flex max-w-sm flex-col items-center justify-center rounded-3xl border border-[#3155ff]/20 bg-[#0b1f66]/10 px-6 py-10 text-center"
      role={type === "error" ? "alert" : "status"}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3155ff]/15">
        {icon ?? defaultIcon}
      </div>
      <h2 className="text-base font-bold text-white">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>}
      {onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#3155ff] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#4165ff] active:scale-95"
        >
          {type === "error" && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function EmptyState(props: Omit<FeedbackStateProps, "type">) {
  return <FeedbackState {...props} type="empty" />
}

export function ErrorState(props: Omit<FeedbackStateProps, "type">) {
  return <FeedbackState {...props} type="error" />
}

export function LoadingState({ title = "Wird geladen…" }: { title?: string }) {
  return <FeedbackState type="loading" title={title} />
}

