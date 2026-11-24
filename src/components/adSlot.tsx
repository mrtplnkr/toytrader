import { useEffect, useState } from "react";
import { getAdsConfig } from "../hooks/helper";
import { AdsConfig } from "../types/adsConfig";

interface Props {
    // Identifies this placement for frequency-gating purposes - each
    // distinct trigger gets its own independent counter (see below), so
    // showing an ad on /list doesn't also "use up" the count for the
    // myOffers.tsx trade-complete placement.
    trigger: string;
}

const ADSENSE_SCRIPT_MARKER = "data-adsbygoogle-loader";

declare global {
    interface Window {
        adsbygoogle?: unknown[];
    }
}

// A single AdSense display ad, shown "sometimes" rather than on every single
// visit to a trigger point - gated by both the admin-configured enabled
// flag (appConfig/ads, see src/pages/admin.tsx) and a per-browser frequency
// counter in localStorage. Renders nothing at all unless an admin has both
// turned ads on and filled in real AdSense ids.
function AdSlot({ trigger }: Props) {
    const [config, setConfig] = useState<AdsConfig | undefined>();
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        getAdsConfig().then(setConfig).catch(() => {});
    }, []);

    useEffect(() => {
        if (!config?.enabled || !config.publisherId || !config.slotId) {
            setShouldShow(false);
            return;
        }
        const storageKey = `adTrigger_${trigger}`;
        let count = 1;
        try {
            count = Number(localStorage.getItem(storageKey) ?? "0") + 1;
            localStorage.setItem(storageKey, String(count));
        } catch {
            // Private browsing/blocked storage - just don't persist the
            // count, falls back to "always eligible" for this page view.
        }
        const everyN = Math.max(1, config.frequencyEveryN || 1);
        setShouldShow(count % everyN === 0);
    }, [config, trigger]);

    useEffect(() => {
        if (!shouldShow || !config) return;
        if (!document.querySelector(`script[${ADSENSE_SCRIPT_MARKER}]`)) {
            const script = document.createElement("script");
            script.async = true;
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.publisherId}`;
            script.crossOrigin = "anonymous";
            script.setAttribute(ADSENSE_SCRIPT_MARKER, "1");
            document.head.appendChild(script);
        }
        try {
            // Google's documented COPPA/GDPR-K signal - tells the ad server
            // this is child-directed traffic, disabling ad personalization/
            // behavioral targeting and restricting serving to more
            // conservative inventory. Doesn't replace the account-level
            // "child-directed" site declaration or the dashboard's own
            // sensitive-category blocking controls - see src/types/adsConfig.ts.
            (window.adsbygoogle = window.adsbygoogle || []).push({
                tagForChildDirectedTreatment: config.childDirectedTreatment,
                tagForUnderAgeOfConsent: config.childDirectedTreatment,
            });
        } catch {
            // Best-effort, same as any other third-party script this app
            // loads - AdSense not yet approved for this account/site is a
            // completely normal failure mode here, not a bug.
        }
    }, [shouldShow, config]);

    if (!shouldShow || !config) return null;

    return (
        <ins
            className="adsbygoogle block w-full"
            style={{ display: "block" }}
            data-ad-client={config.publisherId}
            data-ad-slot={config.slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
        />
    );
}

export default AdSlot;
