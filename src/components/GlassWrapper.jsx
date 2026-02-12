// import React from "react";
// import { View, ImageBackground, StyleSheet } from "react-native";
// import { BlurView } from "@react-native-community/blur";

// export default function GlassWrapper({ children }) {
//   return (
//     <ImageBackground
//       source={require("../assets/bg.jpg")} // your gradient / colorful bg
//       style={styles.container}
//       resizeMode="cover"
//     >
//       <BlurView
//         style={StyleSheet.absoluteFill}
//         blurType="light"        // IMPORTANT: light instead of dark
//         blurAmount={8}          // low blur keeps colors
//         reducedTransparencyFallbackColor="rgba(255,255,255,0.15)"
//       />

//       <View style={styles.content}>{children}</View>
//     </ImageBackground>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   content: {
//     flex: 1,
//     backgroundColor: "rgba(255,255,255,0.06)", // glass tint, not black
//   },
// });

import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "@react-native-community/blur";
import LinearGradient from "react-native-linear-gradient";

export default function GlassWrapper({ children }) {
  return (
    <View style={styles.container}>
      {/* Colorful Gradient Background */}
      <LinearGradient
        colors={["#0f172a", "#1e3a8a", "#2563eb", "#38bdf8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Glass Blur Layer */}
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="light"
        blurAmount={8}
        reducedTransparencyFallbackColor="rgba(255,255,255,0.2)"
      />

      {/* App UI */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)", // glass tint
  },
});
