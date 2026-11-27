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

// Omniva's own "where is my parcel" event-code vocabulary has never been
// observed populated (see the TODO on getTrackingStatus below) - this
// matches loosely, by keyword, across every plausible field/shape rather
// than asserting one exact schema, so it degrades to UNKNOWN instead of
// throwing when the real shape turns out to differ from any of these
// guesses. Order matters: checked most-final-state-first, so a shipment
// that's both "delivered" and "in transit" in confused/overlapping event
// text still resolves to the more final status.
function latestStatusKeyword(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const events = (
    Array.isArray(record.events) ? record.events :
      Array.isArray(record.trackingEvents) ? record.trackingEvents :
        Array.isArray(record.history) ? record.history :
          Array.isArray(data) ? data :
            []
  ) as Record<string, unknown>[];

  if (events.length > 0) {
    const latest = events[events.length - 1];
    return String(latest.eventCode ?? latest.eventName ?? latest.status ?? latest.name ?? "").toLowerCase();
  }
  // No event list found - maybe the response is just a flat status object.
  return String(record.status ?? record.eventCode ?? record.eventName ?? "").toLowerCase();
}

function mapOmnivaResponseToStatus(data: unknown): OmnivaShipmentStatus {
  const keyword = latestStatusKeyword(data);
  if (!keyword) return "UNKNOWN";
  if (keyword.includes("deliver")) return "DELIVERED";
  if (keyword.includes("return")) return "RETURNED";
  if (keyword.includes("terminal") || keyword.includes("arriv") || keyword.includes("parcel_machine")) {
    return "ARRIVED_AT_TERMINAL";
  }
  if (keyword.includes("transit") || keyword.includes("depart") || keyword.includes("accept") ||
      keyword.includes("dispatch")) {
    return "IN_TRANSIT";
  }
  if (keyword.includes("register") || keyword.includes("created")) return "REGISTERED";
  return "UNKNOWN";
}

/**
 * Best-effort implementation against the public "where is my parcel"
 * endpoint Omniva's own consumer website uses (see the comment on
 * trackingApiBaseUrl below) - not their documented, credential-gated
 * business API. No confirmed response shape for a populated (non-empty)
 * result exists yet - every guessed field is marked with a
 * TODO(omniva-real-api) comment and must be validated against a real
 * barcode's response before being trusted. Do not enable OMNIVA_MODE=real
 * in any deployed/shared environment until then.
 */
class RealOmnivaClient implements OmnivaClient {
  // NOT Omniva's documented business API (developer.omniva.ee's
  // getTrackingInfoByBarCode) - that one requires HTTP Basic Auth
  // credentials from an Account Manager, the same business-contract
  // requirement this app deliberately avoids everywhere else (see the
  // comment on OmnivaClient above). This is instead the public,
  // unauthenticated endpoint Omniva's own "Where is my parcel"/"Kur mano
  // siunta?" widget on their consumer website calls - confirmed 2026-11-27
  // by loading https://www.omniva.ee/en/track-and-receive-parcels/ in a
  // real browser, typing a barcode into the tracking-number field, and
  // watching the network request. No login/API key needed, and a
  // nonexistent test barcode returned HTTP 200 with an empty body rather
  // than an error. It is an undocumented internal implementation detail of
  // their WordPress theme, not a published/stable API - it can change or
  // disappear with zero notice and there's no support channel, since
  // there's no business relationship behind it.
  private readonly trackingApiBaseUrl = defineString("OMNIVA_TRACKING_API_BASE_URL", {
    default: "https://www.omniva.ee/wp-json/custom/v1/omniva-where-is-parcel",
  });

  async getTrackingStatus(barcode: string): Promise<OmnivaTrackingResult> {
    // TODO(omniva-real-api): the endpoint itself is confirmed (see comment
    // above), but its response shape for an actual in-transit/delivered
    // parcel has never been observed - only the empty-result case for a
    // barcode that doesn't exist. mapOmnivaResponseToStatus below is
    // best-effort keyword matching across several plausible shapes, not a
    // verified field-by-field schema. Revisit once a real tracked
    // barcode's response has actually been seen.
    const url = `${this.trackingApiBaseUrl.value()}?track=${encodeURIComponent(barcode)}&lang=en`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Omniva tracking lookup failed: HTTP ${res.status} for barcode ${barcode}`);
    }

    const text = await res.text();
    if (!text.trim()) {
      // Confirmed real behavior for an unrecognized barcode - not
      // necessarily an error, just nothing to report yet (e.g. the parcel
      // was only just registered and hasn't reached Omniva's system).
      return {status: "UNKNOWN"};
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(`Omniva tracking lookup returned non-JSON response for ${barcode}: ${text.slice(0, 200)}`);
    }

    return {status: mapOmnivaResponseToStatus(data)};
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
