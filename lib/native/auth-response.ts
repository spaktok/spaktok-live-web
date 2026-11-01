/** A failed D1 schema read is an outage, not evidence that auth settings vanished. */
export type NativeAuthReadiness='ready'|'not_configured'|'unavailable'
export function classifyNativeAuthResponse(
  httpStatus:number,
  body:{configured?:unknown}|null,
):NativeAuthReadiness {
  if(body?.configured===false)return 'not_configured'
  if(httpStatus>=200&&httpStatus<300&&body?.configured===true)return 'ready'
  return 'unavailable'
}
