import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')

  if (!secretKey || !webhookSecret || !signature) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 })
  }

  const stripe = new Stripe(secretKey)
  const payload = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.payment_status === 'paid') {
      console.log('[v0] Stripe checkout paid', {
        sessionId: session.id,
        productId: session.metadata?.productId,
        customerEmail: session.customer_details?.email,
      })
    }
  }

  return NextResponse.json({ received: true })
}
