import { describe, expect, it, vi } from 'vitest'
import { decodeFeedCursor, encodeFeedCursor, listPublicVideoPage } from './video-feed'

const id = '12b13ed4-bcf0-441c-9ad1-85fb9a71caf4'
describe('D1 public feed cursor and visibility', () => {
  it('round-trips cursor', () => {
    const value = { createdAt: '2026-10-25 18:00:00', id }
    expect(decodeFeedCursor(encodeFeedCursor(value))).toEqual(value)
  })
  it('rejects bad cursors', () => {
    expect(() => decodeFeedCursor('nope')).toThrow('invalid_cursor')
    expect(() => decodeFeedCursor('a'.repeat(300))).toThrow('invalid_cursor')
  })
  it('only returns the published rows selected by its indexed query', async () => {
    const all = vi.fn().mockResolvedValue({results: [
      { id, user_id:id, media_url:'https://example.test/video.mp4', thumbnail_url:null,
        description:'hello',music:null,view_count:1,like_count:0,comment_count:0,share_count:0,
        created_at:'2026-10-25 18:00:00',username:'creator',display_name:'Creator',
        avatar_url:null,is_verified:0}
    ]})
    const statement: any = {bind:vi.fn(),all}
    statement.bind.mockReturnValue(statement)
    const prepare = vi.fn().mockReturnValue(statement)
    const result = await listPublicVideoPage({prepare} as never,{limit:1})
    expect(result.videos).toHaveLength(1)
    expect(result.videos[0].videoUrl).toBe('https://example.test/video.mp4')
    expect(prepare.mock.calls[0][0]).toContain("v.status='published'")
    expect(statement.bind).toHaveBeenCalledWith(null,null,2)
  })
})
