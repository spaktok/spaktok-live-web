import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { getAuthenticatedUserId } from "@/lib/supabase/get-authenticated-user-id"
import { getCloudflareBindings } from "@/lib/cloudflare/env"
import { insertD1TextMessage, listD1Conversations, listD1Messages } from "@/lib/cloudflare/d1-repository"
import { GET as getConversations } from "./conversations/route"
import { GET as getMessages } from "./messages/route"
import { POST as postMessage } from "./messages/route"

vi.mock("@/lib/supabase/get-authenticated-user-id", () => ({
  getAuthenticatedUserId: vi.fn(),
}))
vi.mock("@/lib/cloudflare/env", () => ({
  getCloudflareBindings: vi.fn(),
}))
vi.mock("@/lib/cloudflare/d1-repository", () => ({
  listD1Conversations: vi.fn(),
  listD1Messages: vi.fn(),
  insertD1TextMessage: vi.fn(),
}))

describe("authenticated Cloudflare API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCloudflareBindings).mockReturnValue({ DB: {} as never })
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null)
    vi.mocked(listD1Conversations).mockResolvedValue([])
    vi.mocked(listD1Messages).mockResolvedValue([])
    vi.mocked(insertD1TextMessage).mockResolvedValue({ id: "message" } as never)
  })

  it("does not accept a client-supplied identity for conversations", async () => {
    const request = new NextRequest("https://spaktok.test/api/cloudflare/conversations", {
      headers: { "x-spaktok-user-id": "attacker-user" },
    })

    const response = await getConversations(request)

    expect(response.status).toBe(401)
    expect(listD1Conversations).not.toHaveBeenCalled()
  })

  it("uses the verified session identity and ignores spoofed headers", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("verified-user")
    const request = new NextRequest("https://spaktok.test/api/cloudflare/conversations", {
      headers: { "x-spaktok-user-id": "attacker-user" },
    })

    const response = await getConversations(request)

    expect(response.status).toBe(200)
    expect(listD1Conversations).toHaveBeenCalledWith(expect.anything(), "verified-user")
  })

  it("requires a verified session before reading messages even when a user header is present", async () => {
    const request = new NextRequest("https://spaktok.test/api/cloudflare/messages?conversationId=private", {
      headers: { "x-spaktok-user-id": "attacker-user" },
    })

    const response = await getMessages(request)

    expect(response.status).toBe(401)
    expect(listD1Messages).not.toHaveBeenCalled()
  })

  it("does not accept a client-supplied identity when sending messages", async () => {
    const request = new NextRequest("https://spaktok.test/api/cloudflare/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-spaktok-user-id": "attacker-user" },
      body: JSON.stringify({ conversationId: "private", content: "hello" }),
    })

    const response = await postMessage(request)

    expect(response.status).toBe(401)
    expect(insertD1TextMessage).not.toHaveBeenCalled()
  })

  it("returns a client error for malformed JSON without attempting a database write", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("verified-user")
    const request = new NextRequest("https://spaktok.test/api/cloudflare/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })

    const response = await postMessage(request)

    expect(response.status).toBe(400)
    expect(insertD1TextMessage).not.toHaveBeenCalled()
  })

  it("sets the sender from the verified session rather than the request header", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("verified-user")
    const request = new NextRequest("https://spaktok.test/api/cloudflare/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-spaktok-user-id": "attacker-user" },
      body: JSON.stringify({ conversationId: "private", content: "hello" }),
    })

    const response = await postMessage(request)

    expect(response.status).toBe(201)
    expect(insertD1TextMessage).toHaveBeenCalledWith(expect.anything(), "verified-user", "private", "hello")
  })
})
