import type { CloudflareBindings } from './d1-repository'

export function getCloudflareBindings(): CloudflareBindings | null {
  const runtime = globalThis as typeof globalThis & { __env__?: Partial<CloudflareBindings>; env?: Partial<CloudflareBindings> }
  const bindings = runtime.__env__ ?? runtime.env
  if (!bindings?.DB) return null
  return bindings as CloudflareBindings
}

