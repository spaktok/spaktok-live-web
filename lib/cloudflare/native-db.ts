import type { D1DatabaseLike } from './d1-repository'

/** Do not trust client-provided DB IDs, headers, or global mutable bindings. */
export async function getNativeDatabase(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await import('cloudflare:workers')
    return env.DB ?? null
  } catch {
    return null
  }
}
