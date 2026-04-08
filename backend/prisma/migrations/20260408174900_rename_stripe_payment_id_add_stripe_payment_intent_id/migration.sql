-- Rename to reflect Stripe Checkout Session id (cs_...).
ALTER TABLE "purchases" RENAME COLUMN "stripe_payment_id" TO "stripe_checkout_session_id";

-- Optional PaymentIntent id (pi_...); populated when Stripe returns it on session create.
ALTER TABLE "purchases" ADD COLUMN "stripe_payment_intent_id" TEXT;
