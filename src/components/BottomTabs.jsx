import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";

export default function BottomTabs({ onTabChange }) {
  const [activeTab, setActiveTab] = useState("Home");

  const homeAnim = useRef(new Animated.Value(1)).current;
  const gamesAnim = useRef(new Animated.Value(0)).current;
  const walletAnim = useRef(new Animated.Value(0)).current;
  const profileAnim = useRef(new Animated.Value(0)).current;

  const animateTab = (tab) => {
    const animations = {
      Home: homeAnim,
      Games: gamesAnim,
      Wallet: walletAnim,
      Profile: profileAnim,
    };

    Object.keys(animations).forEach((key) => {
      Animated.timing(animations[key], {
        toValue: key === tab ? 1 : 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    setActiveTab(tab);
    onTabChange && onTabChange(tab);
  };

  const renderTab = (label, icon, animValue) => {
    const scale = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.25],
    });

    const isActive = activeTab === label;

    return (
      <TouchableOpacity onPress={() => animateTab(label)} style={styles.tabBtn}>
        <Animated.View style={[styles.tabItem, { transform: [{ scale }] }]}>
          <Text
            style={[
              styles.icon,
              { color: isActive ? "#38bdf8" : "#6b7280" },
            ]}
          >
            {icon}
          </Text>
          {isActive && <View style={styles.activeDot} />}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderTab("Home", "🏠", homeAnim)}
      {renderTab("Games", "🎮", gamesAnim)}
      {renderTab("Wallet", "💰", walletAnim)}
      {renderTab("Profile", "👤", profileAnim)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#020617",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#2563eb",
  },

  tabBtn: {
    alignItems: "center",
    justifyContent: "center",
  },

  tabItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    fontSize: 22,
  },

  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#38bdf8",
    marginTop: 4,
  },
});
