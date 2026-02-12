

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Modal,
} from "react-native";
import { supabase } from "../config/supabase";
import {
    BannerAd,
    BannerAdSize,
} from "react-native-google-mobile-ads";
import { useFocusEffect } from "@react-navigation/native";
import {
    ADMOB_BANNER_ID,
} from "@env";
import { preloadRewardedAds, showRewardedAd, getAvailableAdsCount } from "../ads/RewardedAdManager";
import { showAppOpenAd } from "../ads/AppOpenManager";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");

// ---------------- MAIN SCREEN ----------------
export default function WatchScreen({ navigation }) {
    const [coins, setCoins] = useState(0);
    const [availableAds, setAvailableAds] = useState(0);
    const [isLoadingAd, setIsLoadingAd] = useState(false);
    const [noAdsVisible, setNoAdsVisible] = useState(false);

    // Load coins from Supabase
    useEffect(() => {
        fetchBalance();
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

    // Global ad count listener
    useEffect(() => {
        const timer = setInterval(() => {
            setAvailableAds(getAvailableAdsCount());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Show AppOpen when user enters screen
    useFocusEffect(
        useCallback(() => {
            showAppOpenAd();
            fetchBalance();
        }, [])
    );

    const earnCoins = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const reward = 10;
            const newBalance = coins + reward;

            // 1. Update Profile Balance
            const { error: pError } = await supabase
                .from("profiles")
                .update({ wallet_balance: newBalance })
                .eq("id", user.id);

            if (pError) throw pError;

            // 1b. Sync to Firebase (for Admin Panel)
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

            setCoins(newBalance);
            console.log("💰 Coins Synced to Supabase:", newBalance);
        } catch (e) {
            console.log("Earn Coins Error:", e);
        }
    };

    const handleWatchAd = () => {
        setIsLoadingAd(true);

        showRewardedAd(
            async () => {
                setIsLoadingAd(false);
                await earnCoins();
            },
            () => {
                setIsLoadingAd(false);
                setNoAdsVisible(true);
            }
        );
    };

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={32} color="#38bdf8" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Watch & Earn</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* TOP BANNER */}
            <View style={styles.banner}>
                <BannerAd
                    unitId={ADMOB_BANNER_ID}
                    size={BannerAdSize.ADAPTIVE_BANNER}
                />
            </View>

            <View style={styles.banner}>
                <BannerAd
                    unitId={ADMOB_BANNER_ID}
                    size={BannerAdSize.MEDIUM_RECTANGLE}
                />
            </View>

            {/* CONTENT */}
            <View style={styles.content}>
                <View style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="database" size={30} color="#22c55e" />
                        <Text style={[styles.balance, { marginLeft: 10 }]}>Coins: {coins}</Text>
                    </View>
                    <Text style={styles.queue}>Ads Ready: {availableAds}/15</Text>
                </View>

                <TouchableOpacity
                    style={styles.watchBtn}
                    onPress={handleWatchAd}
                    disabled={isLoadingAd}
                >
                    {isLoadingAd ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="play-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.watchText}>Watch Ad & Earn 10 Coins</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* BOTTOM BANNER */}
            <View style={styles.banner}>
                <BannerAd
                    unitId={ADMOB_BANNER_ID}
                    size={BannerAdSize.ADAPTIVE_BANNER}
                />
            </View>


            {/* NO ADS POPUP */}
            <Modal transparent visible={noAdsVisible} animationType="fade">
                <View style={styles.popupOverlay}>
                    <View style={styles.popupBox}>
                        <Text style={styles.popupTitle}>No Ads Available 😔</Text>
                        <Text style={styles.popupText}>
                            Ads are not available right now. Please try again later.
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

    back: {
        color: "#38bdf8",
        fontSize: 42,
        fontWeight: "700",
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
        width: width * 0.8,
        alignItems: "center",
        marginBottom: 30,
    },

    balance: {
        color: "#22c55e",
        fontSize: 22,
        fontWeight: "700",
    },

    queue: {
        color: "#38bdf8",
        fontSize: 14,
        marginTop: 5,
    },

    watchBtn: {
        backgroundColor: "#2563eb",
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 14,
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
    },

    popupBtn: {
        backgroundColor: "#eb25e8ff",
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 15,
    },
});


// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   ActivityIndicator,
//   Modal,
//   Dimensions,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { useFocusEffect } from "@react-navigation/native";
// import mobileAds, {
//   BannerAd,
//   BannerAdSize,
//   RewardedAd,
//   RewardedAdEventType,
//   AppOpenAd,
//   AdEventType,
//   TestIds,
// } from "react-native-google-mobile-ads";

// const { width } = Dimensions.get("window");

// /* ================= TEST IDS ================= */
// const BANNER_ID = TestIds.BANNER;
// const REWARDED_ID = TestIds.REWARDED;
// const APP_OPEN_ID = TestIds.APP_OPEN;

// /* ================= APP OPEN AD ================= */
// let appOpenAd = null;
// let appOpenLoaded = false;

// const loadAppOpenAd = () => {
//   appOpenLoaded = false;

//   appOpenAd = AppOpenAd.createForAdRequest(APP_OPEN_ID, {
//     requestNonPersonalizedAdsOnly: true,
//   });

//   appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
//     console.log("✅ AppOpen Loaded");
//     appOpenLoaded = true;
//   });

//   appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
//     console.log("🔁 AppOpen Closed");
//     appOpenLoaded = false;
//     loadAppOpenAd();
//   });

//   appOpenAd.addAdEventListener(AdEventType.ERROR, err => {
//     console.log("❌ AppOpen Error", err);
//     appOpenLoaded = false;
//   });

//   appOpenAd.load();
// };

// const showAppOpenAd = () => {
//   if (appOpenLoaded && appOpenAd) {
//     console.log("🚀 Showing AppOpen");
//     appOpenAd.show();
//   } else {
//     console.log("⚠️ AppOpen not ready");
//   }
// };

// /* ================= REWARDED ================= */
// let rewardedAd = null;

// const loadRewarded = () => {
//   rewardedAd = RewardedAd.createForAdRequest(REWARDED_ID, {
//     requestNonPersonalizedAdsOnly: true,
//   });

//   rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
//     console.log("✅ Rewarded Loaded");
//   });

//   rewardedAd.addAdEventListener(AdEventType.ERROR, err => {
//     console.log("❌ Rewarded Error", err);
//   });

//   rewardedAd.load();
// };

// /* ================= MAIN SCREEN ================= */
// export default function WatchScreen() {
//   const [coins, setCoins] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [noAds, setNoAds] = useState(false);

//   /* INIT ADMOB */
//   useEffect(() => {
//     mobileAds()
//       .initialize()
//       .then(() => {
//         console.log("✅ AdMob Initialized");
//         loadAppOpenAd();
//         loadRewarded();
//       });
//   }, []);

//   /* LOAD COINS */
//   useEffect(() => {
//     AsyncStorage.getItem("USER_COINS").then(v => {
//       if (v) setCoins(parseInt(v));
//     });
//   }, []);

//   /* SHOW APP OPEN SAFELY */
//   useFocusEffect(
//     useCallback(() => {
//       const t = setTimeout(() => {
//         showAppOpenAd();
//       }, 1500);
//       return () => clearTimeout(t);
//     }, [])
//   );

//   /* WATCH AD */
//   const watchAd = () => {
//     if (!rewardedAd) {
//       setNoAds(true);
//       return;
//     }

//     setLoading(true);

//     rewardedAd.addAdEventListener(
//       RewardedAdEventType.EARNED_REWARD,
//       async () => {
//         const newCoins = coins + 10;
//         setCoins(newCoins);
//         await AsyncStorage.setItem("USER_COINS", newCoins.toString());
//       }
//     );

//     rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
//       setLoading(false);
//       loadRewarded();
//     });

//     rewardedAd.show().catch(() => {
//       setLoading(false);
//       setNoAds(true);
//     });
//   };

//   return (
//     <View style={styles.container}>
//       <BannerAd unitId={BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />

//       <View style={styles.content}>
//         <View style={styles.card}>
//           <Text style={styles.balance}>💰 Coins: {coins}</Text>
//         </View>

//         <TouchableOpacity style={styles.btn} onPress={watchAd}>
//           {loading ? (
//             <ActivityIndicator color="#fff" />
//           ) : (
//             <Text style={styles.btnText}>▶ Watch Ad & Earn</Text>
//           )}
//         </TouchableOpacity>
//       </View>

//       <BannerAd unitId={BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />

//       <Modal transparent visible={noAds}>
//         <View style={styles.modal}>
//           <View style={styles.box}>
//             <Text style={{ color: "#fff" }}>No Ads Available</Text>
//             <TouchableOpacity onPress={() => setNoAds(false)}>
//               <Text style={{ color: "#38bdf8", marginTop: 10 }}>OK</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// /* ================= STYLES ================= */
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#0a0f1f" },
//   content: { flex: 1, justifyContent: "center", alignItems: "center" },
//   card: {
//     backgroundColor: "#111827",
//     padding: 20,
//     borderRadius: 16,
//     width: width * 0.8,
//     alignItems: "center",
//     marginBottom: 30,
//   },
//   balance: { color: "#22c55e", fontSize: 22, fontWeight: "700" },
//   btn: {
//     backgroundColor: "#2563eb",
//     paddingVertical: 14,
//     paddingHorizontal: 30,
//     borderRadius: 14,
//   },
//   btnText: { color: "#fff", fontWeight: "700" },
//   modal: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.6)",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   box: {
//     backgroundColor: "#111827",
//     padding: 20,
//     borderRadius: 16,
//     alignItems: "center",
//   },
// });
