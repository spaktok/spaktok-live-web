import { getNativeUser } from '@/lib/native/auth'
/** Native D1 session replaces removed Supabase Auth; identity never comes from headers. */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const user=await getNativeUser()
  return user?.id??null
}
