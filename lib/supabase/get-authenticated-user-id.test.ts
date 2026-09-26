import { beforeEach, describe, expect, it, vi } from "vitest"
import { createClient } from "./server"
import { getAuthenticatedUserId } from "./get-authenticated-user-id"

vi.mock("./server", () => ({
  createClient: vi.fn(),
}))

const getUser = vi.fn()

describe("getAuthenticatedUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never)
  })

  it("returns the user ID from Supabase's verified user lookup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })

    await expect(getAuthenticatedUserId()).resolves.toBe("verified-user")
    expect(getUser).toHaveBeenCalledOnce()
  })

  it("returns null when Supabase cannot verify the current session", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "untrusted-user" } }, error: new Error("invalid token") })

    await expect(getAuthenticatedUserId()).resolves.toBeNull()
  })

  it("returns null when the session has no user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(getAuthenticatedUserId()).resolves.toBeNull()
  })
})
