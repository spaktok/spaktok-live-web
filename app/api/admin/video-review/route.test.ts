import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { getAuthenticatedUserId } from '@/lib/supabase/get-authenticated-user-id'
import { createClient } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/get-authenticated-user-id', () => ({
  getAuthenticatedUserId: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
const ADMIN = 'f5afad1d-2565-488b-a571-cece1e00ebc9'
describe('moderation access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SPAKTOK_MODERATION_ENABLED', 'true')
    vi.stubEnv('SPAKTOK_ADMIN_USER_ID', ADMIN)
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test_server_only')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  })
  it('fails closed when feature disabled', async () => {
    vi.stubEnv('SPAKTOK_MODERATION_ENABLED', 'false')
    expect((await GET()).status).toBe(503)
    expect(createClient).not.toHaveBeenCalled()
  })
  it('rejects anonymous without instantiating privileged DB', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
  })
  it('rejects normal users without privileged DB access', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('bc390c6d-120d-41e4-b586-b79349241735')
    expect((await GET()).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })
  it('allows only configured admin to list uploads, never revealing creator identifiers', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(ADMIN)
    const qb = { select: vi.fn(), order: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) }
    qb.select.mockReturnValue(qb)
    qb.order.mockReturnValue(qb)
    vi.mocked(createClient).mockReturnValue({ from: () => qb } as never)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [], moderationEnabled: true })
  })
})
