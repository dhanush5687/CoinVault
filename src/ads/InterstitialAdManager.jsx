import {
    InterstitialAd,
    AdEventType,
} from "react-native-google-mobile-ads";
import { ADMOB_INTERSTITIAL_ID } from "@env";

let interstitialAd = null;
let isLoaded = false;
let isLoading = false;

export const loadInterstitialAd = () => {
    if (isLoading) return;
    isLoading = true;
    isLoaded = false;

    console.log("📡 AdMob: Loading Interstitial...");
    interstitialAd = InterstitialAd.createForAdRequest(ADMOB_INTERSTITIAL_ID, {
        requestNonPersonalizedAdsOnly: false,
    });

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        isLoaded = true;
        isLoading = false;
        console.log("🚀 AdMob: Interstitial Loaded");
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        isLoaded = false;
        isLoading = false;
        loadInterstitialAd(); // reload for next time
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, (err) => {
        isLoaded = false;
        isLoading = false;
        console.log("❌ AdMob: Interstitial Error:", err.message);
    });

    interstitialAd.load();
};

export const showInterstitialAd = () => {
    if (isLoaded && interstitialAd) {
        try {
            interstitialAd.show().catch(e => {
                console.log("❌ AdMob: Interstitial Show Catch:", e.message);
                isLoaded = false;
                loadInterstitialAd();
            });
        } catch (e) {
            console.log("❌ AdMob: Interstitial Show Global Catch");
            isLoaded = false;
            loadInterstitialAd();
        }
    } else {
        console.log("⚠️ AdMob: Interstitial not ready, triggering load");
        loadInterstitialAd(); // Trigger load if not ready
    }
};
