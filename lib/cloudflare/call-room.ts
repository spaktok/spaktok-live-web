export type CallSignal =
  | { type: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
  | { type: 'call-state'; state: 'ringing' | 'accepted' | 'declined' | 'ended' }

export interface CallRoomSocket {
  send(message: string): void
  close(code?: number, reason?: string): void
}

export interface CallRoomState {
  sockets: Set<CallRoomSocket>
  startedAt: number
  lastActivityAt: number
}

export function createCallRoomState(now = Date.now()): CallRoomState {
  return { sockets: new Set(), startedAt: now, lastActivityAt: now }
}

export function relayCallSignal(state: CallRoomState, sender: CallRoomSocket, signal: CallSignal, now = Date.now()): void {
  state.lastActivityAt = now
  const message = JSON.stringify({ ...signal, sentAt: now })
  for (const socket of state.sockets) {
    if (socket !== sender) socket.send(message)
  }
}

export function closeCallRoom(state: CallRoomState, reason = 'call-ended'): void {
  for (const socket of state.sockets) socket.close(1000, reason)
  state.sockets.clear()
}

export function isCallRoomExpired(state: CallRoomState, now = Date.now(), ttlMs = 60 * 60 * 1000): boolean {
  return now - state.lastActivityAt > ttlMs
}
