import {
    InterstitialAd,
    AdEventType,
} from "react-native-google-mobile-ads";
import { ADMOB_INTERSTITIAL_ID } from "@env";

// Real production Live Ad Unit ID
const LIVE_INTERSTITIAL_ID = ADMOB_INTERSTITIAL_ID || "ca-app-pub-2490251867268823/2427667725";

let interstitialAd = null;
let isLoaded = false;
let isLoading = false;
let pendingShowOnLoaded = false;
let pendingOnClosed = null;
let showTimeoutId = null;

export const loadInterstitialAd = () => {
    if (isLoading || isLoaded) return;

    isLoading = true;
    console.log("📡 AdMob: Loading Live Interstitial Ad (" + LIVE_INTERSTITIAL_ID + ")...");

    try {
        interstitialAd = InterstitialAd.createForAdRequest(LIVE_INTERSTITIAL_ID, {
            requestNonPersonalizedAdsOnly: false,
        });

        interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
            isLoaded = true;
            isLoading = false;
            console.log("🚀 AdMob: Live Interstitial Loaded Successfully!");

            // If a show request was waiting for this ad to finish loading
            if (pendingShowOnLoaded) {
                pendingShowOnLoaded = false;
                if (showTimeoutId) clearTimeout(showTimeoutId);
                const callback = pendingOnClosed;
                pendingOnClosed = null;
                showLoadedAd(callback);
            }
        });

        interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
            isLoaded = false;
            isLoading = false;
            interstitialAd = null;
            // Preload next live ad after a brief pause
            setTimeout(() => {
                loadInterstitialAd();
            }, 2000);
        });

        interstitialAd.addAdEventListener(AdEventType.ERROR, (err) => {
            isLoaded = false;
            isLoading = false;
            console.log("❌ AdMob: Live Interstitial Error:", err.message);

            if (pendingShowOnLoaded) {
                pendingShowOnLoaded = false;
                if (showTimeoutId) clearTimeout(showTimeoutId);
                if (pendingOnClosed) {
                    const cb = pendingOnClosed;
                    pendingOnClosed = null;
                    cb();
                }
            }

            // Retry loading real live ad after cooldown (never use test ads)
            setTimeout(() => {
                loadInterstitialAd();
            }, 8000);
        });

        interstitialAd.load();
    } catch (e) {
        isLoading = false;
        console.log("❌ AdMob: Failed to create interstitial:", e.message);
        if (pendingShowOnLoaded) {
            pendingShowOnLoaded = false;
            if (pendingOnClosed) {
                const cb = pendingOnClosed;
                pendingOnClosed = null;
                cb();
            }
        }
    }
};

const showLoadedAd = (onClosed) => {
    if (!interstitialAd || !isLoaded) {
        if (onClosed) onClosed();
        return;
    }

    try {
        if (onClosed) {
            const closeListener = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
                closeListener();
                onClosed();
            });
        }
        interstitialAd.show().catch(e => {
            console.log("❌ AdMob: Interstitial Show Error:", e.message);
            isLoaded = false;
            interstitialAd = null;
            if (onClosed) onClosed();
            loadInterstitialAd();
        });
    } catch (e) {
        console.log("❌ AdMob: Interstitial Show Catch:", e.message);
        isLoaded = false;
        interstitialAd = null;
        if (onClosed) onClosed();
        loadInterstitialAd();
    }
};

export const showInterstitialAd = (onClosed) => {
    if (isLoaded && interstitialAd) {
        showLoadedAd(onClosed);
    } else {
        console.log("⏳ AdMob: Interstitial not yet ready. Loading real ad and preparing to show...");
        pendingShowOnLoaded = true;
        pendingOnClosed = onClosed || null;

        // Safety timeout: if ad doesn't load within 4.5 seconds, don't freeze user flow
        if (showTimeoutId) clearTimeout(showTimeoutId);
        showTimeoutId = setTimeout(() => {
            if (pendingShowOnLoaded) {
                console.log("⏱️ AdMob: Interstitial load timeout reached, continuing flow");
                pendingShowOnLoaded = false;
                if (pendingOnClosed) {
                    const cb = pendingOnClosed;
                    pendingOnClosed = null;
                    cb();
                }
            }
        }, 4500);

        loadInterstitialAd();
    }
};
