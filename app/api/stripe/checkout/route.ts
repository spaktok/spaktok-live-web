import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getProduct } from '@/lib/products'
import { resolveCheckoutOrigin } from '@/lib/checkout-origin'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })

  const origin = resolveCheckoutOrigin(request.url, request.headers.get('origin'))
  if (!origin) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required' }, { status: 400 })
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'A valid JSON object is required' }, { status: 400 })
  }

  const body = payload as { productId?: unknown; quantity?: unknown }
  const product = typeof body.productId === 'string' ? getProduct(body.productId) : undefined
  const rawQuantity = body.quantity ?? 1
  if (!product || typeof rawQuantity !== 'number' || !Number.isSafeInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > 10) {
    return NextResponse.json({ error: 'Invalid product or quantity' }, { status: 400 })
  }
  const quantity = rawQuantity

  const stripe = new Stripe(secretKey)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: product.name, description: product.description },
        unit_amount: product.priceInCents,
      },
      quantity,
    }],
    success_url: `${origin}/?payment=success`,
    cancel_url: `${origin}/?payment=cancelled`,
    integration_identifier: `spaktok_checkout_${Math.random().toString(36).slice(2, 10)}`,
    metadata: { productId: product.id },
  })

  return NextResponse.json({ url: session.url })
}
