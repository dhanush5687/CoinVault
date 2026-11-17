import {
  AppOpenAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { ADMOB_APP_OPEN_ID } from "@env";

let appOpenAd = null;
let isLoaded = false;
let isLoading = false;
let usingFallback = false;
let lastErrorTime = 0;
const ERROR_COOLDOWN_MS = 15000;

export const loadAppOpenAd = (forceFallback = false) => {
  const now = Date.now();
  if (isLoading) return;
  if (!forceFallback && now - lastErrorTime < ERROR_COOLDOWN_MS) {
    return;
  }

  isLoading = true;
  isLoaded = false;

  const targetAdUnitId = (forceFallback || usingFallback || !ADMOB_APP_OPEN_ID || __DEV__)
    ? TestIds.APP_OPEN
    : ADMOB_APP_OPEN_ID;

  console.log(`📡 AdMob: Loading AppOpen (${targetAdUnitId === TestIds.APP_OPEN ? "Test Unit" : "Live Unit"})...`);

  try {
    appOpenAd = AppOpenAd.createForAdRequest(targetAdUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
      isLoaded = true;
      isLoading = false;
      console.log(`🚀 AdMob: AppOpen Loaded (${targetAdUnitId === TestIds.APP_OPEN ? "Test Unit" : "Live Unit"})`);
    });

    appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
      isLoaded = false;
      isLoading = false;
      setTimeout(() => {
        loadAppOpenAd();
      }, 3000);
    });

    appOpenAd.addAdEventListener(AdEventType.ERROR, (err) => {
      isLoaded = false;
      isLoading = false;
      lastErrorTime = Date.now();
      console.log("❌ AdMob: AppOpen Error:", err.message);

      if (targetAdUnitId !== TestIds.APP_OPEN) {
        console.log("🔄 AdMob: Live AppOpen returned error (403/no-fill). Switching to Google Test Ad Unit...");
        usingFallback = true;
        setTimeout(() => {
          loadAppOpenAd(true);
        }, 1500);
      }
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
      appOpenAd.show().catch(e => {
        console.log("❌ AdMob: AppOpen Show Catch:", e.message);
        isLoaded = false;
        loadAppOpenAd();
      });
    } catch (e) {
      console.log("❌ AdMob: AppOpen Show Global Catch");
      isLoaded = false;
      loadAppOpenAd();
    }
  } else {
    console.log("⚠️ AdMob: AppOpen not ready, forcing load");
    loadAppOpenAd(); // Force load if not ready
  }
};