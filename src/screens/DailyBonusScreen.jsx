import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fakeBack } from "../components/FackBack";
import AdmobBannerCard from "../components/AdmobBannerCard";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { supabase } from "../config/supabase";
import { showInterstitialAd } from "../ads/InterstitialAdManager";

const { width } = Dimensions.get("window");
const WHEEL_SIZE = Math.min(width * 0.75, 310);

// 8 Segments on the Wheel
// Regular max reward: 10 coins
// Day 3 streak: 100 coins (once per month)
// Day 7 streak: 500 coins (once per month)
const SEGMENTS = [10, 2, 100, 4, 8, 500, 5, 3];
const REGULAR_POOL = [2, 3, 4, 5, 8, 10]; // Maximum 10 coins on normal spins

export default function DailyBonusScreen({ navigation }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const isSpinningRef = useRef(false);

  const [locked, setLocked] = useState(false);
  const [timer, setTimer] = useState("");
  const [won, setWon] = useState(null);

  // Background Streak & Month state (silent under the hood)
  const [streak, setStreak] = useState(1);
  const [claimed100ThisMonth, setClaimed100ThisMonth] = useState(false);
  const [claimed500ThisMonth, setClaimed500ThisMonth] = useState(false);

  const currentMonthKey = new Date().toISOString().slice(0, 7); // e.g. "2026-11"

  useEffect(() => {
    checkLockAndStreak();
    const t = setInterval(checkLockAndStreak, 1000);
    return () => clearInterval(t);
  }, []);

  /* ================= STREAK & MONTHLY STATUS (UNDER THE HOOD) ================= */

  const checkLockAndStreak = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = Date.now();
      let serverSpinTime = 0;

      // 1. Authoritative check from Supabase daily_bonuses
      const { data: bonusList } = await supabase
        .from("daily_bonuses")
        .select("created_at, claimed_at, reward_amount")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(35);

      let hasClaimed100 = false;
      let hasClaimed500 = false;

      if (bonusList && bonusList.length > 0) {
        const rawTime = bonusList[0].claimed_at || bonusList[0].created_at;
        if (rawTime) {
          serverSpinTime = new Date(rawTime).getTime();
        }

        // Check if 100 or 500 were already claimed in current month
        for (const b of bonusList) {
          const dStr = b.claimed_at || b.created_at || "";
          if (dStr.startsWith(currentMonthKey)) {
            if (b.reward_amount === 100) hasClaimed100 = true;
            if (b.reward_amount === 500) hasClaimed500 = true;
          }
        }
      }

      // Check local storage fallback
      const localSpinRaw = await AsyncStorage.getItem("LAST_SPIN_TIME");
      const localSpinTime = localSpinRaw ? parseInt(localSpinRaw, 10) : 0;
      const localStreakRaw = await AsyncStorage.getItem("DAILY_SPIN_STREAK");
      let storedStreak = localStreakRaw ? parseInt(localStreakRaw, 10) : 1;

      const local100Month = await AsyncStorage.getItem(`SPIN_CLAIMED_100_${currentMonthKey}`);
      const local500Month = await AsyncStorage.getItem(`SPIN_CLAIMED_500_${currentMonthKey}`);
      if (local100Month === "true") hasClaimed100 = true;
      if (local500Month === "true") hasClaimed500 = true;

      setClaimed100ThisMonth(hasClaimed100);
      setClaimed500ThisMonth(hasClaimed500);

      const lastSpin = Math.max(serverSpinTime, localSpinTime);

      if (!lastSpin || isNaN(lastSpin)) {
        // First spin ever
        setLocked(false);
        setTimer("");
        setStreak(1);
        return;
      }

      // Clock tampering check
      if (now < lastSpin) {
        setLocked(true);
        setTimer("Clock Desynced");
        return;
      }

      const timeSinceLastSpin = now - lastSpin;
      const diff = 86400000 - timeSinceLastSpin; // 24 hours lock

      if (diff <= 0) {
        // Unlocked! Ready to spin
        setLocked(false);
        setTimer("");

        // Calculate upcoming streak
        if (timeSinceLastSpin <= 48 * 3600000) {
          // Came back within 48h -> streak increases
          const upcomingStreak = storedStreak + 1;
          setStreak(upcomingStreak);
        } else {
          // Missed more than 48 hours -> streak resets to 1
          setStreak(1);
          await AsyncStorage.setItem("DAILY_SPIN_STREAK", "1").catch(() => {});
        }
      } else {
        // Locked
        setLocked(true);
        setTimer(formatTime(diff));
        setStreak(storedStreak);
      }
    } catch (e) {
      console.log("Check Lock & Streak Error:", e);
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
    if (locked || isSpinningRef.current) return;
    isSpinningRef.current = true;
    setLocked(true);

    // Show Ad before spin
    showInterstitialAd();

    // 🌟 Milestone Reward Decision:
    // 1. Day 3: 100 Coins (Only once per month)
    // 2. Day 7: 500 Coins (Only once per month)
    // 3. Otherwise: Max 10 Coins (from REGULAR_POOL)
    let reward = 10;
    let isMilestone100 = false;
    let isMilestone500 = false;

    if (streak === 3 && !claimed100ThisMonth) {
      reward = 100;
      isMilestone100 = true;
    } else if (streak === 7 && !claimed500ThisMonth) {
      reward = 500;
      isMilestone500 = true;
    } else {
      // Normal spin: Maximum 10 coins
      reward = REGULAR_POOL[Math.floor(Math.random() * REGULAR_POOL.length)];
    }

    const index = SEGMENTS.indexOf(reward);
    const angle = 360 / SEGMENTS.length;

    // Exact clockwise rotation landing under the top pointer
    const finalRotation = 360 * 6 + (SEGMENTS.length - index) * angle;

    Animated.timing(rotateAnim, {
      toValue: finalRotation,
      duration: 4200,
      useNativeDriver: true,
    }).start(async () => {
      await giveReward(reward, isMilestone100, isMilestone500);
      isSpinningRef.current = false;
      checkLockAndStreak();
    });
  };

  /* ================= REWARD ================= */

  const giveReward = async (coinsWon, isMilestone100, isMilestone500) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      // 1. Save spin timestamp and streak locally
      await AsyncStorage.setItem("LAST_SPIN_TIME", nowMs.toString()).catch(() => {});
      await AsyncStorage.setItem("DAILY_SPIN_STREAK", streak.toString()).catch(() => {});

      if (coinsWon === 100) {
        await AsyncStorage.setItem(`SPIN_CLAIMED_100_${currentMonthKey}`, "true").catch(() => {});
        setClaimed100ThisMonth(true);
      } else if (coinsWon === 500) {
        await AsyncStorage.setItem(`SPIN_CLAIMED_500_${currentMonthKey}`, "true").catch(() => {});
        setClaimed500ThisMonth(true);
      }

      // 2. 🛡️ Atomic Reward via Supabase (supports up to 500 coins)
      const { atomicRewardCoins } = require("../services/supabaseService");
      const rewardRes = await atomicRewardCoins(coinsWon, `Daily Bonus Spin (+${coinsWon})`);
      const newBalance = rewardRes.success ? rewardRes.newBalance : coinsWon;

      // 3. Sync to Firebase (for Admin Panel)
      try {
        const database = require("@react-native-firebase/database").default;
        await database().ref(`/wallets/${user.id}`).update({
          balance: newBalance,
          lastUpdated: nowMs,
        });
      } catch (fbError) {
        console.warn("Firebase Sync Error:", fbError.message);
      }

      // 4. Log Daily Bonus record in Supabase
      await supabase
        .from("daily_bonuses")
        .insert([{
          user_id: user.id,
          reward_amount: coinsWon,
          spin_result: coinsWon.toString(),
          claimed_at: nowIso,
          created_at: nowIso,
        }]);

      // 5. Log Transaction in Supabase
      let txDesc = "Daily spin bonus reward";
      if (coinsWon === 100) txDesc = "Daily Milestone Reward (+100 Coins)";
      if (coinsWon === 500) txDesc = "Daily Mega Bonus (+500 Coins)";

      await supabase
        .from("wallet_transactions")
        .insert([{
          user_id: user.id,
          transaction_type: "Daily Reward",
          amount: coinsWon,
          balance_after: newBalance,
          description: txDesc,
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

        let alertTitle = "🎉 Congratulations!";
        let alertMsg = `You won ${coinsWon} coins!`;
        if (coinsWon === 500) {
          alertTitle = "🏆 Mega Jackpot!";
        }

        Alert.alert(alertTitle, alertMsg, [
          {
            text: "Claim Coins",
            onPress: () => {
              showInterstitialAd();
            },
          },
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
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => fakeBack(navigation)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={26} color="#38bdf8" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MaterialCommunityIcons name="gift" size={24} color="#facc15" style={{ marginRight: 6 }} />
          <Text style={styles.screenTitle}>Daily Spin Bonus</Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* CENTER CONTENT */}
      <View style={styles.mainContent}>
        {/* WHEEL ASSEMBLY */}
        <View style={styles.wheelAssembly}>
          {/* POINTER */}
          <View style={styles.pointer} />

          {/* WHEEL */}
          <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
            {SEGMENTS.map((value, i) => {
              const is100 = value === 100;
              const is500 = value === 500;

              return (
                <View
                  key={i}
                  style={[
                    styles.segment,
                    {
                      transform: [
                        { rotate: `${(360 / SEGMENTS.length) * i}deg` },
                        { translateY: -WHEEL_SIZE / 2 + 28 },
                      ],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      is100 && { color: "#fbbf24", fontWeight: "900", fontSize: 16 },
                      is500 && { color: "#38bdf8", fontWeight: "900", fontSize: 16 },
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              );
            })}
          </Animated.View>

          {/* CENTER SPIN BUTTON */}
          <TouchableOpacity
            style={[
              styles.centerBtn,
              { backgroundColor: locked ? "#374151" : "#22c55e" },
            ]}
            onPress={spinWheel}
            disabled={locked}
            activeOpacity={0.8}
          >
            <Text style={styles.centerText}>
              {locked ? "LOCKED" : "SPIN"}
            </Text>
          </TouchableOpacity>
        </View>

        {locked && (
          <View style={styles.timerWrap}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#facc15" style={{ marginRight: 5 }} />
            <Text style={styles.timer}>Next spin unlocks in {timer}</Text>
          </View>
        )}

        {/* WIN POPUP ANIMATION */}
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
      </View>

      {/* BANNER AD (BOTTOM SAFE ZONE) */}
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
  },

  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#020617",
  },

  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },

  screenTitle: {
    color: "#facc15",
    fontSize: 18,
    fontWeight: "800",
  },

  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 70,
  },

  wheelAssembly: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 15,
  },

  pointer: {
    position: "absolute",
    top: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 24,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#ef4444",
    zIndex: 30,
  },

  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 10,
    borderColor: "#22c55e",
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    zIndex: 25,
  },

  centerText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
  },

  timerWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    backgroundColor: "#1e293b",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },

  timer: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "600",
  },

  winBox: {
    position: "absolute",
    top: "52%",
    backgroundColor: "#22c55e",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
    zIndex: 50,
    elevation: 10,
  },

  winText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "900",
  },

  adContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
  },
});
