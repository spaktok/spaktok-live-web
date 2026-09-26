import { describe, expect, it } from 'vitest'
import { closeCallRoom, createCallRoomState, isCallRoomExpired, relayCallSignal } from './call-room'

describe('call room signaling', () => {
  it('relays signals to peers only', () => {
    const state = createCallRoomState(100)
    const sender = { send: () => {}, close: () => {} }
    const peer = { messages: [] as string[], send(message: string) { this.messages.push(message) }, close: () => {} }
    state.sockets.add(sender)
    state.sockets.add(peer)
    relayCallSignal(state, sender, { type: 'call-state', state: 'ringing' }, 200)
    expect(peer.messages).toHaveLength(1)
    expect(peer.messages[0]).toContain('ringing')
  })

  it('expires inactive rooms and closes sockets', () => {
    const state = createCallRoomState(0)
    let closed = false
    state.sockets.add({ send: () => {}, close: () => { closed = true } })
    expect(isCallRoomExpired(state, 60 * 60 * 1000 + 1)).toBe(true)
    closeCallRoom(state)
    expect(closed).toBe(true)
    expect(state.sockets.size).toBe(0)
  })
})
