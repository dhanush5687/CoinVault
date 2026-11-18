

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Alert,
    BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import FirebaseMarquee from "../components/FirebaseMarquee";
import { showInterstitialAd, loadInterstitialAd } from "../ads/InterstitialAdManager";
import { showAppOpenAd } from "../ads/AppOpenManager";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";


import { supabase } from "../config/supabase";
import { syncUserActivity } from "../services/supabaseService";
import { subscribeToSupportChat } from "../services/chatService";
import { QUIZ_CATEGORIES } from "./QuizScreen";
import AdmobBannerCard from "../components/AdmobBannerCard";

const { width } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
    const [userName, setUserName] = useState("User");
    const [profileCompleted, setProfileCompleted] = useState(false);
    const [showAllGames, setShowAllGames] = useState(false);
    const [unreadSupportMessage, setUnreadSupportMessage] = useState(null);

    const comingSoon = () => {
        Alert.alert(
            "Coming Soon",
            "This feature is under development and will be available very soon!",
            [{ text: "OK" }]
        );
    };

    // Show Interstitial on Home Focus (Popup) & every 2 minutes + Hardware Back Handler
    useFocusEffect(
        useCallback(() => {
            // Show App Open on Focus
            showAppOpenAd();

            // Initial popup ad after 12 seconds to prevent overlapping full-screen ads
            const initialTimer = setTimeout(() => {
                showInterstitialAd();
            }, 12000);

            // Repeat every 2 minutes
            const interval = setInterval(() => {
                console.log("⏰ 2-Min Popup Timer Triggered");
                showInterstitialAd();
            }, 120000); // 120,000ms = 2 minutes

            // Hardware back press on Home tab prompts to exit app
            const onBackPress = () => {
                Alert.alert("Exit App", "Are you sure you want to exit FaceVault?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Exit", onPress: () => BackHandler.exitApp() },
                ]);
                return true;
            };

            const backSubscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

            return () => {
                clearTimeout(initialTimer);
                clearInterval(interval);
                backSubscription.remove();
            };
        }, [])
    );

    useEffect(() => {
        const unsubscribeFocus = navigation.addListener("focus", () => {
            loadProfile();
        });

        // 💬 Realtime listener for Support message replies from admin
        const unsubscribeChat = subscribeToSupportChat(({ hasUnread, lastMessage, lastTimestamp }) => {
            if (hasUnread) {
                setUnreadSupportMessage({ lastMessage, lastTimestamp });
            } else {
                setUnreadSupportMessage(null);
            }
        });

        return () => {
            unsubscribeFocus();
            unsubscribeChat();
        };
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
        <SafeAreaView edges={['top']} style={styles.container}>
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

                {/* 💬 Support New Message Alert Card */}
                {unreadSupportMessage && (
                    <TouchableOpacity
                        style={styles.supportAlertCard}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("Chat")}
                    >
                        <View style={styles.supportAlertIconBox}>
                            <MaterialCommunityIcons name="headphones" size={24} color="#38bdf8" />
                            <View style={styles.supportAlertDot} />
                        </View>
                        <View style={styles.supportAlertTextCol}>
                            <View style={styles.supportAlertHeaderRow}>
                                <Text style={styles.supportAlertTitle}>Support Team Replied</Text>
                                <View style={styles.supportAlertBadge}>
                                    <Text style={styles.supportAlertBadgeText}>1 NEW</Text>
                                </View>
                            </View>
                            <Text style={styles.supportAlertSnippet} numberOfLines={1}>
                                {unreadSupportMessage.lastMessage || "Admin replied to your message. Tap to chat."}
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color="#38bdf8" />
                    </TouchableOpacity>
                )}

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

                    <TouchableOpacity style={styles.winCard} onPress={() => navigation.navigate("Quiz", { category: "genetics" })}>
                        <MaterialCommunityIcons name="brain" size={28} color="#9333ea" />
                        <Text style={styles.winText}>Play Quiz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.winCard} onPress={() => navigation.navigate("SpinWheel")}>
                        <MaterialCommunityIcons name="ferris-wheel" size={28} color="#facc15" />
                        <Text style={styles.winText}>SpinWheel</Text>
                    </TouchableOpacity>
                </View>

                {/* Games List */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 15, marginTop: 20, marginBottom: 10 }}>
                    <Text style={[styles.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>Play Games & Win</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Quiz", { category: "all" })}>
                        <Text style={{ color: "#38bdf8", fontWeight: "600", fontSize: 13 }}>View All ({QUIZ_CATEGORIES.length})</Text>
                    </TouchableOpacity>
                </View>

                {QUIZ_CATEGORIES.slice(0, showAllGames ? QUIZ_CATEGORIES.length : 4).map((cat, index) => (
                    <React.Fragment key={cat.id}>
                        <TouchableOpacity
                            style={styles.gameCard}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate("Quiz", { category: cat.id, title: cat.title })}
                        >
                            <View style={[styles.gameImagePlaceholder, { backgroundColor: cat.color }]}>
                                <MaterialCommunityIcons name={cat.icon} size={28} color="#fff" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <Text style={styles.gameTitle}>{cat.title} & Win</Text>
                                    {cat.badge && (
                                        <View style={{ backgroundColor: cat.badgeColor + "22", borderColor: cat.badgeColor, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                            <Text style={{ color: cat.badgeColor, fontSize: 9, fontWeight: "700" }}>{cat.badge}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                                    <MaterialCommunityIcons name="lightning-bolt" size={14} color="#facc15" />
                                    <Text style={styles.gameSub}>
                                        +1 Correct • <Text style={{ color: "#ef4444", fontWeight: "700" }}>-1 Wrong</Text> • 35s Timer
                                    </Text>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                                    {[1, 2, 3, 4].map((s) => (
                                        <MaterialCommunityIcons key={s} name="star" size={14} color="#facc15" />
                                    ))}
                                    {cat.stars === 5 ? (
                                        <MaterialCommunityIcons name="star" size={14} color="#facc15" />
                                    ) : (
                                        <MaterialCommunityIcons name="star-half-full" size={14} color="#facc15" />
                                    )}
                                    <Text style={{ color: "#94a3b8", fontSize: 11, marginLeft: 6 }}>OpenTDB Live Trivia</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={22} color="#64748b" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>

                        {/* Banner Ad Card inside Play Games & Win */}
                        {index === 1 && (
                            <AdmobBannerCard asCard={true} />
                        )}
                    </React.Fragment>
                ))}

                {/* Load More */}
                <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => setShowAllGames(!showAllGames)}
                >
                    <Text style={styles.loadMoreText}>
                        {showAllGames ? "Show Fewer Categories" : `Explore All Categories (${QUIZ_CATEGORIES.length})`}
                    </Text>
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

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Bottom Sticky Banner Ad */}
            <View style={{ alignItems: "center", backgroundColor: "#0a0f1f", paddingBottom: 68 }}>
                <AdmobBannerCard asCard={false} />
            </View>
        </SafeAreaView>
    );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0f1f" },

    header: { padding: 20 },

    hello: { fontSize: 22, fontWeight: "700", color: "#fff" },
    sub: { color: "#aaa", marginTop: 5 },

    // 💬 Support Alert Card
    supportAlertCard: {
        marginHorizontal: 15,
        marginBottom: 16,
        backgroundColor: "#1e293b",
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: "#38bdf8",
        shadowColor: "#38bdf8",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    supportAlertIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#0f172a",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: "#334155",
        position: "relative",
    },
    supportAlertDot: {
        position: "absolute",
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#22c55e",
        borderWidth: 1.5,
        borderColor: "#0f172a",
    },
    supportAlertTextCol: {
        flex: 1,
        marginRight: 8,
    },
    supportAlertHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 3,
    },
    supportAlertTitle: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "bold",
    },
    supportAlertBadge: {
        backgroundColor: "#2563eb",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    supportAlertBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "bold",
    },
    supportAlertSnippet: {
        color: "#94a3b8",
        fontSize: 13,
    },

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
        alignItems: "center",
        justifyContent: "center",
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
