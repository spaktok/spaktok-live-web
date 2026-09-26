/**
 * Build a same-origin URL base for Stripe redirects. The browser-supplied
 * Origin header may be checked for CSRF, but must never control redirects.
 */
export function resolveCheckoutOrigin(requestUrl: string, originHeader: string | null): string | null {
  try {
    const requestOrigin = new URL(requestUrl).origin
    if (!originHeader) return requestOrigin

    const suppliedOrigin = new URL(originHeader).origin
    return suppliedOrigin === requestOrigin ? requestOrigin : null
  } catch {
    return null
  }
}
