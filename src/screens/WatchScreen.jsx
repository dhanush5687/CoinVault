import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Modal,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import {
    BannerAd,
    BannerAdSize,
} from "react-native-google-mobile-ads";
import { useFocusEffect } from "@react-navigation/native";
import {
    ADMOB_BANNER_ID,
} from "@env";

const LIVE_BANNER_ID = ADMOB_BANNER_ID || "ca-app-pub-2490251867268823/5116361111";
import { preloadRewardedAds, showRewardedAd, getAvailableAdsCount } from "../ads/RewardedAdManager";
import { showAppOpenAd } from "../ads/AppOpenManager";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");
const DAILY_MAX_ADS = 15;

// ---------------- MAIN SCREEN ----------------
export default function WatchScreen({ navigation }) {
    const [coins, setCoins] = useState(0);
    const [remainingAds, setRemainingAds] = useState(DAILY_MAX_ADS);
    const [isLoadingAd, setIsLoadingAd] = useState(false);
    const [noAdsVisible, setNoAdsVisible] = useState(false);

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

    // Load coins from Supabase & Firebase
    useEffect(() => {
        preloadRewardedAds();
        fetchBalance();
        loadDailyQuota();
    }, []);

    const fetchBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load from Firebase
            const database = require("@react-native-firebase/database").default;
            const snapshot = await database().ref(`/wallets/${user.id}`).once("value");

            if (snapshot.exists()) {
                const walletData = snapshot.val();
                setCoins(parseFloat(walletData.balance) || 0);
            } else {
                // Fallback to Supabase
                const { data } = await supabase
                    .from("profiles")
                    .select("wallet_balance")
                    .eq("id", user.id)
                    .single();
                if (data) setCoins(parseFloat(data.wallet_balance) || 0);
            }
        } catch (e) {
            console.log("Balance Fetch Error:", e);
        }
    };

    // Show AppOpen when user enters screen
    useFocusEffect(
        useCallback(() => {
            showAppOpenAd();
            fetchBalance();
            loadDailyQuota();
        }, [])
    );

    const earnCoins = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const reward = 10;
            // 🛡️ Atomic Reward via Supabase (F-05)
            const { atomicRewardCoins } = require("../services/supabaseService");
            const rewardRes = await atomicRewardCoins(reward, "Watched rewarded ad");
            const newBalance = rewardRes.success ? rewardRes.newBalance : (coins + reward);

            // Sync to Firebase (for Admin Panel)
            try {
                const database = require("@react-native-firebase/database").default;
                await database().ref(`/wallets/${user.id}`).update({
                    balance: newBalance,
                    lastUpdated: Date.now()
                });
            } catch (fbError) {
                console.warn("Firebase Sync Error:", fbError.message);
            }

            // 2. Log Transaction (Supabase)
            const { error: tError } = await supabase
                .from("wallet_transactions")
                .insert([{
                    user_id: user.id,
                    transaction_type: "Ad Reward",
                    amount: reward,
                    balance_after: newBalance,
                    description: "Watched rewarded ad"
                }]);

            if (tError) console.error("Transaction Log Error:", tError.message);

            // 3. Update daily quota
            const key = getTodayKey();
            const watchedStr = await AsyncStorage.getItem(key);
            const newWatched = parseInt(watchedStr || "0", 10) + 1;
            await AsyncStorage.setItem(key, newWatched.toString());
            setRemainingAds(Math.max(0, DAILY_MAX_ADS - newWatched));

            setCoins(newBalance);
            console.log("💰 Coins Synced to Supabase & Firebase:", newBalance);
        } catch (e) {
            console.log("Earn Coins Error:", e);
        }
    };

    const handleWatchAd = () => {
        if (remainingAds <= 0) {
            Alert.alert(
                "Daily Limit Reached 🎉",
                "You have completed all 15 video ads for today! Come back tomorrow for 15 more ads.",
                [{ text: "OK" }]
            );
            return;
        }

        setIsLoadingAd(true);

        showRewardedAd(
            async () => {
                setIsLoadingAd(false);
                await earnCoins();
            },
            () => {
                setIsLoadingAd(false);
                setNoAdsVisible(true);
            },
            () => {
                setIsLoadingAd(false);
            }
        );
    };

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#38bdf8" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Watch & Earn</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* TOP BANNER */}
            <View style={styles.banner}>
                <BannerAd
                    unitId={LIVE_BANNER_ID}
                    size={BannerAdSize.ADAPTIVE_BANNER}
                    requestOptions={{ requestNonPersonalizedAdsOnly: false }}
                />
            </View>

            <View style={styles.banner}>
                <BannerAd
                    unitId={LIVE_BANNER_ID}
                    size={BannerAdSize.MEDIUM_RECTANGLE}
                    requestOptions={{ requestNonPersonalizedAdsOnly: false }}
                />
            </View>

            {/* CONTENT */}
            <View style={styles.content}>
                <View style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="database" size={30} color="#22c55e" />
                        <Text style={[styles.balance, { marginLeft: 10 }]}>Coins: {coins}</Text>
                    </View>
                    <Text style={styles.queue}>
                        🎬 Ads Ready: {remainingAds}/{DAILY_MAX_ADS} Today
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.watchBtn, remainingAds <= 0 && { backgroundColor: "#334155" }]}
                    onPress={handleWatchAd}
                    disabled={isLoadingAd || remainingAds <= 0}
                    activeOpacity={0.8}
                >
                    {isLoadingAd ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons
                                name={remainingAds > 0 ? "play-circle" : "check-circle"}
                                size={24}
                                color="#fff"
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.watchText}>
                                {remainingAds > 0 ? "Watch Real Ad & Earn 10 Coins" : "Daily Limit Completed (15/15)"}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
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
                            Ads are temporarily not available from Google AdMob right now. Please wait a few moments and try again.
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

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0f1f",
    },

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

    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    card: {
        backgroundColor: "#111827",
        padding: 20,
        borderRadius: 16,
        width: width * 0.85,
        alignItems: "center",
        marginBottom: 30,
        borderWidth: 1,
        borderColor: "#1e293b",
    },

    balance: {
        color: "#22c55e",
        fontSize: 22,
        fontWeight: "700",
    },

    queue: {
        color: "#38bdf8",
        fontSize: 14,
        marginTop: 8,
        fontWeight: "600",
    },

    watchBtn: {
        backgroundColor: "#2563eb",
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 14,
        elevation: 3,
    },

    watchText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

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

    popupTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },

    popupText: {
        color: "#9ca3af",
        marginTop: 10,
        textAlign: "center",
        lineHeight: 20,
    },

    popupBtn: {
        backgroundColor: "#2563eb",
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 15,
    },
});
