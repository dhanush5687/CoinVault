// PlayAllVideoAdsScreen.jsx
// FULL ONE PAGE – Plays all rewarded video ads one by one automatically

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BannerAd,
  BannerAdSize,
} from "react-native-google-mobile-ads";
import { ADMOB_BANNER_ID } from "@env";
import { preloadRewardedAds, showRewardedAd, getAvailableAdsCount } from "../ads/RewardedAdManager";

const { width } = Dimensions.get("window");

/* ================== MAIN SCREEN ================== */

export default function PlayAllVideoAdsScreen({ navigation }) {
  const [coins, setCoins] = useState(0);
  const [availableAds, setAvailableAds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [noAdsVisible, setNoAdsVisible] = useState(false);

  useEffect(() => {
    preloadRewardedAds();
    loadCoins();

    const timer = setInterval(() => {
      setAvailableAds(getAvailableAdsCount());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadCoins = async () => {
    const saved = await AsyncStorage.getItem("USER_COINS");
    if (saved) setCoins(parseInt(saved));
  };

  const addCoins = async () => {
    const newCoins = coins + 10;
    setCoins(newCoins);
    await AsyncStorage.setItem("USER_COINS", newCoins.toString());
  };

  const playNextAd = () => {
    const count = getAvailableAdsCount();

    if (count === 0) {
      setIsPlaying(false);
      setNoAdsVisible(true);
      preloadRewardedAds();
      return;
    }

    showRewardedAd(
      async () => {
        await addCoins();
        // In "Play All" mode, we want to continue playing if there are more
        setTimeout(() => {
          const nextCount = getAvailableAdsCount();
          if (nextCount > 0) {
            playNextAd();
          } else {
            setIsPlaying(false);
          }
        }, 800);
      },
      () => {
        setIsPlaying(false);
        setNoAdsVisible(true);
      }
    );
  };

  const startPlayingAllAds = () => {
    if (rewardedQueue.length === 0) {
      setNoAdsVisible(true);
      return;
    }

    setIsPlaying(true);
    playNextAd();
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>⬅</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Play All Video Ads</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* TOP BANNER */}
      <View style={styles.banner}>
        <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.balance}>💰 Coins: {coins}</Text>
          <Text style={styles.queue}>
            🎬 Video Ads Ready: {availableAds}/15
          </Text>
        </View>

        <View style={styles.videoCard}>
          <Text style={styles.videoTitle}>🎥 Ad Marathon Mode</Text>
          <Text style={styles.videoSub}>
            Watch all available video ads automatically and earn coins fast.
          </Text>
          <Text style={styles.videoSub}>
            Potential Earnings: {availableAds * 10} Coins
          </Text>

          <TouchableOpacity
            style={styles.videoBtn}
            onPress={startPlayingAllAds}
            disabled={isPlaying}
          >
            {isPlaying ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.videoBtnText}>
                ▶ Play {availableAds} Video Ads Now
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* BOTTOM BANNER */}
      <View style={styles.banner}>
        <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
      </View>

      {/* NO ADS POPUP */}
      <Modal transparent visible={noAdsVisible} animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>No Ads Available 😔</Text>
            <Text style={styles.popupText}>
              There are no video ads ready right now. Please wait a few moments
              while we load them.
            </Text>
            <TouchableOpacity
              style={styles.popupBtn}
              onPress={() => setNoAdsVisible(false)}
            >
              <Text style={{ color: "#fff" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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

  back: { color: "#38bdf8", fontSize: 22 },

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
    width: width * 0.85,
    alignItems: "center",
    marginBottom: 25,
  },

  balance: { color: "#22c55e", fontSize: 22, fontWeight: "700" },

  queue: { color: "#38bdf8", fontSize: 14, marginTop: 5 },

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

  videoSub: { color: "#9ca3af", marginVertical: 6, textAlign: "center" },

  videoBtn: {
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 14,
    marginTop: 10,
  },

  videoBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },

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
  },

  popupTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  popupText: { color: "#9ca3af", marginTop: 10, textAlign: "center" },

  popupBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 15,
  },
});
