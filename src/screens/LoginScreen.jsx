import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from "react-native";
const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#0b1c3d" barStyle="light-content" />

      {/* Diagonal Background */}
      <View style={styles.blueLayer1} />
      <View style={styles.blueLayer2} />

      {/* Logo */}
      <View style={styles.logoBox}>
        <View style={styles.logoCircle}>
          <Text style={styles.eye}>👀</Text>
          <Text style={styles.rupee}>₹</Text>
        </View>
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.welcome}>Welcome Back!</Text>
        {/* 
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.emailBtn}
          onPress={() => navigation.navigate("Email")}
        >
          <Text style={styles.btnIcon}>✉️</Text>
          <Text style={styles.btnText}>Login with Email OTP</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.emailBtn, { marginTop: 15, backgroundColor: "#10b981", shadowColor: "#10b981" }]}
          onPress={() => navigation.navigate("Phone")}
        >
          <Text style={styles.btnIcon}>📱</Text>
          <Text style={styles.btnText}>Login with Phone OTP</Text>
        </TouchableOpacity>

        {/* OR Divider */}
        <View style={styles.orRow}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.signupBtn}
          onPress={() => navigation.navigate("Signup")}
        >
          <Text style={styles.signupText}>Create Account</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1f",
  },

  /* Background layers */
  blueLayer1: {
    position: "absolute",
    top: -140,
    left: -90,
    width: width * 1.4,
    height: height * 0.4,
    backgroundColor: "#1e4fd8",
    transform: [{ rotate: "-15deg" }],
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },

  blueLayer2: {
    position: "absolute",
    top: -80,
    left: -50,
    width: width * 1.4,
    height: height * 0.35,
    backgroundColor: "#2563eb",
    transform: [{ rotate: "-15deg" }],
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    opacity: 0.85,
  },

  logoBox: {
    marginTop: 70,
    alignItems: "center",
  },

  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1a1819ff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },

  eye: {
    fontSize: 28,
    position: "absolute",
  },

  rupee: {
    fontSize: 20,
    color: "#fff",
    marginTop: 58,
    fontWeight: "bold",
  },

  content: {
    marginTop: 120,
    paddingHorizontal: 25,
  },

  welcome: {
    color: "#111",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 25,
  },

  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },

  btnIcon: {
    fontSize: 20,
    marginRight: 8,
  },

  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#2563eb",
  },

  orText: {
    marginHorizontal: 10,
    color: "#2563eb",
    fontWeight: "600",
  },

  signupBtn: {
    marginTop: 20,
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },

  signupText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleBtn: {
    backgroundColor: "#f43f5e",
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f43f5e",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 15,
  },
});
