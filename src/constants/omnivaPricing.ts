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

export const TOY_SIZES = ['S', 'M', 'L', 'XL'] as const;
export type ToySize = typeof TOY_SIZES[number];
export const DEFAULT_TOY_SIZE: ToySize = 'S';
