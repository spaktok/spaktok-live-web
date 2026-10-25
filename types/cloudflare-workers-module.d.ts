/** Cloudflare bindings resolve only inside the Workers runtime. */
declare module 'cloudflare:workers' {
  export const env: Env
}
