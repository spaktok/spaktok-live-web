import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GET } from "./callback/route"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

const exchangeCodeForSession = vi.fn()

describe("email confirmation callback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
    } as never)
    exchangeCodeForSession.mockResolvedValue({ error: null })
  })

  it("redirects to an internal path after a successful confirmation", async () => {
    const request = new NextRequest("https://spaktok.example/auth/callback?code=valid&next=%2Fmessages")

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://spaktok.example/messages")
    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid")
  })

  it("rejects an external redirect target", async () => {
    const request = new NextRequest("https://spaktok.example/auth/callback?code=valid&next=https%3A%2F%2Fevil.example")

    const response = await GET(request)

    expect(response.headers.get("location")).toBe("https://spaktok.example/")
  })

  it("rejects protocol-relative redirect targets", async () => {
    const request = new NextRequest("https://spaktok.example/auth/callback?code=valid&next=%2F%2Fevil.example")

    const response = await GET(request)

    expect(response.headers.get("location")).toBe("https://spaktok.example/")
  })

  it("redirects to the authentication error page when no code is provided", async () => {
    const response = await GET(new NextRequest("https://spaktok.example/auth/callback"))

    expect(response.headers.get("location")).toBe("https://spaktok.example/auth/error")
    expect(createClient).not.toHaveBeenCalled()
  })
})
