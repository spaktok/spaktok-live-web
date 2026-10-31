import {createPrivateKey,type KeyObject} from 'node:crypto'

/** Static owner-only pilot configuration. Does NOT verify that a Cloudflare
 * Worker is deployed, that its public key matches, or that R2 is reachable.
 * Never return key material or the owner's UUID to browsers/logs.
 */
export type StudioPilotReadiness=
 'disabled'|'owner_unconfigured'|'signer_unconfigured'|
 'signer_invalid'|'server_preconditions_met'

const OWNER_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const SAFE_BASE64=/^[a-zA-Z0-9+/]+={0,2}$/
/** Narrow owner identity: explicit pilot owner overrides the existing
 * admin UUID; no ID is ever returned to untrusted clients.
 */
export function studioPilotOwnerId(env:Readonly<Record<string,string|undefined>>):string|null{
 const id=env.SPAKTOK_STUDIO_PILOT_OWNER_ID||env.SPAKTOK_ADMIN_USER_ID
 return OWNER_UUID.test(id??'')?id!.toLowerCase():null
}

export function studioPilotReadiness(env:Readonly<Record<string,string|undefined>>):
 StudioPilotReadiness{
 if(env.SPAKTOK_STUDIO_PILOT_ENABLED!=='true')return 'disabled'
 if(!studioPilotOwnerId(env))
  return 'owner_unconfigured'
 const encoded=env.SPAKTOK_STUDIO_PILOT_SIGNING_KEY??''
 if(!encoded)return 'signer_unconfigured'
 if(encoded.length>8192||!SAFE_BASE64.test(encoded))
  return 'signer_invalid'
 try{
  const pem=Buffer.from(encoded,'base64').toString('utf8')
  const privateKey=createPrivateKey(pem)
  return privateKey.asymmetricKeyType==='ed25519'?
   'server_preconditions_met':'signer_invalid'
 }catch{return 'signer_invalid'}
}

export function studioPilotSigner(env:Readonly<Record<string,string|undefined>>):
 KeyObject{
 if(studioPilotReadiness(env)!=='server_preconditions_met')
  throw Error('studio_pilot_not_configured')
 // Use a dedicated signing key, NOT the general D1 SQL bridge key.
 return createPrivateKey(Buffer.from(
  env.SPAKTOK_STUDIO_PILOT_SIGNING_KEY!,'base64',
 ).toString('utf8'))
}
