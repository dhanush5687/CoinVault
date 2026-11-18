import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { ADMOB_REWARDED_ID } from "@env";

// Real production Live Rewarded Ad Unit ID
const LIVE_REWARDED_ID = ADMOB_REWARDED_ID || "ca-app-pub-2490251867268823/3936964593";

// Maintain a buffer of 2 preloaded ads in memory to avoid AdMob throttling
const BUFFER_SIZE = 2;
let adQueue = [];
let isPreloading = false;
let pendingShowRequest = null;
let pendingTimeoutId = null;
let lastErrorTime = 0;
let consecutiveErrors = 0;

const createAd = () =>
  RewardedAd.createForAdRequest(LIVE_REWARDED_ID, {
    requestNonPersonalizedAdsOnly: false,
  });

/**
 * Preloads rewarded ads until buffer size is met.
 */
export const preloadRewardedAds = () => {
  if (isPreloading || adQueue.length >= BUFFER_SIZE) return;

  const now = Date.now();
  if (now - lastErrorTime < 4000) {
    // Wait briefly after an error
    setTimeout(() => preloadRewardedAds(), 4000);
    return;
  }

  isPreloading = true;
  console.log(`📡 AdMob: Preloading Live Rewarded (${adQueue.length}/${BUFFER_SIZE})...`);

  try {
    const ad = createAd();

    const loadedListener = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      loadedListener();
      errorListener();
      isPreloading = false;
      consecutiveErrors = 0;
      console.log(`🎯 AdMob: Rewarded Loaded Successfully (${adQueue.length + 1}/${BUFFER_SIZE})`);

      // If a user is waiting for an ad to show right now:
      if (pendingShowRequest) {
        if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
        const req = pendingShowRequest;
        pendingShowRequest = null;
        displayAdInstance(ad, req.onReward, req.onNoAds, req.onClosed);
      } else {
        adQueue.push(ad);
        // Continue filling buffer up to BUFFER_SIZE
        if (adQueue.length < BUFFER_SIZE) {
          preloadRewardedAds();
        }
      }
    });

    const errorListener = ad.addAdEventListener(AdEventType.ERROR, (err) => {
      loadedListener();
      errorListener();
      isPreloading = false;
      lastErrorTime = Date.now();
      consecutiveErrors += 1;
      console.log("❌ AdMob: Rewarded Load Error:", err.message);

      // If user was waiting, trigger onNoAds after error
      if (pendingShowRequest) {
        if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
        const req = pendingShowRequest;
        pendingShowRequest = null;
        if (req.onNoAds) req.onNoAds();
      }

      // Exponential backoff up to 25s
      const delay = Math.min(25000, 5000 * Math.max(1, consecutiveErrors));
      setTimeout(() => {
        preloadRewardedAds();
      }, delay);
    });

    ad.load();
  } catch (e) {
    isPreloading = false;
    console.log("❌ AdMob: Failed to create Rewarded:", e.message);
    if (pendingShowRequest) {
      if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
      const req = pendingShowRequest;
      pendingShowRequest = null;
      if (req.onNoAds) req.onNoAds();
    }
  }
};

/**
 * Display an already loaded RewardedAd instance.
 */
const displayAdInstance = (ad, onReward, onNoAds, onClosed) => {
  let rewardClaimed = false;

  const onEarned = ad.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    reward => {
      onEarned();
      console.log("🪙 AdMob: Reward Earned Event triggered!");
      rewardClaimed = true;
      if (onReward) onReward(reward);
    }
  );

  const onAdClosed = ad.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      onAdClosed();
      onError();
      console.log("🎬 AdMob: Rewarded Closed");
      if (onClosed) onClosed(rewardClaimed);
      // Immediately preload the next ad
      preloadRewardedAds();
    }
  );

  const onError = ad.addAdEventListener(AdEventType.ERROR, (err) => {
    onAdClosed();
    onError();
    console.log("❌ AdMob: Show Error Event:", err.message);
    if (onNoAds) onNoAds();
    preloadRewardedAds();
  });

  try {
    ad.show().catch(e => {
      console.log("❌ AdMob: Show Promise Catch:", e.message);
      if (onNoAds) onNoAds();
      preloadRewardedAds();
    });
  } catch (e) {
    console.log("❌ AdMob: Show Global Catch:", e.message);
    if (onNoAds) onNoAds();
    preloadRewardedAds();
  }
};

/**
 * Shows a rewarded ad. If an ad is ready in the buffer, displays it immediately.
 * If buffer is empty, loads an ad on demand with a safety timeout.
 */
export const showRewardedAd = (onReward, onNoAds, onClosed) => {
  if (adQueue.length > 0) {
    const ad = adQueue.shift();
    displayAdInstance(ad, onReward, onNoAds, onClosed);
    // Keep buffer filled
    preloadRewardedAds();
  } else {
    console.log("⏳ AdMob: Rewarded queue empty. Fetching live ad on-demand...");
    pendingShowRequest = { onReward, onNoAds, onClosed };

    // Safety timeout: 7 seconds
    if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
    pendingTimeoutId = setTimeout(() => {
      if (pendingShowRequest) {
        console.log("⏱️ AdMob: Rewarded load timeout reached");
        const req = pendingShowRequest;
        pendingShowRequest = null;
        if (req.onNoAds) req.onNoAds();
      }
    }, 7000);

    preloadRewardedAds();
  }
};

export const getAvailableAdsCount = () => adQueue.length;

/**
 * Async helper for marathon/continuous play.
 * Waits until an ad is ready to show, then resolves true, or false if timeout.
 */
export const waitForRewardedAd = (timeoutMs = 8000) => {
  return new Promise((resolve) => {
    if (adQueue.length > 0) {
      resolve(true);
      return;
    }

    const checkInterval = 400;
    let elapsed = 0;
    preloadRewardedAds();

    const interval = setInterval(() => {
      elapsed += checkInterval;
      if (adQueue.length > 0) {
        clearInterval(interval);
        resolve(true);
      } else if (elapsed >= timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, checkInterval);
  });
};
