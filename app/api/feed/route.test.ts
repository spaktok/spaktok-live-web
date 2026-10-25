import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

function mockDb(userId: string | null) {
  const result = { data: [], error: null }
  const qb: Record<string, any> = {}
  qb.select = vi.fn(() => qb)
  qb.order = vi.fn(() => qb)
  qb.limit = vi.fn(() => qb)
  qb.eq = vi.fn(() => qb)
  qb.or = vi.fn(() => qb)
  qb.then = (resolve: (value: typeof result) => void) => resolve(result)
  const from = vi.fn(() => qb)
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }) },
    from,
  } as never)
  return { from, qb }
}

describe('feed source authorization and database scoping', () => {
  beforeEach(() => vi.clearAllMocks())
  it('rejects unsupported feed modes', async () => {
    const response = await GET(new NextRequest('https://example.test/api/feed?source=unknown'))
    expect(response.status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })
  it('does not disclose an unfiltered following feed to anonymous users', async () => {
    const db = mockDb(null)
    const response = await GET(new NextRequest('https://example.test/api/feed?source=following'))
    expect(response.status).toBe(401)
    expect(db.from).not.toHaveBeenCalled()
  })
  it('uses inner joins and a verified user identity for followed creators', async () => {
    const userId = '8870d2e1-4098-48be-8ddf-82e83bb6ccde'
    const db = mockDb(userId)
    const response = await GET(new NextRequest('https://example.test/api/feed?source=following'))
    expect(response.status).toBe(200)
    expect(db.qb.select.mock.calls[0][0]).toContain('follows!follows_following_id_fkey!inner')
    expect(db.qb.eq).toHaveBeenCalledWith('profiles.following_link.follower_id', userId)
    expect(await response.json()).toEqual({ videos: [], nextCursor: null })
  })
  it('retains the public feed without following joins', async () => {
    const db = mockDb(null)
    const response = await GET(new NextRequest('https://example.test/api/feed?source=forYou'))
    expect(response.status).toBe(200)
    expect(db.qb.select.mock.calls[0][0]).not.toContain('following_link')
    expect(db.qb.eq).not.toHaveBeenCalled()
  })
})
