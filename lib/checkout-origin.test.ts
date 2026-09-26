import { describe, expect, it } from "vitest"
import { resolveCheckoutOrigin } from "./checkout-origin"

describe("resolveCheckoutOrigin", () => {
  it("uses the request URL origin when no Origin header is present", () => {
    expect(resolveCheckoutOrigin("https://spaktok.example/api/stripe/checkout", null)).toBe("https://spaktok.example")
  })

  it("accepts a matching browser origin", () => {
    expect(resolveCheckoutOrigin("https://spaktok.example/api/stripe/checkout", "https://spaktok.example")).toBe(
      "https://spaktok.example",
    )
  })

  it("rejects a different origin instead of using it as a Stripe redirect", () => {
    expect(resolveCheckoutOrigin("https://spaktok.example/api/stripe/checkout", "https://attacker.example")).toBeNull()
  })

  it("rejects malformed request and origin URLs", () => {
    expect(resolveCheckoutOrigin("not-a-url", "https://spaktok.example")).toBeNull()
    expect(resolveCheckoutOrigin("https://spaktok.example/api/checkout", "not-a-url")).toBeNull()
  })
})
