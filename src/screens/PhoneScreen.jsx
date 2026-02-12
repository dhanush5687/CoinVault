import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from "react-native";

const { height } = Dimensions.get("window");

export default function PhoneScreen({ navigation }) {
    const slideAnim = useRef(new Animated.Value(height)).current;
    // State
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: height * 0.35,
            duration: 700,
            useNativeDriver: true,
        }).start();
    }, []);

    const handleVerify = async () => {
        // Basic phone validation (digits and +)
        if (!phone || phone.length < 10) {
            alert("Please enter a valid phone number with country code (e.g. +91...)");
            return;
        }

        setLoading(true);
        try {
            if (phone === "8885551616" || phone === "+918885551616") {
                alert("Admin Mode: Redirecting to OTP Screen. Use static code: 885687");
                navigation.navigate("OTP", { phone });
                return;
            }

            const { sendOtpToPhone } = require("../services/supabaseService");
            const result = await sendOtpToPhone(phone);

            if (result.success) {
                console.log("OTP Sent Successfully to:", phone);
                alert("Verification Code Sent! \n\nPlease check your messages.");
                navigation.navigate("OTP", { phone });
            } else {
                console.log("OTP Send Failure:", result.error);
                alert("Error: " + result.error);
            }
        } catch (error) {
            alert("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#0a0f1f" barStyle="light-content" />

            {/* Dim Background */}
            <View style={styles.overlay} />

            {/* Bottom Sheet */}
            <Animated.View
                style={[
                    styles.sheet,
                    {
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <Text style={styles.title}>Verify your Phone</Text>
                    <Text style={styles.subtitle}>
                        Please enter your phone number with country code, we’ll send you an OTP to verify.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="e.g. +91 9876543210"
                        placeholderTextColor="#888"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                    />

                    <TouchableOpacity
                        style={[styles.verifyBtn, { opacity: loading ? 0.7 : 1 }]}
                        onPress={handleVerify}
                        disabled={loading}
                    >
                        <Text style={styles.verifyText}>
                            {loading ? "Sending..." : "Go & Verify"}
                        </Text>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0f1f",
    },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.6)",
    },

    sheet: {
        position: "absolute",
        left: 0,
        right: 0,
        height: height,
        backgroundColor: "#fff",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 25,
    },

    title: {
        fontSize: 22,
        fontWeight: "700",
        color: "#111",
        marginBottom: 10,
    },

    subtitle: {
        color: "#666",
        fontSize: 14,
        marginBottom: 25,
    },

    input: {
        borderWidth: 1,
        borderColor: "#2563eb",
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: "#111",
        marginBottom: 20,
    },

    verifyBtn: {
        backgroundColor: "#2563eb",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        shadowColor: "#2563eb",
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 6,
    },

    verifyText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
