import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

const { height } = Dimensions.get("window");

export default function OTPScreen({ navigation, route }) {
  const { email, phone } = route.params || {};
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Supabase uses 6-digit OTPs
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  // Timer state
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: height * 0.35,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, "");
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const handleBackspace = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && otp[index] === "" && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setCanResend(false);
    setTimer(60);

    try {
      if (phone === "8885551616" || phone === "+918885551616") {
        alert("Admin users only  please  login with your own email id");
        return;
      }

      const { sendOtpToEmail, sendOtpToPhone } = require("../services/supabaseService");
      let result;
      if (email) {
        result = await sendOtpToEmail(email);
      } else if (phone) {
        result = await sendOtpToPhone(phone);
      }

      if (result && result.success) {
        alert("Code sent again!");
      } else {
        alert("Wait before resending: " + (result?.error || "Unknown error"));
        setCanResend(true);
        setTimer(0);
      }
    } catch (e) {
      alert("Error resending code");
    }
  };

  const handleVerifyOTP = async () => {
    const finalOtp = otp.join("");
    if (finalOtp.length < 6) {
      alert("Please enter complete 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      // 🔥 Admin Bypass
      if ((phone === "8885551616" || phone === "+918885551616") && finalOtp === "885687") {
        console.log("🚀 Admin Access Granted");
        navigation.replace("AdminPanel");
        return;
      }

      const { verifyOtpForEmail, verifyOtpForPhone } = require("../services/supabaseService");
      let result;
      if (email) {
        result = await verifyOtpForEmail(email, finalOtp);
      } else if (phone) {
        result = await verifyOtpForPhone(phone, finalOtp);
      }

      if (result && result.success) {
        console.log("✅ Verified!");
        navigation.replace("MainTabs");
      } else {
        alert("Invalid OTP: " + (result?.error || "Unknown error"));
      }
    } catch (error) {
      alert("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#0a0f1f" barStyle="light-content" />

      {/* Dim background */}
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
          <Text style={styles.title}>Enter Login Code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{" "}
            <Text style={{ fontWeight: "600" }}>{email || phone}</Text>
          </Text>

          {/* OTP Inputs */}
          <View style={styles.otpRow}>
            {otp.map((value, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputs.current[index] = ref)}
                style={styles.otpInput}
                maxLength={1}
                keyboardType="numeric"
                value={value}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(e) => handleBackspace(e, index)}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            <Text style={styles.verifyText}>
              {loading ? "Verifying..." : "Verify Code"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendBtn, { opacity: canResend ? 1 : 0.5 }]}
            onPress={handleResend}
            disabled={!canResend}
          >
            <Text style={styles.resendText}>
              {canResend ? "Resend Code" : `Resend in ${timer}s`}
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

  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 12,
    textAlign: "center",
    fontSize: 18,
    color: "#111",
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
    marginBottom: 15,
  },

  verifyText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  resendBtn: {
    alignItems: "center",
  },

  resendText: {
    color: "#2563eb",
    fontWeight: "600",
  },
});
