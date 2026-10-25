'use client'
import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export interface AuthState {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: string | null
}

/** UI state only. Server API routes independently verify auth.getUser(). */
export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    session: null, user: null, isLoading: true, error: null,
  })

  useEffect(() => {
    let active = true
    let subscription: { unsubscribe: () => void } | undefined
    const handleSession = (session: Session | null) => {
      if (active) setState({ session, user: session?.user ?? null, isLoading: false, error: null })
    }

    try {
      const supabase = createClient()
      // Observe auth changes first, including sign-in and token refresh.
      const result = supabase.auth.onAuthStateChange((_event, session) => handleSession(session))
      subscription = result.data.subscription
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return
        if (error) {
          setState({ session: null, user: null, isLoading: false, error: 'auth_unavailable' })
        } else handleSession(data.session)
      }).catch(() => {
        if (active) setState({ session: null, user: null, isLoading: false, error: 'auth_unavailable' })
      })
    } catch {
      if (active) setState({ session: null, user: null, isLoading: false, error: 'auth_unavailable' })
    }

    return () => { active = false; subscription?.unsubscribe() }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
  return { ...state, signOut }
}
