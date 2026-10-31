import {describe,it,expect} from 'vitest'
import {generateKeyPairSync} from 'node:crypto'
import {
 studioPilotOwnerId,studioPilotReadiness,studioPilotSigner,
} from './spaktok-studio-pilot-config'

const OWNER='123e4567-e89b-42d3-a456-426614174000'
const keypair=generateKeyPairSync('ed25519')
const encoded=Buffer.from(keypair.privateKey.export({
 type:'pkcs8',format:'pem',
})).toString('base64')
const base={
 SPAKTOK_STUDIO_PILOT_ENABLED:'true',
 SPAKTOK_STUDIO_PILOT_OWNER_ID:OWNER,
 SPAKTOK_STUDIO_PILOT_SIGNING_KEY:encoded,
}

describe('Owner-private Studio pilot configuration is never inferred from D1 credentials',()=>{
 it('fails closed by default and ignores a production SQL signing key',()=>{
  expect(studioPilotReadiness({})).toBe('disabled')
  expect(studioPilotReadiness({
   SPAKTOK_STUDIO_PILOT_ENABLED:'false',
   SPAKTOK_D1_BRIDGE_SIGNING_KEY:encoded,
  })).toBe('disabled')
  expect(studioPilotReadiness({
   SPAKTOK_STUDIO_PILOT_ENABLED:'true',
   SPAKTOK_STUDIO_PILOT_OWNER_ID:OWNER,
   SPAKTOK_D1_BRIDGE_SIGNING_KEY:encoded,
  })).toBe('signer_unconfigured')
 })
 it('uses the existing admin UUID only if no explicit pilot owner is configured',()=>{
  const operator={...base,SPAKTOK_STUDIO_PILOT_OWNER_ID:undefined,
   SPAKTOK_ADMIN_USER_ID:OWNER}
  expect(studioPilotOwnerId(operator)).toBe(OWNER)
  expect(studioPilotReadiness(operator)).toBe('server_preconditions_met')
  expect(studioPilotOwnerId({...operator,SPAKTOK_ADMIN_USER_ID:'admin'})).toBeNull()
  expect(studioPilotReadiness({...operator,SPAKTOK_ADMIN_USER_ID:'admin'})).toBe('owner_unconfigured')
 })
 it('requires a valid owner ID',()=>{
  expect(studioPilotReadiness({...base,
   SPAKTOK_STUDIO_PILOT_OWNER_ID:'invalid',
  })).toBe('owner_unconfigured')
 })
 it('rejects invalid, non-ed25519 and unsafe private keys',()=>{
  for(const value of ['garbage',Buffer.from('not a key').toString('base64'), 'x'.repeat(9000)]){
   expect(studioPilotReadiness({...base,
    SPAKTOK_STUDIO_PILOT_SIGNING_KEY:value,
   })).toBe('signer_invalid')
  }
  const rsa=generateKeyPairSync('rsa',{modulusLength:2048})
  const rsaKey=Buffer.from(rsa.privateKey.export({
   type:'pkcs8',format:'pem',
  })).toString('base64')
  expect(studioPilotReadiness({...base,
   SPAKTOK_STUDIO_PILOT_SIGNING_KEY:rsaKey,
  })).toBe('signer_invalid')
 })
 it('accepts only the dedicated Ed25519 PEM-based signer',()=>{
  expect(studioPilotReadiness(base)).toBe('server_preconditions_met')
  expect(studioPilotSigner(base).asymmetricKeyType).toBe('ed25519')
 })
 it('never supplies a key from disabled configuration',()=>{
  expect(()=>studioPilotSigner({...base,
   SPAKTOK_STUDIO_PILOT_ENABLED:'false',
  })).toThrow('studio_pilot_not_configured')
 })
})
