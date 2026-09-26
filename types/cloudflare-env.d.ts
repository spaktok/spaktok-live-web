interface Env {
  DB: D1Database
  CACHE: KVNamespace
  MEDIA: R2Bucket
  CALLS: DurableObjectNamespace
  SESSION_SECRET: string
  TURN_SERVERS?: string
}

declare namespace Cloudflare {
  interface Env extends globalThis.Env {}
}
