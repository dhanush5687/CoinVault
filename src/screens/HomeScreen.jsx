

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import FirebaseMarquee from "../components/FirebaseMarquee";
import { showInterstitialAd, loadInterstitialAd } from "../ads/InterstitialAdManager";
import { showAppOpenAd } from "../ads/AppOpenManager";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";


import { supabase } from "../config/supabase";
import { syncUserActivity } from "../services/supabaseService";

const { width } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
    const [userName, setUserName] = useState("User");
    const [profileCompleted, setProfileCompleted] = useState(false);

    const comingSoon = () => {
        Alert.alert(
            "Coming Soon",
            "This feature is under development and will be available very soon!",
            [{ text: "OK" }]
        );
    };

    // Show Interstitial on Home Focus (Popup) & every 2 minutes
    useFocusEffect(
        useCallback(() => {
            // Show App Open on Focus
            showAppOpenAd();

            // Initial popup ad after 2 seconds
            const initialTimer = setTimeout(() => {
                showInterstitialAd();
            }, 2000);

            // Repeat every 2 minutes
            const interval = setInterval(() => {
                console.log("⏰ 2-Min Popup Timer Triggered");
                showInterstitialAd();
            }, 120000); // 120,000ms = 2 minutes

            return () => {
                clearTimeout(initialTimer);
                clearInterval(interval);
            };
        }, [])
    );

    useEffect(() => {
        const unsubscribe = navigation.addListener("focus", () => {
            loadProfile();
        });
        return unsubscribe;
    }, [navigation]);

    // Load profile from Supabase
    const loadProfile = async () => {
        try {
            syncUserActivity(); // 🚀 Sync Device/IP/Location
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Profile
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (profile) {
                if (profile.display_name) setUserName(profile.display_name);

                // Update Last Active
                await supabase
                    .from("profiles")
                    .update({ last_login: new Date().toISOString() })
                    .eq("id", user.id);

                // 🚀 SYNC TO FIREBASE (Ensure Admin Panel has latest data)
                try {
                    const database = require("@react-native-firebase/database").default;
                    await database().ref(`/users/${user.id}`).update({
                        name: profile.display_name || "No Name",
                        mobile: profile.mobile || "N/A",
                        upi: profile.upi || "N/A",
                        email: user.email || "N/A",
                        image: profile.avatar_data || "",
                        referralCode: profile.referral_code || "",
                        referredBy: profile.referred_by || "",
                        lastLogin: new Date().toISOString()
                    });
                } catch (fbErr) {
                    console.log("Home Firebase Sync Error:", fbErr);
                }

                // Check Completion
                const isComplete = !!(
                    profile.display_name &&
                    profile.mobile &&
                    profile.upi
                );
                setProfileCompleted(isComplete);
            }
        } catch (e) {
            console.log("HomeScreen Profile Fetch Error:", e);
        }
    };

    return (
        <View style={styles.container}>
            <FirebaseMarquee
                // language="hi"
                language="en"
                onPress={(item) => {
                    if (item.action) {
                        navigation.navigate(item.action);
                    }
                }}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.hello}>Hey! {userName}</Text>
                        <MaterialCommunityIcons name="hand-wave" size={24} color="#facc15" style={{ marginLeft: 8 }} />
                    </View>
                    <Text style={styles.sub}>Let’s earn some coins today</Text>
                </View>

                {/* Performance Card (Only when profile is NOT completed) */}
                {!profileCompleted && (
                    <TouchableOpacity
                        style={styles.performanceCard}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("Profile")}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.performanceTitle}>Complete Your Profile</Text>
                            <Text style={styles.performanceStatus}>
                                Tap here to unlock full earnings
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="rocket-launch" size={32} color="#111" />
                    </TouchableOpacity>
                )}

                {/* Big Action Buttons */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate("Watch")}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="target" size={20} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionText}>Watch & Earn</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtnAlt} onPress={comingSoon}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="crystal-ball" size={20} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionText}>Get Your Future</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Top Ways To Win */}
                <Text style={styles.sectionTitle}>Top ways to win</Text>
                <View style={styles.topWinRow}>
                    <TouchableOpacity style={styles.winCard} onPress={comingSoon}>
                        <MaterialCommunityIcons name="controller" size={28} color="#38bdf8" />
                        <Text style={styles.winText}>Play Game</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.winCard} onPress={comingSoon}>
                        <MaterialCommunityIcons name="brain" size={28} color="#9333ea" />
                        <Text style={styles.winText}>Play Quiz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.winCard} onPress={() => navigation.navigate("SpinWheel")}>
                        <MaterialCommunityIcons name="ferris-wheel" size={28} color="#facc15" />
                        <Text style={styles.winText}>SpinWheel</Text>
                    </TouchableOpacity>
                </View>

                {/* Games List */}
                <Text style={styles.sectionTitle}>Play Games & Win</Text>

                {[1, 2, 3, 4].map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.gameCard}
                        activeOpacity={0.8}
                        onPress={comingSoon}
                    >
                        <View style={styles.gameImagePlaceholder}>
                            <MaterialCommunityIcons name="gamepad-variant" size={30} color="#fff" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.gameTitle}>Biology Quiz & Win</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <MaterialCommunityIcons name="fire" size={14} color="#22c55e" />
                                <Text style={styles.gameSub}> 20 coins / min</Text>
                            </View>
                            <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                {[1, 2, 3, 4].map(s => <MaterialCommunityIcons key={s} name="star" size={14} color="#facc15" />)}
                                <MaterialCommunityIcons name="star-outline" size={14} color="#facc15" />
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {/* Load More */}
                <TouchableOpacity style={styles.loadMoreBtn} onPress={comingSoon}>
                    <Text style={styles.loadMoreText}>Load More Games</Text>
                </TouchableOpacity>

                {/* Daily Bonus */}
                <View style={styles.dailyBonus}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="gift" size={22} color="#facc15" />
                        <Text style={[styles.dailyTitle, { marginLeft: 8 }]}>Daily Bonus</Text>
                    </View>
                    <Text style={styles.dailyText}>
                        Spend 5 minutes daily & get 150 bonus points
                    </Text>
                </View>

                <View style={{ height: 90 }} />
            </ScrollView>
        </View>
    );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0f1f" },

    header: { padding: 20 },

    hello: { fontSize: 22, fontWeight: "700", color: "#fff" },
    sub: { color: "#aaa", marginTop: 5 },

    performanceCard: {
        marginHorizontal: 15,
        backgroundColor: "#ff9f1c",
        borderRadius: 16,
        padding: 15,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    performanceTitle: { color: "#111", fontWeight: "700", fontSize: 15 },
    performanceStatus: { color: "#111", fontSize: 13, marginTop: 5 },
    performanceEmoji: { fontSize: 40 },

    actionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        margin: 15,
    },

    actionBtn: {
        flex: 1,
        backgroundColor: "#2563eb",
        marginRight: 8,
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
    },

    actionBtnAlt: {
        flex: 1,
        backgroundColor: "#9333ea",
        marginLeft: 8,
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
    },

    actionText: { color: "#fff", fontWeight: "600" },

    sectionTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        marginHorizontal: 15,
        marginTop: 20,
        marginBottom: 10,
    },

    topWinRow: { flexDirection: "row", justifyContent: "space-around" },

    winCard: {
        backgroundColor: "#111827",
        width: width / 3.5,
        borderRadius: 14,
        padding: 15,
        alignItems: "center",
    },

    winIcon: { fontSize: 26 },
    winText: { color: "#fff", marginTop: 5, fontSize: 12 },

    gameCard: {
        backgroundColor: "#111827",
        marginHorizontal: 15,
        marginVertical: 8,
        borderRadius: 14,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
    },

    gameImagePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: "#2563eb",
    },

    gameTitle: { color: "#fff", fontWeight: "600" },
    gameSub: { color: "#22c55e", fontSize: 12, marginTop: 4 },
    gameStars: { color: "#facc15", marginTop: 4 },

    loadMoreBtn: {
        backgroundColor: "#2563eb",
        margin: 20,
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
    },

    loadMoreText: { color: "#fff", fontWeight: "600" },

    dailyBonus: {
        backgroundColor: "#1f2933",
        marginHorizontal: 15,
        borderRadius: 16,
        padding: 15,
        marginBottom: 20,
    },

    dailyTitle: { color: "#facc15", fontSize: 16, fontWeight: "700" },
    dailyText: { color: "#fff", marginTop: 5, fontSize: 13 },
});
