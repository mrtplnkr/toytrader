import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineString} from "firebase-functions/params";
import {getStripe, stripeSecretKey} from "./stripe";

const REGION = "europe-west1";

// Fixed tiers rather than a visitor-typed amount - simpler to build (mirrors
// startShipmentCheckout's fixed-price session almost exactly) and fixed
// amounts convert better than asking people to type a number.
const ALLOWED_DONATION_CENTS = [300, 500, 1000];

const appBaseUrl = defineString("APP_BASE_URL", {default: "http://localhost:3000"});

interface StartDonationCheckoutRequest {
  amountCents: number;
}

/**
 * Starts a Stripe Checkout session for a one-off donation to ToyTrader from
 * the public landing page. Entirely separate from the per-shipment optional
 * tip in shipment.ts - no offer, no signed-in user required (the public
 * page has no auth gate), and no Firestore read/write at all. The webhook
 * in shipment.ts acknowledges this session via its "donation" metadata
 * without touching any offer.
 */
export const startDonationCheckout = onCall<StartDonationCheckoutRequest>(
  {region: REGION, secrets: [stripeSecretKey]},
  async (request) => {
    const {amountCents} = request.data ?? {};
    if (!ALLOWED_DONATION_CENTS.includes(amountCents)) {
      throw new HttpsError("invalid-argument", "Unsupported donation amount.");
    }

    const stripe = getStripe();
    const baseUrl = appBaseUrl.value();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {name: "Donation to ToyTrader"},
        },
        quantity: 1,
      }],
      metadata: {kind: "donation"},
      success_url: `${baseUrl}/?donation=success`,
      cancel_url: `${baseUrl}/?donation=cancel`,
    });

    return {checkoutUrl: session.url};
  }
);
