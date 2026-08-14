import React, { useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Animated,
    StatusBar,
    Dimensions,
} from "react-native";
import LottieView from "lottie-react-native";

const { width, height } = Dimensions.get("window");

export default function SplashScreen({ navigation }) {
    const scaleAnim = useRef(new Animated.Value(0.6)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;

    useEffect(() => {
        // Animation Start
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 900,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 900,
                useNativeDriver: true,
            }),
        ]).start();

        // Check Session
        const checkSession = async () => {
            // Wait for animation min 2s
            await new Promise(r => setTimeout(r, 3000));

            try {
                const { supabase } = require("../config/supabase");
                const { data: { session }, error } = await supabase.auth.getSession();

                // If error or no session, go to login
                if (error || !session?.user) {
                    if (error) {
                        console.log("❌ Session Error:", error.message);
                        // Force signout to clear invalid session/refresh tokens
                        await supabase.auth.signOut();
                    }
                    navigation.replace("Login");
                } else {
                    console.log("✅ Auto Login:", session.user.email);
                    navigation.replace("MainTabs");
                }
            } catch (e) {
                console.log("❌ Catch Splash Error:", e);
                navigation.replace("Login");
            }
        };

        checkSession();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#0b1c3d" barStyle="light-content" />

            {/* Diagonal Blue Background */}
            <View style={styles.blueLayer1} />
            <View style={styles.blueLayer2} />

            {/* Logo Section */}
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
                        opacity: opacityAnim,
                    },
                ]}
            >
                <View style={styles.logoCircle}>
                    <Text style={{ fontSize: 60 }}>💰</Text>
                </View>
                <Text style={styles.title}>COIN VAULT</Text>
                <Text style={styles.subtitle}>Earning Made Simple</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0f1f",
        justifyContent: "center",
        alignItems: "center",
    },

    /* Diagonal Layers */
    blueLayer1: {
        position: "absolute",
        top: -120,
        left: -80,
        width: width * 1.4,
        height: height * 0.45,
        backgroundColor: "#1e4fd8",
        transform: [{ rotate: "-15deg" }],
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
    },
    blueLayer2: {
        position: "absolute",
        bottom: -140,
        left: -100,
        width: width * 1.4,
        height: height * 0.45,
        backgroundColor: "#1e4fd8",
        transform: [{ rotate: "12deg" }],
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
    },

    logoContainer: {
        alignItems: "center",
        zIndex: 10,
    },

    logoCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "#2563eb",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#2563eb",
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 10,
    },

    eye: {
        fontSize: 40,
        position: "absolute",

    },

    rupee: {
        fontSize: 28,
        color: "#fff",
        marginTop: 58,
        fontWeight: "bold",
    },

    title: {
        marginTop: 20,
        fontSize: 28,
        fontWeight: "900",
        color: "#ffffff",
        letterSpacing: 3,
    },
    subtitle: {
        fontSize: 14,
        color: "#38bdf8",
        fontWeight: "600",
        letterSpacing: 1,
        marginTop: 5,
    },
});
