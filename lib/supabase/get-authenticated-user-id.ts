import { createClient } from "./server"

/**
 * Resolve the caller from Supabase's verified server-side session cookie.
 * Never trust user identifiers supplied in request headers or JSON bodies.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) return null
  return data.user?.id ?? null
}
