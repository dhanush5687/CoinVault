// PlayAllVideoAdsScreen.jsx
// FULL ONE PAGE – Plays all rewarded video ads one by one automatically

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BannerAd,
  BannerAdSize,
} from "react-native-google-mobile-ads";
import { ADMOB_BANNER_ID } from "@env";
import { supabase } from "../config/supabase";
import {
  preloadRewardedAds,
  showRewardedAd,
  waitForRewardedAd,
  getAvailableAdsCount,
} from "../ads/RewardedAdManager";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const LIVE_BANNER_ID = ADMOB_BANNER_ID || "ca-app-pub-2490251867268823/5116361111";
const { width } = Dimensions.get("window");
const DAILY_MAX_ADS = 15;

export default function PlayAllVideoAdsScreen({ navigation }) {
  const [coins, setCoins] = useState(0);
  const [remainingAds, setRemainingAds] = useState(DAILY_MAX_ADS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [adsPlayedThisSession, setAdsPlayedThisSession] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [noAdsVisible, setNoAdsVisible] = useState(false);

  const isStopRequestedRef = useRef(false);

  const getTodayKey = () => "WATCHED_ADS_" + new Date().toISOString().slice(0, 10);

  const loadDailyQuota = async () => {
    try {
      const key = getTodayKey();
      const watchedStr = await AsyncStorage.getItem(key);
      const watched = parseInt(watchedStr || "0", 10);
      setRemainingAds(Math.max(0, DAILY_MAX_ADS - watched));
    } catch (_) {
      setRemainingAds(DAILY_MAX_ADS);
    }
  };

  useEffect(() => {
    preloadRewardedAds();
    loadCoins();
    loadDailyQuota();

    return () => {
      isStopRequestedRef.current = true;
    };
  }, []);

  const loadCoins = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const saved = await AsyncStorage.getItem("USER_COINS");
        if (saved) setCoins(parseInt(saved, 10));
        return;
      }

      const database = require("@react-native-firebase/database").default;
      const snapshot = await database().ref(`/wallets/${user.id}`).once("value");
      if (snapshot.exists()) {
        const walletData = snapshot.val();
        setCoins(parseFloat(walletData.balance) || 0);
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", user.id)
          .single();
        if (data) setCoins(parseFloat(data.wallet_balance) || 0);
      }
    } catch (e) {
      console.log("Error loading coins:", e);
    }
  };

  const addReward = async () => {
    try {
      const reward = 10;
      const { data: { user } } = await supabase.auth.getUser();
      const newCoins = coins + reward;
      setCoins(newCoins);
      await AsyncStorage.setItem("USER_COINS", newCoins.toString());

      if (user) {
        // Sync Firebase
        try {
          const database = require("@react-native-firebase/database").default;
          await database().ref(`/wallets/${user.id}`).update({
            balance: newCoins,
            lastUpdated: Date.now(),
          });
        } catch (fbErr) {
          console.warn("Firebase sync error:", fbErr.message);
        }

        // Sync Supabase
        await supabase
          .from("profiles")
          .update({ wallet_balance: newCoins })
          .eq("id", user.id);

        await supabase
          .from("wallet_transactions")
          .insert([{
            user_id: user.id,
            transaction_type: "Ad Reward",
            amount: reward,
            balance_after: newCoins,
            description: "Watched rewarded ad (Marathon)",
          }]);
      }

      // Update daily remaining count
      const key = getTodayKey();
      const watchedStr = await AsyncStorage.getItem(key);
      const newWatched = parseInt(watchedStr || "0", 10) + 1;
      await AsyncStorage.setItem(key, newWatched.toString());
      setRemainingAds(Math.max(0, DAILY_MAX_ADS - newWatched));
      setAdsPlayedThisSession((prev) => prev + 1);
    } catch (e) {
      console.log("Error adding reward:", e);
    }
  };

  const playNextAdInSequence = async () => {
    if (isStopRequestedRef.current) {
      setIsPlaying(false);
      setStatusMessage("");
      return;
    }

    // Check if daily quota is done
    const key = getTodayKey();
    const watchedStr = await AsyncStorage.getItem(key);
    const watched = parseInt(watchedStr || "0", 10);
    const remaining = Math.max(0, DAILY_MAX_ADS - watched);

    if (remaining <= 0) {
      setIsPlaying(false);
      setStatusMessage("");
      Alert.alert(
        "Marathon Complete! 🎉",
        "You have completed all 15 ads for today and earned 150 coins!",
        [{ text: "Awesome!" }]
      );
      return;
    }

    setStatusMessage("Preparing next real ad...");

    // Wait up to 8s for next ad to be ready
    const isReady = await waitForRewardedAd(8000);

    if (isStopRequestedRef.current) {
      setIsPlaying(false);
      setStatusMessage("");
      return;
    }

    if (!isReady) {
      setIsPlaying(false);
      setStatusMessage("");
      setNoAdsVisible(true);
      return;
    }

    setStatusMessage("Ad is playing...");

    showRewardedAd(
      async () => {
        // Earned reward
        await addReward();
      },
      () => {
        // Failed to load
        setIsPlaying(false);
        setStatusMessage("");
        setNoAdsVisible(true);
      },
      (rewardClaimed) => {
        // Ad closed
        if (isStopRequestedRef.current) {
          setIsPlaying(false);
          setStatusMessage("");
          return;
        }

        // Brief 1.5s pause before starting next ad
        setStatusMessage("Ad finished! Loading next ad in 2s...");
        setTimeout(() => {
          if (!isStopRequestedRef.current) {
            playNextAdInSequence();
          } else {
            setIsPlaying(false);
            setStatusMessage("");
          }
        }, 1500);
      }
    );
  };

  const startPlayingAllAds = () => {
    if (remainingAds <= 0) {
      Alert.alert(
        "Daily Limit Reached 🎉",
        "You have already completed all 15 ads for today. Come back tomorrow!",
        [{ text: "OK" }]
      );
      return;
    }

    isStopRequestedRef.current = false;
    setIsPlaying(true);
    playNextAdInSequence();
  };

  const stopPlayingAds = () => {
    isStopRequestedRef.current = true;
    setIsPlaying(false);
    setStatusMessage("");
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#38bdf8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Play All Video Ads</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* TOP BANNER */}
      <View style={styles.banner}>
        <BannerAd
          unitId={LIVE_BANNER_ID}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.balance}>🪙 Balance: {coins} Coins</Text>
          <Text style={styles.queue}>
            🎬 Ads Remaining: {remainingAds}/{DAILY_MAX_ADS} Today
          </Text>
          {adsPlayedThisSession > 0 && (
            <Text style={styles.sessionCounter}>
              ✨ {adsPlayedThisSession} ads completed in this marathon! (+{adsPlayedThisSession * 10} 🪙)
            </Text>
          )}
        </View>

        <View style={styles.videoCard}>
          <Text style={styles.videoTitle}>🎥 Continuous Ad Marathon</Text>
          <Text style={styles.videoSub}>
            Watch all available video ads automatically one after another to earn coins fast.
          </Text>
          <Text style={[styles.videoSub, { color: "#38bdf8", fontWeight: "bold" }]}>
            Potential Earnings: {remainingAds * 10} Coins
          </Text>

          {statusMessage ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color="#38bdf8" style={{ marginRight: 8 }} />
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}

          {!isPlaying ? (
            <TouchableOpacity
              style={[styles.videoBtn, remainingAds <= 0 && { backgroundColor: "#334155" }]}
              onPress={startPlayingAllAds}
              disabled={remainingAds <= 0}
              activeOpacity={0.8}
            >
              <Text style={styles.videoBtnText}>
                {remainingAds > 0
                  ? `▶ Play All ${remainingAds} Video Ads Now`
                  : "All 15 Ads Completed Today"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={stopPlayingAds}
              activeOpacity={0.8}
            >
              <Text style={styles.stopBtnText}>⏹ Stop Marathon</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* BOTTOM BANNER */}
      <View style={styles.banner}>
        <BannerAd
          unitId={LIVE_BANNER_ID}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      </View>

      {/* NO ADS POPUP */}
      <Modal transparent visible={noAdsVisible} animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>No Ads Available 😔</Text>
            <Text style={styles.popupText}>
              There are no video ads available from Google AdMob right now. Please wait a few moments while they reload and try again.
            </Text>
            <TouchableOpacity
              style={styles.popupBtn}
              onPress={() => setNoAdsVisible(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================== STYLES ================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1f" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#020617",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  banner: {
    alignItems: "center",
    backgroundColor: "#020617",
    paddingVertical: 4,
  },

  content: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 16,
    width: width * 0.88,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  balance: { color: "#22c55e", fontSize: 22, fontWeight: "700" },

  queue: { color: "#38bdf8", fontSize: 14, marginTop: 6, fontWeight: "600" },

  sessionCounter: { color: "#facc15", fontSize: 12, marginTop: 8, fontWeight: "bold" },

  videoCard: {
    backgroundColor: "#1f2933",
    padding: 18,
    borderRadius: 16,
    width: width * 0.9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#22c55e",
  },

  videoTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  videoSub: { color: "#9ca3af", marginVertical: 4, textAlign: "center", fontSize: 13 },

  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "#38bdf8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 10,
  },

  statusText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "600",
  },

  videoBtn: {
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 14,
    marginTop: 10,
    elevation: 3,
  },

  videoBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },

  stopBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 14,
    marginTop: 10,
    elevation: 3,
  },

  stopBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  popupBox: {
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 16,
    width: "80%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },

  popupTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  popupText: { color: "#9ca3af", marginTop: 10, textAlign: "center", lineHeight: 20 },

  popupBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 15,
  },
});
