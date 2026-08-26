import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";

export type ShipmentSide = "offer" | "target";

export interface OmnivaShipmentRequest {
  offerId: string;
  side: ShipmentSide;
}

export interface OmnivaShipmentResult {
  barcode: string;
  labelUrl?: string;
}

export interface OmnivaClient {
  createShipment(req: OmnivaShipmentRequest): Promise<OmnivaShipmentResult>;
}

/**
 * No real Omniva credentials/API docs exist yet. Returns a deterministic
 * fake barcode with no network call, so the Stripe -> barcode flow is fully
 * testable end-to-end before Omniva is actually wired up.
 */
class StubOmnivaClient implements OmnivaClient {
  async createShipment(req: OmnivaShipmentRequest): Promise<OmnivaShipmentResult> {
    logger.info("StubOmnivaClient.createShipment", req);
    return {barcode: `STUB-${req.offerId}-${req.side}-${Date.now()}`};
  }
}

/**
 * Placeholder for the real Omniva API integration. Fill in once merchant
 * credentials and API docs are available - the calling code (index.ts)
 * never needs to change, only omnivaMode below.
 */
class RealOmnivaClient implements OmnivaClient {
  async createShipment(_req: OmnivaShipmentRequest): Promise<OmnivaShipmentResult> {
    throw new Error("RealOmnivaClient is not implemented yet - set OMNIVA_MODE=stub");
  }
}

const omnivaMode = defineString("OMNIVA_MODE", {default: "stub"});

let cachedClient: OmnivaClient | undefined;

export const getOmnivaClient = (): OmnivaClient => {
  if (!cachedClient) {
    cachedClient = omnivaMode.value() === "real" ?
      new RealOmnivaClient() :
      new StubOmnivaClient();
  }
  return cachedClient;
};
