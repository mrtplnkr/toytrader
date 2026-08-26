import Stripe from "stripe";
import {defineSecret} from "firebase-functions/params";

export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

let cachedStripe: Stripe | undefined;

/**
 * Secrets defined via defineSecret only resolve once a function actually
 * runs, not at module load - so the Stripe client must be constructed
 * lazily inside a handler, never at the top level of this module.
 */
export const getStripe = (): Stripe => {
  if (!cachedStripe) {
    cachedStripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2023-08-16",
    });
  }
  return cachedStripe;
};
