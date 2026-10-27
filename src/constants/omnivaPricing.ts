// Omniva publishes no stable, scrapable price table (their own price-list
// pages are dynamic calculators, and Estonia's explicitly states "Any
// prices shown on our website or in marketing materials are for guidance
// only and may differ at the time of ordering") - so instead of hardcoding
// figures that would silently go stale, we link out to Omniva's own
// official calculator for the destination country.
export const OMNIVA_PRICE_LIST_URL: Record<string, string> = {
    EE: 'https://www.omniva.ee/en/price-lists-for-private-customers/',
    LV: 'https://www.omniva.lv/en/price-lists/',
    LT: 'https://www.omniva.lt/en/price-lists/',
};

// Omniva's private-customer self-service (no business contract needed) -
// each country's own domain, but all landing on the same "/parcel/baltics/new"
// shipment-creation flow, as linked from the "Start sending" button on each
// country's own omniva.{ee,lv,lt} sending-parcels page.
export const OMNIVA_SEND_PARCEL_URL: Record<string, string> = {
    EE: 'https://minu.omniva.ee/parcel/baltics/new/?language=en',
    LV: 'https://mana.omniva.lv/parcel/baltics/new/?language=en',
    LT: 'https://mano.omniva.lt/parcel/baltics/new/?language=en',
};

// Single source of truth for which countries are supported - both URL maps
// above must have an entry for every code here, and myOffers.tsx's country
// picker is built from this list instead of its own hardcoded <option>s.
export const OMNIVA_COUNTRIES = ['EE', 'LV', 'LT'] as const;

export const TOY_SIZES = ['S', 'M', 'L', 'XL'] as const;
export type ToySize = typeof TOY_SIZES[number];
export const DEFAULT_TOY_SIZE: ToySize = 'S';
