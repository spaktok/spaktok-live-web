import {describe,expect,it} from 'vitest'
import {validStreamEndpoint} from './webrtc'
describe('Cloudflare WHIP/WHEP endpoint safety',()=>{
  it('accepts properly formed Cloudflare publish & playback URLs',()=>{
    expect(validStreamEndpoint('https://customer-abc.cloudflarestream.com/secret/webRTC/publish','publish')).toBe(true)
    expect(validStreamEndpoint('https://customer-abc.cloudflarestream.com/id/webRTC/play','play')).toBe(true)
  })
  it('rejects arbitrary endpoints or credential injection',()=>{
    expect(validStreamEndpoint('https://other.example.com/x/webRTC/publish','publish')).toBe(false)
    expect(validStreamEndpoint('http://customer-abc.cloudflarestream.com/x/webRTC/publish','publish')).toBe(false)
    expect(validStreamEndpoint('https://customer-abc.cloudflarestream.com/x/webRTC/play','publish')).toBe(false)
    expect(validStreamEndpoint('https://customer-abc.cloudflarestream.com/x/webRTC/publish?next=evil','publish')).toBe(false)
  })
})
