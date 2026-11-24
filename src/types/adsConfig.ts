
// A single global config doc (appConfig/ads in Firestore) controlling
// whether/how Google AdSense ads show anywhere in the app - public read (so
// even an anonymous /list visitor's client knows whether to render one),
// admin-only write (see firestore.rules).
export interface AdsConfig {
    enabled: boolean;
    // AdSense publisher id, e.g. "ca-pub-1234567890123456" - the account's
    // own id, same for every ad unit on the site.
    publisherId: string;
    // AdSense ad unit/slot id, e.g. "1234567890" - created per ad placement
    // in the AdSense dashboard. This app only shows one ad unit for now, so
    // one slot id covers every AdSlot trigger point.
    slotId: string;
    // Shows roughly once every N times a given trigger point is hit (per
    // browser, via localStorage - see components/adSlot.tsx), not every
    // single time, so ads don't show up on every single page view/action.
    frequencyEveryN: number;
    // Tells Google's ad server this is child-directed traffic (COPPA/GDPR-K
    // signaling) - disables ad personalization/behavioral targeting and
    // restricts serving to more conservative inventory. This is the one
    // piece of "what ads can show" actually controllable from code; actual
    // category/advertiser blocking (gambling, dating, alcohol, etc.) is
    // configured in the AdSense dashboard's own "Blocking controls", not
    // here - this app has no access to that account to set it on your
    // behalf. Defaults to true given this app's audience.
    childDirectedTreatment: boolean;
}
