import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Bumped from parcelMachines to v2 when lat/lng were added - a same-path
// cache hit would otherwise keep serving up to 24h of already-cached
// entries from before that field existed.
const CACHE_DOC_PATH = "omnivaCache/parcelMachinesV2";

export interface ParcelMachine {
  id: string;
  name: string;
  address: string;
  countryCode: string;
  type: string;
  lat: number;
  lng: number;
}

interface CacheEntry {
  machines: ParcelMachine[];
  fetchedAt: number;
}

const STUB_PARCEL_MACHINES: ParcelMachine[] = [
  {id: "88894", name: "Tallinn Ülemiste Selver", address: "Suur-Sõjamäe 4, Tallinn",
    countryCode: "EE", type: "parcel_machine", lat: 59.4239, lng: 24.7704},
  {id: "39102", name: "Riga Origo", address: "Stacijas laukums 2, Riga",
    countryCode: "LV", type: "parcel_machine", lat: 56.9465, lng: 24.1049},
  {id: "23904", name: "Vilnius Akropolis", address: "Ozo g. 25, Vilnius",
    countryCode: "LT", type: "parcel_machine", lat: 54.7212, lng: 25.2522},
];

// Public, unauthenticated, and confirmed to return the full Baltic-wide
// dataset (~1450 entries) despite the .ee domain. TYPE "0" is a parcel
// machine; other TYPE values (post office counters etc.) are filtered out
// since this app only supports self-service parcel-machine drop-off/pickup.
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
        // Omniva's field names are swapped from the usual convention:
        // X_COORDINATE is longitude, Y_COORDINATE is latitude - verified
        // against live sample data (Tallinn entries have Y around 59, the
        // right ballpark for latitude, not longitude).
        lat: parseFloat(String(entry["Y_COORDINATE"] ?? "")),
        lng: parseFloat(String(entry["X_COORDINATE"] ?? "")),
      };
    })
    .filter((m) => m.id && m.name && Number.isFinite(m.lat) && Number.isFinite(m.lng));
}

// Firestore-backed cache in front of the fetch above (semi-static, large
// list - a day-long TTL avoids hammering Omniva), with an in-memory
// fast path on top so a warm instance doesn't re-read Firestore every call.
let memoryCache: CacheEntry | undefined;

async function getCachedParcelMachines(): Promise<ParcelMachine[]> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.machines;
  }

  const db = getFirestore();
  const docRef = db.doc(CACHE_DOC_PATH);
  const snap = await docRef.get();
  const cached = snap.data() as CacheEntry | undefined;
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    memoryCache = cached;
    return cached.machines;
  }

  try {
    const machines = await fetchRealParcelMachines();
    const entry: CacheEntry = {machines, fetchedAt: now};
    await docRef.set(entry);
    memoryCache = entry;
    return machines;
  } catch (err) {
    logger.error("getCachedParcelMachines: live fetch failed, using fixture", err);
    return STUB_PARCEL_MACHINES;
  }
}

export const listParcelMachines = onCall(
  {region: REGION},
  async () => ({
    machines: await getCachedParcelMachines(),
    fetchedAt: new Date().toISOString(),
  })
);
