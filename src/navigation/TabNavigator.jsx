

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, Animated } from "react-native";

import HomeScreen from "../screens/HomeScreen";
import WalletScreen from "../screens/WalletScreen";
import ProfileScreen from "../screens/ProfileScreen";

import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const Tab = createBottomTabNavigator();

import LottieView from "lottie-react-native";

/* ================= 3D TAB ICON ================= */
function TabIcon({ icon, focused, color, lottie }) {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View
      style={{
        alignItems: "center",
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          width: 50,
          height: 100, // accommodate lottie sizing
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {lottie ? (
          <LottieView
            source={lottie}
            autoPlay={focused}
            loop={focused}
            style={{ width: 45, height: 45 }}
          />
        ) : (
          <MaterialCommunityIcons name={icon} size={28} color={color} />
        )}
      </View>
      {focused && (
        <View
          style={{
            width: 10,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
            marginTop: -25,
          }}
        />
      )}
    </Animated.View>
  );
}

/* ================= TAB NAVIGATOR ================= */
export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          left: 15,
          right: 15,
          bottom: 10,
          height: 75,
          backgroundColor: "#020617",
          borderRadius: 25,
          borderTopWidth: 0,
          elevation: 15,
          shadowColor: "#2563eb",
          shadowOpacity: 0.5,
          shadowRadius: 12,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={focused ? "home" : "home-outline"}
              focused={focused}
              color="#38bdf8"
            />
          ),
        }}
      />

      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={focused ? "wallet" : "wallet-outline"}
              focused={focused}
              color="#fbbf24"
            />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={focused ? "account" : "account-outline"}
              focused={focused}
              color="#38bdf8"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}


// import React from "react";
// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
// import { View, Text, Animated, StyleSheet } from "react-native";
// import { BlurView } from "@react-native-community/blur";

// import HomeScreen from "../screens/HomeScreen";
// import WalletScreen from "../screens/WalletScreen";
// import ProfileScreen from "../screens/ProfileScreen";

// const Tab = createBottomTabNavigator();

// /* 3D + Glass Icon */
// function TabIcon({ icon, focused, color }) {
//   const anim = React.useRef(new Animated.Value(0)).current;

//   React.useEffect(() => {
//     Animated.spring(anim, {
//       toValue: focused ? 1 : 0,
//       friction: 4,
//       tension: 70,
//       useNativeDriver: true,
//     }).start();
//   }, [focused]);

//   const rotateX = anim.interpolate({
//     inputRange: [0, 1],
//     outputRange: ["0deg", "-25deg"],
//   });

//   const scale = anim.interpolate({
//     inputRange: [0, 1],
//     outputRange: [1, 1.25],
//   });

//   const translateY = anim.interpolate({
//     inputRange: [0, 1],
//     outputRange: [0, -8],
//   });

//   return (
//     <Animated.View
//       style={{
//         alignItems: "center",
//         transform: [
//           { perspective: 800 },
//           { translateY },
//           { rotateX },
//           { scale },
//         ],
//       }}
//     >
//       <View style={[styles.iconBox, focused && styles.activeBox]}>
//         <Text style={{ fontSize: 22, color }}>{icon}</Text>
//       </View>
//       {focused && <View style={styles.dot} />}
//     </Animated.View>
//   );
// }

// export default function TabNavigator() {
//   return (
//     <Tab.Navigator
//       screenOptions={{
//         headerShown: false,
//         tabBarShowLabel: false,
//         tabBarStyle: {
//           position: "absolute",
//           backgroundColor: "transparent",
//           borderTopWidth: 0,
//           elevation: 0,
//         },
//         tabBarBackground: () => (
//           <BlurView
//             blurType="dark"
//             blurAmount={20}
//             reducedTransparencyFallbackColor="rgba(0,0,0,0.7)"
//             style={StyleSheet.absoluteFill}
//           />
//         ),
//         tabBarItemStyle: {
//           marginVertical: 12,
//         },
//       }}
//     >
//       <Tab.Screen
//         name="Home"
//         component={HomeScreen}
//         options={{
//           tabBarIcon: ({ focused }) => (
//             <TabIcon icon="🏠" focused={focused} color="#38bdf8" />
//           ),
//         }}
//       />

//       <Tab.Screen
//         name="Wallet"
//         component={WalletScreen}
//         options={{
//           tabBarIcon: ({ focused }) => (
//             <TabIcon icon="💰" focused={focused} color="#38bdf8" />
//           ),
//         }}
//       />

//       <Tab.Screen
//         name="Profile"
//         component={ProfileScreen}
//         options={{
//           tabBarIcon: ({ focused }) => (
//             <TabIcon icon="👤" focused={focused} color="#38bdf8" />
//           ),
//         }}
//       />
//     </Tab.Navigator>
//   );
// }

// const styles = StyleSheet.create({
//   iconBox: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: "rgba(255,255,255,0.05)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.15)",
//     justifyContent: "center",
//     alignItems: "center",
//   },

//   activeBox: {
//     backgroundColor: "rgba(56,189,248,0.15)",
//     borderColor: "rgba(56,189,248,0.4)",
//     shadowColor: "#38bdf8",
//     shadowOpacity: 0.6,
//     shadowRadius: 10,
//     elevation: 12,
//   },

//   dot: {
//     width: 8,
//     height: 4,
//     borderRadius: 2,
//     backgroundColor: "#38bdf8",
//     marginTop: 4,
//   },
// });
