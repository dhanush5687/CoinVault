import {
  AppOpenAd,
  AdEventType,
} from "react-native-google-mobile-ads";
import { ADMOB_APP_OPEN_ID } from "@env";

const LIVE_APP_OPEN_ID = ADMOB_APP_OPEN_ID || "ca-app-pub-2490251867268823/2498586385";

let appOpenAd = null;
let isLoaded = false;
let isLoading = false;
let lastErrorTime = 0;
const ERROR_COOLDOWN_MS = 15000;

export const loadAppOpenAd = () => {
  const now = Date.now();
  if (isLoading || isLoaded) return;
  if (now - lastErrorTime < ERROR_COOLDOWN_MS) {
    return;
  }

  isLoading = true;
  isLoaded = false;

  console.log("📡 AdMob: Loading Live AppOpen Ad (" + LIVE_APP_OPEN_ID + ")...");

  try {
    appOpenAd = AppOpenAd.createForAdRequest(LIVE_APP_OPEN_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
      isLoaded = true;
      isLoading = false;
      console.log("🚀 AdMob: Live AppOpen Loaded Successfully!");
    });

    appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
      isLoaded = false;
      isLoading = false;
      appOpenAd = null;
      setTimeout(() => {
        loadAppOpenAd();
      }, 3000);
    });

    appOpenAd.addAdEventListener(AdEventType.ERROR, (err) => {
      isLoaded = false;
      isLoading = false;
      appOpenAd = null;
      lastErrorTime = Date.now();
      console.log("❌ AdMob: Live AppOpen Error:", err.message);

      // Backoff retry: wait 30 seconds before next attempt on 403 or no-fill
      setTimeout(() => {
        loadAppOpenAd();
      }, 30000);
    });

    appOpenAd.load();
  } catch (e) {
    isLoading = false;
    lastErrorTime = Date.now();
    console.log("❌ AdMob: Failed to create AppOpen:", e.message);
  }
};

export const showAppOpenAd = () => {
  if (isLoaded && appOpenAd) {
    try {
      appOpenAd.show().catch((e) => {
        console.log("❌ AdMob: AppOpen Show Catch:", e.message);
        isLoaded = false;
        appOpenAd = null;
        loadAppOpenAd();
      });
    } catch (e) {
      console.log("❌ AdMob: AppOpen Show Global Catch:", e.message);
      isLoaded = false;
      appOpenAd = null;
      loadAppOpenAd();
    }
  } else {
    console.log("⚠️ AdMob: AppOpen not ready, triggering live load");
    loadAppOpenAd();
  }
};
