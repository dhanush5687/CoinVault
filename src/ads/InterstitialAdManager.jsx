import {
    InterstitialAd,
    AdEventType,
    TestIds,
} from "react-native-google-mobile-ads";
import { ADMOB_INTERSTITIAL_ID } from "@env";

let interstitialAd = null;
let isLoaded = false;
let isLoading = false;
let usingFallback = false;
let lastErrorTime = 0;
const ERROR_COOLDOWN_MS = 15000; // 15-second cooldown to prevent spamming Google AdMob

export const loadInterstitialAd = (forceFallback = false) => {
    const now = Date.now();
    if (isLoading) return;
    if (!forceFallback && now - lastErrorTime < ERROR_COOLDOWN_MS) {
        console.log("⏳ AdMob: Interstitial cooldown active, skipping rapid retry");
        return;
    }

    isLoading = true;
    isLoaded = false;

    // Use Google Test Ad Unit if live unit failed with 403/no-fill, in __DEV__, or if ID missing
    const targetAdUnitId = (forceFallback || usingFallback || !ADMOB_INTERSTITIAL_ID || __DEV__)
        ? TestIds.INTERSTITIAL
        : ADMOB_INTERSTITIAL_ID;

    console.log(`📡 AdMob: Loading Interstitial (${targetAdUnitId === TestIds.INTERSTITIAL ? "Test Unit" : "Live Unit"})...`);

    try {
        interstitialAd = InterstitialAd.createForAdRequest(targetAdUnitId, {
            requestNonPersonalizedAdsOnly: false,
        });

        interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
            isLoaded = true;
            isLoading = false;
            console.log(`🚀 AdMob: Interstitial Loaded (${targetAdUnitId === TestIds.INTERSTITIAL ? "Test Unit" : "Live Unit"})`);
        });

        interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
            isLoaded = false;
            isLoading = false;
            setTimeout(() => {
                loadInterstitialAd(); // reload for next time with slight buffer
            }, 3000);
        });

        interstitialAd.addAdEventListener(AdEventType.ERROR, (err) => {
            isLoaded = false;
            isLoading = false;
            lastErrorTime = Date.now();
            console.log("❌ AdMob: Interstitial Error:", err.message);

            // If production live unit failed (e.g. HTTP 403 Forbidden / No-fill), automatically switch to Google Test Unit
            if (targetAdUnitId !== TestIds.INTERSTITIAL) {
                console.log("🔄 AdMob: Live Interstitial returned HTTP 403/no-fill. Switching to Google Test Ad Unit...");
                usingFallback = true;
                setTimeout(() => {
                    loadInterstitialAd(true);
                }, 1500);
            }
        });

        interstitialAd.load();
    } catch (e) {
        isLoading = false;
        lastErrorTime = Date.now();
        console.log("❌ AdMob: Failed to create interstitial:", e.message);
    }
};

export const showInterstitialAd = (onClosed) => {
    if (isLoaded && interstitialAd) {
        try {
            if (onClosed) {
                const closeListener = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
                    closeListener();
                    onClosed();
                });
            }
            interstitialAd.show().catch(e => {
                console.log("❌ AdMob: Interstitial Show Catch:", e.message);
                isLoaded = false;
                if (onClosed) onClosed();
                loadInterstitialAd();
            });
        } catch (e) {
            console.log("❌ AdMob: Interstitial Show Global Catch");
            isLoaded = false;
            if (onClosed) onClosed();
            loadInterstitialAd();
        }
    } else {
        console.log("⚠️ AdMob: Interstitial not ready, triggering load");
        if (onClosed) onClosed();
        loadInterstitialAd(); // Trigger load if not ready
    }
};
