/**
 * SpakTok ultra-low-latency transport adapter for a FUTURE authorized
 * Cloudflare Stream live input. No keys or endpoints are bundled here.
 * Media from useCameraStudio.getOutputStream() already includes GPU effects.
 */
export interface LiveConnection {
  peer:RTCPeerConnection
  close:()=>Promise<void>
}
const ALLOWED=/^customer-[a-z0-9-]+\.cloudflarestream\.com$/i
export function validStreamEndpoint(value:string,action:'publish'|'play'):boolean{
  try{
    const url=new URL(value)
    return url.protocol==='https:'&&ALLOWED.test(url.hostname)&&
      url.pathname.endsWith('/webRTC/'+action)&&!url.username&&!url.password&&
      !url.hash&&!url.search&&url.pathname.split('/').length===4
  }catch{return false}
}
function timeoutSignal(timeout=12000){
  const controller=new AbortController()
  const handle=setTimeout(()=>controller.abort(),timeout)
  return{signal:controller.signal,clear:()=>clearTimeout(handle)}
}
async function negotiate(peer:RTCPeerConnection,endpoint:string):Promise<string|null>{
  const offer=await peer.createOffer()
  await peer.setLocalDescription(offer)
  const timeout=timeoutSignal()
  try{
    const response=await fetch(endpoint,{
      method:'POST',headers:{'Content-Type':'application/sdp'},
      body:offer.sdp,cache:'no-store',signal:timeout.signal,
    })
    if(!response.ok)throw new Error('live_negotiation_failed')
    const answer=await response.text()
    if(answer.length>64*1024||!answer.startsWith('v=0'))throw new Error('invalid_webrtc_answer')
    await peer.setRemoteDescription({type:'answer',sdp:answer})
    const location=response.headers.get('Location')
    if(!location)return null
    const session=new URL(location,endpoint)
    return session.origin===new URL(endpoint).origin?session.toString():null
  }finally{timeout.clear()}
}
/** WHIP publishing is a BILLABLE external action. Call only after a deliberate
 * user "Start live" gesture AND server-side stream authorization. */
export async function startWhipBroadcast(
  filteredMedia:MediaStream,
  publishUrl:string,
):Promise<LiveConnection>{
  if(!validStreamEndpoint(publishUrl,'publish'))throw new Error('invalid_stream_endpoint')
  if(filteredMedia.getVideoTracks().length!==1)throw new Error('video_track_required')
  const peer=new RTCPeerConnection()
  let session:string|null=null
  try{
    for(const track of [...filteredMedia.getVideoTracks().slice(0,1),...filteredMedia.getAudioTracks().slice(0,1)])
      peer.addTransceiver(track,{direction:'sendonly'})
    session=await negotiate(peer,publishUrl)
    return{peer,close:async()=>{
      peer.close()
      if(session){
        try{await fetch(session,{method:'DELETE',cache:'no-store',keepalive:true})}catch{}
      }
    }}
  }catch(error){peer.close();throw error}
}
/** WHEP viewer (no keys). Playback availability must be approved by the
 * authenticated stream-room service before returning the playback URL. */
export async function connectWhepViewer(
  playbackUrl:string,
  element:HTMLVideoElement,
):Promise<LiveConnection>{
  if(!validStreamEndpoint(playbackUrl,'play'))throw new Error('invalid_stream_endpoint')
  const peer=new RTCPeerConnection()
  const media=new MediaStream()
  peer.ontrack=e=>{if(!media.getTracks().includes(e.track))media.addTrack(e.track)}
  peer.addTransceiver('video',{direction:'recvonly'})
  peer.addTransceiver('audio',{direction:'recvonly'})
  try{
    const session=await negotiate(peer,playbackUrl)
    element.srcObject=media
    element.playsInline=true
    await element.play().catch(()=>undefined)
    return{peer,close:async()=>{
      peer.close()
      element.pause()
      element.srcObject=null
      media.getTracks().forEach(t=>t.stop())
      if(session){try{await fetch(session,{method:'DELETE',cache:'no-store',keepalive:true})}catch{}}
    }}
  }catch(error){peer.close();media.getTracks().forEach(t=>t.stop());throw error}
}
