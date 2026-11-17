


import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "react-native";
import { fakeBack } from "../components/FackBack";

// ✅ ADMOB
import {
  BannerAd,
  BannerAdSize,

} from "react-native-google-mobile-ads";
import {
  ADMOB_BANNER_ID,

} from "@env";
import AdmobBannerCard from "../components/AdmobBannerCard";

import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");
const WHEEL_SIZE = width * 0.75;

const SEGMENTS = [10, 20, 30, 50, 10, 100, 500];

// weighted rewards
const WEIGHTED_POOL = [
  10, 10, 10,
  20, 20,
  30, 30,
  50,
  100,
  500,
];

// Test Ad Unit
const BANNER_ID = ADMOB_BANNER_ID;

import { supabase } from "../config/supabase";
import { showInterstitialAd } from "../ads/InterstitialAdManager";

export default function DailyBonusScreen({ navigation }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const [locked, setLocked] = useState(false);
  const [timer, setTimer] = useState("");
  const [won, setWon] = useState(null);

  useEffect(() => {
    checkLock();
    const t = setInterval(checkLock, 1000);
    return () => clearInterval(t);
  }, []);

  /* ================= DAILY LOCK ================= */

  const checkLock = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check last claim from Supabase
      const { data, error } = await supabase
        .from("daily_bonuses")
        .select("claimed_at")
        .eq("user_id", user.id)
        .order("claimed_at", { ascending: false })
        .limit(1);

      if (!data || data.length === 0) {
        setLocked(false);
        setTimer("");
        return;
      }

      const lastSpin = new Date(data[0].claimed_at).getTime();
      const diff = 86400000 - (Date.now() - lastSpin);

      if (diff <= 0) {
        setLocked(false);
        setTimer("");
      } else {
        setLocked(true);
        setTimer(formatTime(diff));
      }
    } catch (e) {
      console.log("Check Lock Error:", e);
    }
  };

  const formatTime = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  /* ================= SPIN ================= */

  const spinWheel = async () => {
    if (locked) return;

    // Show Ad before spin
    showInterstitialAd();

    const reward =
      WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
    const index = SEGMENTS.indexOf(reward);
    const angle = 360 / SEGMENTS.length;

    const finalRotation =
      360 * 6 + (SEGMENTS.length - index) * angle;

    Animated.timing(rotateAnim, {
      toValue: finalRotation,
      duration: 4200,
      useNativeDriver: true,
    }).start(async () => {
      await giveReward(reward);
      checkLock();
    });
  };

  /* ================= REWARD ================= */

  const giveReward = async (coinsWon) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 🛡️ Atomic Reward via Supabase (F-05)
      const { atomicRewardCoins } = require("../services/supabaseService");
      const rewardRes = await atomicRewardCoins(coinsWon, `Daily Bonus Spin (+${coinsWon})`);
      const newBalance = rewardRes.success ? rewardRes.newBalance : coinsWon;

      // Sync to Firebase (for Admin Panel) with transaction
      try {
        const database = require("@react-native-firebase/database").default;
        await database().ref(`/wallets/${user.id}/balance`).transaction((cur) => {
          if (cur === null || cur === undefined) return newBalance;
          return cur + coinsWon;
        });
      } catch (fbError) {
        console.warn("Firebase Sync Error:", fbError.message);
      }

      // 3. Log Daily Bonus (Supabase)
      await supabase
        .from("daily_bonuses")
        .insert([{
          user_id: user.id,
          reward_amount: coinsWon,
          spin_result: coinsWon.toString()
        }]);

      // 4. Log Transaction
      await supabase
        .from("wallet_transactions")
        .insert([{
          user_id: user.id,
          transaction_type: "Daily Reward",
          amount: coinsWon,
          balance_after: newBalance,
          description: "Daily spin bonus reward"
        }]);

      setWon(coinsWon);
      scaleAnim.setValue(0);

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        setWon(null);
        Alert.alert("🎉 Congratulations!", `You won ${coinsWon} coins`, [
          {
            text: "OK",
            onPress: () => {
              // Show Ad after claiming
              showInterstitialAd();
            }
          }
        ]);
      }, 1800);
    } catch (e) {
      console.log("Give Reward Error:", e);
    }
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  /* ================= UI ================= */

  return (
    <SafeAreaView edges={['top']} style={styles.container}>

      {/* TOP HEADER ROW */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => fakeBack(navigation)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color="#38bdf8" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="gift" size={26} color="#facc15" style={{ marginRight: 8 }} />
          <Text style={{ color: "#facc15", fontSize: 20, fontWeight: "800" }}>Daily Spin Bonus</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* POINTER */}
      <View style={styles.pointer} />

      {/* WHEEL */}
      <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
        {SEGMENTS.map((value, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                transform: [
                  { rotate: `${(360 / SEGMENTS.length) * i}deg` },
                  { translateY: -WHEEL_SIZE / 2 + 30 },
                ],
              },
            ]}
          >
            <Text style={styles.segmentText}>{value}</Text>
          </View>
        ))}
      </Animated.View>

      {/* CENTER BUTTON */}
      <TouchableOpacity
        style={[
          styles.centerBtn,
          { backgroundColor: locked ? "#374151" : "#22c55e" },
        ]}
        onPress={spinWheel}
        disabled={locked}
      >
        <Text style={styles.centerText}>
          {locked ? "LOCKED" : "SPIN"}
        </Text>
      </TouchableOpacity>

      {locked && (
        <Text style={styles.timer}>Next spin in {timer}</Text>
      )}

      {/* WIN POP */}
      {won && (
        <Animated.View
          style={[
            styles.winBox,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.winText}>+{won} 🪙</Text>
        </Animated.View>
      )}

      {/* ✅ BANNER AD (BOTTOM SAFE ZONE) */}
      <View style={styles.adContainer}>
        <AdmobBannerCard asCard={false} />
      </View>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1f",
    alignItems: "center",
    justifyContent: "center",
  },

  topHeader: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 20,
  },

  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },

  backIcon: {
    width: 26,
    height: 26,
    tintColor: "#38bdf8",
  },

  title: {
    position: "absolute",
    top: 40,
    color: "#facc15",
    fontSize: 22,
    fontWeight: "800",
  },

  pointer: {
    position: "absolute",
    top: "36%",
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 22,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#ef4444",
    zIndex: 10,
  },

  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 12,
    borderColor: "#22c55e",
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
  },

  segment: {
    position: "absolute",
    width: 60,
    alignItems: "center",
  },

  segmentText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  centerBtn: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },

  centerText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "900",
  },

  timer: {
    position: "absolute",
    bottom: 110,
    color: "#facc15",
    fontSize: 14,
  },

  winBox: {
    position: "absolute",
    backgroundColor: "#22c55e",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
  },

  winText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "900",
  },

  adContainer: {
    position: "absolute",
    bottom: 0,
  },
});
