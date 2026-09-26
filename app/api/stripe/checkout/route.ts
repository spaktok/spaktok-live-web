import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getProduct } from '@/lib/products'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })

  const body = await request.json() as { productId?: string; quantity?: number }
  const product = body.productId ? getProduct(body.productId) : undefined
  const quantity = body.quantity ?? 1
  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: 'Invalid product or quantity' }, { status: 400 })
  }

  const stripe = new Stripe(secretKey)
  const origin = request.headers.get('origin') ?? new URL(request.url).origin
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

