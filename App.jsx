

// import React, { useEffect } from "react";
// import { NavigationContainer } from "@react-navigation/native";
// import { createNativeStackNavigator } from "@react-navigation/native-stack";
// import mobileAds from "react-native-google-mobile-ads";
// import { preloadRewardedAds } from "./src/ads/RewardedAdManager";

// import SplashScreen from "./src/screens/SplashScreen";
// import LoginScreen from "./src/screens/LoginScreen";
// import EmailScreen from "./src/screens/EmailScreen";
// import OTPScreen from "./src/screens/OTPScreen";
// import TabNavigator from "./src/navigation/TabNavigator";
// import WatchScreen from "./src/screens/WatchScreen";
// import SpinWheel from "./src/screens/DailyBonusScreen";




// const Stack = createNativeStackNavigator();





// export default function App() {



//   useEffect(() => {
//     const initAds = async () => {
//       await mobileAds().initialize();
//       console.log("AdMob initialized");

//       // Preload all ads at app launch
//       preloadRewardedAds();
//     };

//     initAds();
//   }, []);


//   useEffect(() => {
//     mobileAds().initialize();
//   }, []);

//   return (
//     <NavigationContainer>
//       <Stack.Navigator screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="Splash" component={SplashScreen} />
//         <Stack.Screen name="Login" component={LoginScreen} />
//         <Stack.Screen name="Email" component={EmailScreen} />
//         <Stack.Screen name="OTP" component={OTPScreen} />
//         <Stack.Screen name="Watch" component={WatchScreen} options={{ headerShown: false }}/>
//         <Stack.Screen name="SpinWheel" component={SpinWheel} options={{ headerShown: false }}/>

//         {/* Bottom Tabs Start Here */}
//         <Stack.Screen name="MainTabs" component={TabNavigator} />
//       </Stack.Navigator>
//     </NavigationContainer>
//   );
// }


import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
// import { withStallion } from 'react-native-stallion';
import { HotUpdater } from '@hot-updater/react-native';

// 🔥 Ads
import mobileAds from "react-native-google-mobile-ads";
import { preloadRewardedAds } from "./src/ads/RewardedAdManager";
import { loadAppOpenAd, showAppOpenAd } from "./src/ads/AppOpenManager";
import { loadInterstitialAd } from "./src/ads/InterstitialAdManager";

// Screens
import SplashScreen from "./src/screens/SplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import EmailScreen from "./src/screens/EmailScreen";
import PhoneScreen from "./src/screens/PhoneScreen";
import OTPScreen from "./src/screens/OTPScreen";
import TabNavigator from "./src/navigation/TabNavigator";
import WatchScreen from "./src/screens/WatchScreen";
import SpinWheel from "./src/screens/DailyBonusScreen";
import SignupScreen from "./src/screens/SignupScreen";
import AdminPanelScreen from "./src/screens/AdminPanelScreen";
import ChatScreen from "./src/screens/ChatScreen";
import AdminChatScreen from "./src/screens/AdminChatScreen";

// Components
// import StallionUpdateModal from "./src/components/StallionUpdateModal";

const Stack = createNativeStackNavigator();

function App() {

    /* ================= ADMOB & APP STATE ================= */
    useEffect(() => {
        const initAds = async () => {
            await mobileAds().initialize();
            preloadRewardedAds(); // preload rewarded ads
            loadAppOpenAd(); // preload app open ads
            loadInterstitialAd(); // preload interstitial ads

            // Sync user IP/Location/Status
            const { syncUserActivity } = require("./src/services/supabaseService");
            syncUserActivity();

            console.log("✅ AdMob initialized");
        };
        initAds();

        // Show AppOpen on App Foreground
        const { AppState } = require("react-native");
        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active") {
                showAppOpenAd();
            }
        });

        // 🚀 In-App Review after 10 Minutes
        const reviewTimeout = setTimeout(async () => {
            try {
                const InAppReview = require("react-native-in-app-review").default;
                const { supabase } = require("./src/config/supabase");
                const { data: { session } } = await supabase.auth.getSession();

                if (InAppReview.isAvailable() && session?.user) {
                    console.log("⭐ Triggering In-App Review...");
                    InAppReview.RequestInAppReview()
                        .then((hasFlowFinishedSuccessfully) => {
                            console.log("✅ Review flow finished:", hasFlowFinishedSuccessfully);
                        })
                        .catch((error) => {
                            console.log("❌ Review Error:", error);
                        });
                }
            } catch (e) {
                console.log("❌ Review service error:", e);
            }
        }, 10 * 60 * 1000); // 10 Minutes

        return () => {
            subscription.remove();
            clearTimeout(reviewTimeout);
        };
    }, []);

    return (
        <>
        <>
            {/* <StallionUpdateModal /> */}
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Splash" component={SplashScreen} />
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Signup" component={SignupScreen} />
                    <Stack.Screen name="Email" component={EmailScreen} />
                    <Stack.Screen name="Phone" component={PhoneScreen} />
                    <Stack.Screen name="OTP" component={OTPScreen} />

                    <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />

                    <Stack.Screen name="Watch" component={WatchScreen} />
                    <Stack.Screen name="SpinWheel" component={SpinWheel} />
                    <Stack.Screen name="Chat" component={ChatScreen} />
                    <Stack.Screen name="AdminChat" component={AdminChatScreen} />

                    {/* MAIN APP */}
                    <Stack.Screen name="MainTabs" component={TabNavigator} />
                </Stack.Navigator>
            </NavigationContainer>
        </>
        </>
    );
}

export default App;
// export default withStallion(App);