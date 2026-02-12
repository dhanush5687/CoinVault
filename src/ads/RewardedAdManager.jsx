import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { ADMOB_REWARDED_ID } from "@env";

const MAX_ADS = 15;
let adQueue = [];
let loading = false;

const createAd = () =>
  RewardedAd.createForAdRequest(ADMOB_REWARDED_ID, {
    requestNonPersonalizedAdsOnly: false,
  });

/**
 * Preloads ads into the queue.
 * Resolves as soon as the queue is no longer empty, 
 * but continues filling the rest in the background.
 */
export const preloadRewardedAds = async () => {
  if (loading) return;
  loading = true;

  console.log("📡 AdMob: Starting Rewarded Preload...");

  const fillQueue = async () => {
    while (adQueue.length < MAX_ADS) {
      const ad = createAd();

      try {
        await new Promise((resolve, reject) => {
          const loadedListener = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            adQueue.push(ad);
            console.log(`🎯 AdMob: Rewarded Loaded (${adQueue.length}/${MAX_ADS})`);
            resolve();
          });

          const errorListener = ad.addAdEventListener(AdEventType.ERROR, (err) => {
            console.log("❌ AdMob: Rewarded Load Error:", err.message);
            // We use a small delay on error to avoid rapid retries
            setTimeout(resolve, 5000);
          });

          ad.load();
        });
      } catch (e) {
        console.log("❌ AdMob: Internal Preload Error");
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    loading = false;
    console.log("✅ AdMob: Rewarded Queue Full");
  };

  // Start filling in background
  fillQueue();

  // Wait for at least 1 ad if queue is empty
  if (adQueue.length === 0) {
    console.log("⏳ AdMob: Waiting for first ad...");
    let checkCount = 0;
    while (adQueue.length === 0 && checkCount < 10) {
      await new Promise(r => setTimeout(r, 1000));
      checkCount++;
    }
  }
};

export const showRewardedAd = (onReward, onNoAds) => {
  if (adQueue.length === 0) {
    console.log("⚠️ AdMob: Show requested but queue empty");
    if (onNoAds) onNoAds();
    preloadRewardedAds();
    return;
  }

  const ad = adQueue.shift();
  let rewardClaimed = false;

  const onEarned = ad.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    reward => {
      console.log("🪙 AdMob: Reward Earned Event triggered");
      rewardClaimed = true;
      onReward();
    }
  );

  const onClosed = ad.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      console.log("🎬 AdMob: Rewarded Closed");
      if (!rewardClaimed) {
        console.log("⚠️ AdMob: User closed ad before earning reward");
        // Optionally handle incomplete watch
      }
      preloadRewardedAds(); // refill
    }
  );

  const onError = ad.addAdEventListener(AdEventType.ERROR, (err) => {
    console.log("❌ AdMob: Show Error Event:", err.message);
    if (onNoAds) onNoAds();
  });

  try {
    ad.show().catch(e => {
      console.log("❌ AdMob: Show Promise Catch:", e.message);
      if (onNoAds) onNoAds();
    });
  } catch (e) {
    console.log("❌ AdMob: Show Global Catch");
    if (onNoAds) onNoAds();
  }
};

export const getAvailableAdsCount = () => adQueue.length;
