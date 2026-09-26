import { describe, expect, it, vi } from "vitest"
import { insertD1TextMessage, listD1Messages } from "./d1-repository"

function database(result: unknown) {
  const first = vi.fn().mockResolvedValue(result)
  const all = vi.fn().mockResolvedValue({ results: [] })
  const run = vi.fn().mockResolvedValue({ success: true })
  const statement = { bind: vi.fn(() => statement), first, all, run }
  const prepare = vi.fn(() => statement)
  return { prepare, first, all, run }
}

describe("D1 conversation authorization", () => {
  it("rejects message reads for non-members", async () => {
    const db = database(null)
    await expect(listD1Messages(db, "user-a", "private-conversation")).rejects.toThrow("conversation_forbidden")
  })

  it("rejects oversized messages before writing", async () => {
    const db = database({ id: "private-conversation" })
    await expect(insertD1TextMessage(db, "user-a", "private-conversation", "x".repeat(4001))).rejects.toThrow(
      "invalid_message_content",
    )
    expect(db.prepare).not.toHaveBeenCalled()
  })
})
