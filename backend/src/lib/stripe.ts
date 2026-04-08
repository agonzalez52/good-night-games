import Stripe from "stripe";

const getStripeSecretKey = (): string => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key === undefined || key.trim() === "") {
    throw new Error(
      "Missing STRIPE_SECRET_KEY: set this environment variable before starting the server.",
    );
  }
  return key;
};

export const stripe = new Stripe(getStripeSecretKey(), {
  // @ts-expect-error Pinned API version; stripe-node types only allow LatestApiVersion (see Stripe.StripeConfig).
  apiVersion: "2024-06-20",
});
