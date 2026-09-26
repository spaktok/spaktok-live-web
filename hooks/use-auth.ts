'use client'

import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export interface AuthState {
  session: Session | null
  user: User | null
  isLoading: boolean
}

/**
 * Subscribes to the Supabase auth session. This is auth state (not data
 * fetching), so it uses getSession + onAuthStateChange rather than SWR.
 */
export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
  })

  useEffect(() => {
    const supabase = createClient()
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        isLoading: false,
      })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
      })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return { ...state, signOut }
}
