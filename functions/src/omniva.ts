import * as logger from "firebase-functions/logger";
import {defineString, defineSecret} from "firebase-functions/params";

export type ShipmentSide = "offer" | "target";

export type OmnivaShipmentStatus =
  | "REGISTERED"
  | "IN_TRANSIT"
  | "ARRIVED_AT_TERMINAL"
  | "DELIVERED"
  | "RETURNED"
  | "UNKNOWN";

export interface OmnivaTrackingResult {
  status: OmnivaShipmentStatus;
}

export interface OmnivaShippingPriceRequest {
  toySize: string;
}

export interface OmnivaShippingPriceResult {
  priceCents: number;
  currency: string;
}

// No business/API shipment-creation capability - Omniva only grants
// programmatic shipment registration to contracted business customers, and
// this app doesn't have (or want to require) a business contract. Users
// register their own shipment directly on Omniva's consumer site/app (as a
// private individual, no contract needed) and paste the resulting barcode
// into the app themselves - see submitOmnivaBarcode in helper.ts on the
// frontend. There's no way to deep-link a chosen destination terminal into
// that flow either, so this app doesn't ask the user to pick one itself
// (previously it did via listParcelMachines, which this interface used to
// expose - removed since nothing could make use of the selection). This
// client only covers what's still genuinely useful without a business
// account: a best-effort price estimate, and (once implemented)
// tracking-by-barcode, which is commonly a public/no-contract-needed lookup
// even where creation isn't.
export interface OmnivaClient {
  getTrackingStatus(barcode: string): Promise<OmnivaTrackingResult>;
  getShippingPrice(req: OmnivaShippingPriceRequest): Promise<OmnivaShippingPriceResult>;
}

// Not real credentials yet - declared so every function that may call
// getOmnivaClient() under OMNIVA_MODE=real can statically list these secrets,
// even while OMNIVA_MODE still defaults to "stub".
export const omnivaUsername = defineSecret("OMNIVA_USERNAME");
export const omnivaPassword = defineSecret("OMNIVA_PASSWORD");

export const omnivaMode = defineString("OMNIVA_MODE", {default: "stub"});
export const isRealOmnivaMode = (): boolean => omnivaMode.value() === "real";

// Not real Omniva prices - deterministic placeholders for local testing only.
// Loosely based on publicly-observed Baltic parcel-machine-to-parcel-machine
// pricing at the time this was written, but Omniva has no stable public price
// table (see OMNIVA_PRICE_LIST_URL on the frontend) and these will drift out
// of date. Never present this as an authoritative price - always point users
// at Omniva's own site too.
const STUB_PRICE_CENTS_BY_SIZE: Record<string, number> = {
  S: 309,
  M: 409,
  L: 509,
  XL: 699,
};

/**
 * No real Omniva credentials/API docs exist yet. Returns deterministic fake
 * price estimates with no network calls. getTrackingStatus intentionally
 * does NOT fabricate status progression here - barcodes are now real,
 * user-entered values (see submitOmnivaBarcode), and inventing fake
 * "IN_TRANSIT"/"DELIVERED" progress for a real parcel would be actively
 * misleading, not just a harmless test fixture. syncOmnivaShipmentStatuses
 * skips calling this entirely while not in real mode - see isRealOmnivaMode().
 */
class StubOmnivaClient implements OmnivaClient {
  async getTrackingStatus(): Promise<OmnivaTrackingResult> {
    throw new Error(
      "StubOmnivaClient.getTrackingStatus should never be called - " +
      "syncOmnivaShipmentStatuses must check isRealOmnivaMode() first."
    );
  }

  async getShippingPrice(req: OmnivaShippingPriceRequest): Promise<OmnivaShippingPriceResult> {
    logger.info("StubOmnivaClient.getShippingPrice", req);
    const priceCents = STUB_PRICE_CENTS_BY_SIZE[req.toySize] ?? STUB_PRICE_CENTS_BY_SIZE.S;
    return {priceCents, currency: "EUR"};
  }
}

/**
 * Best-effort implementation against Omniva's publicly-known REST API shape.
 * No confirmed merchant credentials, sandbox, or docs exist yet - every
 * guessed endpoint/field is marked with a TODO(omniva-real-api) comment and
 * must be validated once real docs are available. Do not enable
 * OMNIVA_MODE=real in any deployed/shared environment until then.
 */
class RealOmnivaClient implements OmnivaClient {
  private readonly trackingApiBaseUrl = defineString("OMNIVA_TRACKING_API_BASE_URL", {
    default: "https://tracking.omniva.ee/api",
  });

  async getTrackingStatus(barcode: string): Promise<OmnivaTrackingResult> {
    // TODO(omniva-real-api): endpoint, auth, and status-code mapping below
    // are unverified guesses pending real Omniva tracking API docs. Worth
    // checking whether tracking-by-barcode is public/no-contract-needed even
    // though shipment creation requires a business contract - trackers
    // commonly are, since that's a customer-facing feature.
    throw new Error(
      "RealOmnivaClient.getTrackingStatus is not implemented - tracking API " +
      `shape unverified. (base url configured: ${this.trackingApiBaseUrl.value()}, ` +
      `barcode: ${barcode})`
    );
  }

  async getShippingPrice(req: OmnivaShippingPriceRequest): Promise<OmnivaShippingPriceResult> {
    // TODO(omniva-real-api): Omniva exposes no documented price-quote
    // endpoint we've confirmed - their own site uses an internal calculator,
    // not a public API. Do not fabricate a price here; this must stay
    // unimplemented until a real quote endpoint is confirmed.
    throw new Error(
      "RealOmnivaClient.getShippingPrice is not implemented - no confirmed " +
      `Omniva price-quote endpoint exists yet. (size: ${req.toySize})`
    );
  }
}

let cachedClient: OmnivaClient | undefined;

export const getOmnivaClient = (): OmnivaClient => {
  if (!cachedClient) {
    cachedClient = isRealOmnivaMode() ?
      new RealOmnivaClient() :
      new StubOmnivaClient();
  }
  return cachedClient;
};
