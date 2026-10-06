import * as logger from "firebase-functions/logger";
import {defineString, defineSecret} from "firebase-functions/params";

export type ShipmentSide = "offer" | "target";

export interface ParcelMachine {
  id: string;
  name: string;
  address: string;
  countryCode: string;
  type: string;
}

export type OmnivaShipmentStatus =
  | "REGISTERED"
  | "IN_TRANSIT"
  | "ARRIVED_AT_TERMINAL"
  | "DELIVERED"
  | "RETURNED"
  | "UNKNOWN";

export interface OmnivaShipmentRequest {
  offerId: string;
  side: ShipmentSide;
  destinationTerminalId: string;
  toySize: string;
}

export interface OmnivaShipmentResult {
  barcode: string;
  labelUrl?: string;
}

export interface OmnivaTrackingResult {
  status: OmnivaShipmentStatus;
}

export interface OmnivaShippingPriceRequest {
  destinationTerminalId: string;
  toySize: string;
}

export interface OmnivaShippingPriceResult {
  priceCents: number;
  currency: string;
}

export interface OmnivaClient {
  createShipment(req: OmnivaShipmentRequest): Promise<OmnivaShipmentResult>;
  listParcelMachines(): Promise<ParcelMachine[]>;
  getTrackingStatus(barcode: string): Promise<OmnivaTrackingResult>;
  getShippingPrice(req: OmnivaShippingPriceRequest): Promise<OmnivaShippingPriceResult>;
}

// Not real credentials yet - declared so every function that may call
// getOmnivaClient() under OMNIVA_MODE=real can statically list these secrets,
// even while OMNIVA_MODE still defaults to "stub".
export const omnivaUsername = defineSecret("OMNIVA_USERNAME");
export const omnivaPassword = defineSecret("OMNIVA_PASSWORD");

const STUB_PARCEL_MACHINES: ParcelMachine[] = [
  {id: "88894", name: "Tallinn Ülemiste Selver", address: "Suur-Sõjamäe 4, Tallinn",
    countryCode: "EE", type: "parcel_machine"},
  {id: "89164", name: "Tartu Lõunakeskus", address: "Ringtee 75, Tartu",
    countryCode: "EE", type: "parcel_machine"},
  {id: "39102", name: "Riga Origo", address: "Stacijas laukums 2, Riga",
    countryCode: "LV", type: "parcel_machine"},
  {id: "39221", name: "Riga Alfa", address: "Brīvības gatve 372, Riga",
    countryCode: "LV", type: "parcel_machine"},
  {id: "23904", name: "Vilnius Akropolis", address: "Ozo g. 25, Vilnius",
    countryCode: "LT", type: "parcel_machine"},
  {id: "24011", name: "Kaunas Mega", address: "Islandijos pl. 32, Kaunas",
    countryCode: "LT", type: "parcel_machine"},
];

// Omniva's locations endpoint is confirmed real and public (no credentials
// needed) - despite the .ee domain it returns the full Baltic-wide dataset
// (confirmed: ~470 EE + ~415 LV + ~560 LT entries, not EE-only). TYPE "0" is
// a parcel machine; other TYPE values (post office counters etc.) are
// filtered out since this app only supports self-service parcel-machine
// drop-off. Address fields are A5_NAME (street) + A7_NAME (building number)
// + A3_NAME (city) - verified against live sample data.
async function fetchRealParcelMachines(): Promise<ParcelMachine[]> {
  const res = await fetch("https://www.omniva.ee/locations.json");
  if (!res.ok) {
    throw new Error(`Omniva locations fetch failed: ${res.status}`);
  }
  const raw = await res.json() as Array<Record<string, unknown>>;
  return raw
    .filter((entry) => entry["TYPE"] === "0")
    .map((entry) => {
      const street = String(entry["A5_NAME"] ?? "").trim();
      const buildingNr = String(entry["A7_NAME"] ?? "").trim();
      const city = String(entry["A3_NAME"] ?? "").trim();
      const address = [street && buildingNr ? `${street} ${buildingNr}` : street, city]
        .filter(Boolean).join(", ");
      return {
        id: String(entry["ZIP"] ?? ""),
        name: String(entry["NAME"] ?? ""),
        address,
        countryCode: String(entry["A0_NAME"] ?? ""),
        type: "parcel_machine",
      };
    })
    .filter((m) => m.id && m.name);
}

const STUB_STATUS_SEQUENCE: OmnivaShipmentStatus[] = [
  "REGISTERED",
  "IN_TRANSIT",
  "ARRIVED_AT_TERMINAL",
  "DELIVERED",
];

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
 * data with no network calls, so the full parcel-machine-pick -> pay ->
 * barcode -> status-tracking -> notification pipeline is testable end-to-end
 * against the Firebase emulators before Omniva is actually wired up.
 */
class StubOmnivaClient implements OmnivaClient {
  private readonly trackingCallCounts = new Map<string, number>();

  async createShipment(req: OmnivaShipmentRequest): Promise<OmnivaShipmentResult> {
    logger.info("StubOmnivaClient.createShipment", req);
    return {barcode: `STUB-${req.offerId}-${req.side}-${Date.now()}`};
  }

  async listParcelMachines(): Promise<ParcelMachine[]> {
    // The real terminal-list endpoint is public and needs no credentials, so
    // we use real data here even in stub mode - lets users actually search
    // their own area. createShipment/getTrackingStatus/getShippingPrice stay
    // fully fake, since those need real credentials/contact info we don't
    // have yet. Falls back to a tiny hardcoded fixture if the fetch fails
    // (e.g. offline local dev), so the picker never ends up empty.
    try {
      return await fetchRealParcelMachines();
    } catch (err) {
      logger.error("StubOmnivaClient.listParcelMachines: live fetch failed, using fixture", err);
      return STUB_PARCEL_MACHINES;
    }
  }

  async getTrackingStatus(barcode: string): Promise<OmnivaTrackingResult> {
    const callCount = this.trackingCallCounts.get(barcode) ?? 0;
    this.trackingCallCounts.set(barcode, callCount + 1);
    const index = Math.min(callCount, STUB_STATUS_SEQUENCE.length - 1);
    return {status: STUB_STATUS_SEQUENCE[index]};
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
  private readonly apiBaseUrl = defineString("OMNIVA_API_BASE_URL", {
    default: "https://edixml.test.post.ee/epmx/services",
  });

  private readonly trackingApiBaseUrl = defineString("OMNIVA_TRACKING_API_BASE_URL", {
    default: "https://tracking.omniva.ee/api",
  });

  async listParcelMachines(): Promise<ParcelMachine[]> {
    return fetchRealParcelMachines();
  }

  async createShipment(req: OmnivaShipmentRequest): Promise<OmnivaShipmentResult> {
    // TODO(omniva-real-api): real shipment registration requires recipient
    // name/phone/address, which this app does not currently collect anywhere
    // - that's a product decision to make (collect it at pay time, on first
    // login, etc.) before this can actually register a real label. Do not
    // fabricate placeholder contact data here.
    throw new Error(
      "RealOmnivaClient.createShipment is not implemented - recipient contact " +
      "details are not yet collected anywhere in the app, and the request/" +
      "response shape below is unverified against real Omniva docs. " +
      `(base url configured: ${this.apiBaseUrl.value()}, ` +
      `terminal: ${req.destinationTerminalId})`
    );
  }

  async getTrackingStatus(barcode: string): Promise<OmnivaTrackingResult> {
    // TODO(omniva-real-api): endpoint, auth, and status-code mapping below
    // are unverified guesses pending real Omniva tracking API docs.
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
      `Omniva price-quote endpoint exists yet. (terminal: ${req.destinationTerminalId}, ` +
      `size: ${req.toySize})`
    );
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
