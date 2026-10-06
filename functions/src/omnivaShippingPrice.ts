import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getOmnivaClient, omnivaUsername, omnivaPassword} from "./omniva";
import {isValidParcelMachineId} from "./omnivaParcelMachines";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

interface GetShippingPriceRequest {
  parcelMachineId: string;
  toySize: string;
}

/**
 * Returns an estimated shipping price for a destination terminal + toy size.
 * Under OMNIVA_MODE=stub this is a deterministic placeholder, not a real
 * quote - see STUB_PRICE_CENTS_BY_SIZE in omniva.ts. The frontend must not
 * present this as authoritative; it also links to Omniva's own price page.
 */
export const getShippingPrice = onCall<GetShippingPriceRequest>(
  {region: REGION, secrets: [omnivaUsername, omnivaPassword]},
  async (request) => {
    const {parcelMachineId, toySize} = request.data ?? {};
    if (!parcelMachineId || !toySize) {
      throw new HttpsError("invalid-argument", "parcelMachineId and toySize are required.");
    }

    if (!(await isValidParcelMachineId(parcelMachineId))) {
      throw new HttpsError("invalid-argument", "Unknown parcel machine.");
    }

    return getOmnivaClient().getShippingPrice({destinationTerminalId: parcelMachineId, toySize});
  }
);
