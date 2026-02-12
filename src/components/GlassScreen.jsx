import React from "react";
import { View, Text, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";

export default function SecureCard({ title, subtitle, lottie }) {
  return (
    <View style={styles.card}>
      <LottieView
        source={lottie}
        autoPlay
        loop
        style={styles.animation}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "90%",
    borderRadius: 20,
    padding: 20,
    marginVertical: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.4)",
    alignItems: "center",
    shadowColor: "#00ffff",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  animation: {
    width: 120,
    height: 120,
  },
  title: {
    color: "#00ffff",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
    marginTop: 5,
  },
});
