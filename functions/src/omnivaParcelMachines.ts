import {onCall} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getOmnivaClient, omnivaUsername, omnivaPassword, ParcelMachine} from "./omniva";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";
// Redeploy marker 2 (no functional change) - force fresh instances so the
// in-memory cache below isn't left holding data from before the stub client
// started serving real Omniva data.
// Terminal list is large (~1000+ entries) and semi-static - a day-long TTL
// avoids hammering Omniva while keeping the list reasonably fresh.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_DOC_PATH = "omnivaCache/parcelMachines";

interface CacheEntry {
  machines: ParcelMachine[];
  fetchedAt: number;
}

// Per-warm-instance fast path in front of the cross-instance Firestore cache
// below - avoids a Firestore read on every call within one warm instance's
// lifetime, while still surviving cold starts / multiple concurrent instances.
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

  const machines = await getOmnivaClient().listParcelMachines();
  const entry: CacheEntry = {machines, fetchedAt: now};
  await docRef.set(entry);
  memoryCache = entry;
  return machines;
}

export async function isValidParcelMachineId(id: string): Promise<boolean> {
  const machines = await getCachedParcelMachines();
  return machines.some((m) => m.id === id);
}

export const listParcelMachines = onCall(
  {region: REGION, secrets: [omnivaUsername, omnivaPassword]},
  async () => ({
    machines: await getCachedParcelMachines(),
    fetchedAt: new Date().toISOString(),
  })
);
