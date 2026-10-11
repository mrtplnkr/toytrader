import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getOmnivaClient, omnivaUsername, omnivaPassword} from "./omniva";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

interface GetShippingPriceRequest {
  toySize: string;
}

/**
 * Returns an estimated shipping price for a toy size. Under OMNIVA_MODE=stub
 * this is a deterministic placeholder, not a real quote - see
 * STUB_PRICE_CENTS_BY_SIZE in omniva.ts. The frontend must not present this
 * as authoritative; it also links to Omniva's own price page.
 */
export const getShippingPrice = onCall<GetShippingPriceRequest>(
  {region: REGION, secrets: [omnivaUsername, omnivaPassword]},
  async (request) => {
    const {toySize} = request.data ?? {};
    if (!toySize) {
      throw new HttpsError("invalid-argument", "toySize is required.");
    }

    return getOmnivaClient().getShippingPrice({toySize});
  }
);
