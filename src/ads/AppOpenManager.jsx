import {
  AppOpenAd,
  AdEventType,
} from "react-native-google-mobile-ads";
import { ADMOB_APP_OPEN_ID } from "@env";

let appOpenAd = null;
let isLoaded = false;
let isLoading = false;

export const loadAppOpenAd = () => {
  if (isLoading) return;
  isLoading = true;
  isLoaded = false;

  console.log("📡 AdMob: Loading AppOpen...");
  appOpenAd = AppOpenAd.createForAdRequest(ADMOB_APP_OPEN_ID, {
    requestNonPersonalizedAdsOnly: false,
  });

  appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
    isLoading = false;
    console.log("🚀 AdMob: AppOpen Loaded");
  });

  appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
    isLoaded = false;
    isLoading = false;
    loadAppOpenAd(); // reload for next time
  });

  appOpenAd.addAdEventListener(AdEventType.ERROR, (err) => {
    isLoaded = false;
    isLoading = false;
    console.log("❌ AdMob: AppOpen Error:", err.message);
  });

  appOpenAd.load();
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