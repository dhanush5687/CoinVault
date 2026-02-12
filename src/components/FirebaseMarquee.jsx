import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from "react-native";
import database from "@react-native-firebase/database";

const screenWidth = Dimensions.get("window").width;

export default function FirebaseMarquee({
  language,
  onPress,
  containerStyle,
  textStyle,
}) {
  const translateX = useRef(new Animated.Value(screenWidth)).current;
  const [messages, setMessages] = useState([]);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(8000);

  const lang = language || (I18nManager.isRTL ? "hi" : "en");

  /* ================= FIREBASE ================= */
  useEffect(() => {
    // Message listener
    const msgRef = database().ref(`/marqueeMessages/${lang}`);

    // Config listener
    const confRef = database().ref("/marqueeConfig/speed");

    const onMsgChange = msgRef.on("value", (snap) => {
      if (!snap.exists()) {
        setMessages([]);
        return;
      }
      const data = snap.val();
      const activeMessages = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })).filter(m => m.active === true && m.text);

      setMessages(activeMessages);
      setIndex(0);
    });

    const onConfChange = confRef.on("value", (snap) => {
      if (snap.exists() && typeof snap.val() === "number") {
        setSpeed(snap.val());
      }
    });

    return () => {
      msgRef.off("value", onMsgChange);
      confRef.off("value", onConfChange);
    };
  }, [lang]);

  /* ================= ANIMATION ================= */
  useEffect(() => {
    if (messages.length === 0) return;

    translateX.stopAnimation();
    translateX.setValue(screenWidth);

    const animate = () => {
      Animated.timing(translateX, {
        toValue: -screenWidth - 200, // Extra buffer for long text
        duration: speed,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          // If we only have 1 message, we force the index update logic
          // to trigger this effect again even if the index is same.
          // But since index depends on state, we manually reset it or toggle it.
          setIndex(prev => (messages.length > 1 ? (prev + 1) % messages.length : -1));
        }
      });
    };

    // If index was set to -1 (toggle trick for 1 message), reset to 0
    if (index === -1) {
      setIndex(0);
      return;
    }

    animate();

    return () => translateX.stopAnimation();
  }, [index, messages.length, speed]);

  if (messages.length === 0) return null;

  const currentMsg = messages[index] || messages[0];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress && onPress(currentMsg)}
    >
      <View style={[styles.container, containerStyle]}>
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.text,
            textStyle,
            { transform: [{ translateX }] },
          ]}
        >
          {currentMsg?.text}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    marginHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  text: {
    position: "absolute",
    color: "#facc15",
    fontSize: 15,
    fontWeight: "bold",
    whiteSpace: 'nowrap'
  },
});
// import React, { useEffect, useRef, useState } from "react";
// import {
//   View,
//   Text,
//   Animated,
//   Dimensions,
//   StyleSheet,
//   TouchableOpacity,
//   I18nManager,
// } from "react-native";
// import database from "@react-native-firebase/database";

// const SCREEN_WIDTH = Dimensions.get("window").width;

// export default function FirebaseMarquee({
//   language,
//   onPress,
//   height = 40,
// }) {
//   const translateX = useRef(new Animated.Value(0)).current;
//   const animationRef = useRef(null);

//   const [messages, setMessages] = useState([]);
//   const [index, setIndex] = useState(0);
//   const [speed, setSpeed] = useState(10000);

//   const lang = language || (I18nManager.isRTL ? "hi" : "en");

//   /* ================= FIREBASE ================= */
//   useEffect(() => {
//     const speedRef = database().ref("/marqueeConfig/speed");
//     const msgRef = database().ref(`/marqueeMessages/${lang}`);

//     speedRef.on("value", snap => {
//       if (snap.exists() && typeof snap.val() === "number") {
//         setSpeed(snap.val());
//       }
//     });

//     msgRef.on("value", snap => {
//       if (!snap.exists()) {
//         setMessages([]);
//         return;
//       }

//       const list = Object.values(snap.val())
//         .filter(m => m && m.active === true && m.text)
//         .map(m => ({
//           text: m.text,
//           action: m.action || null,
//         }));

//       setMessages(list);
//       setIndex(0);
//     });

//     return () => {
//       speedRef.off();
//       msgRef.off();
//     };
//   }, [lang]);

//   /* ================= SCROLL LOGIC ================= */
//   useEffect(() => {
//     translateX.stopAnimation();

//     // ❌ No scrolling if 0 or 1 message
//     if (messages.length <= 1) {
//       translateX.setValue(0);
//       return;
//     }

//     // ⏱ split speed so 2–3 messages appear quickly
//     const visibleCount = Math.min(messages.length, 3);
//     const duration = Math.max(3000, Math.floor(speed / visibleCount));

//     translateX.setValue(SCREEN_WIDTH);

//     animationRef.current = Animated.loop(
//       Animated.timing(translateX, {
//         toValue: -SCREEN_WIDTH,
//         duration,
//         useNativeDriver: true,
//       })
//     );

//     animationRef.current.start();

//     return () => {
//       translateX.stopAnimation();
//     };
//   }, [messages, speed]);

//   /* ================= TEXT SWITCH ================= */
//   useEffect(() => {
//     if (messages.length <= 1) return;

//     const interval = setInterval(() => {
//       setIndex(prev => (prev + 1) % messages.length);
//       translateX.setValue(SCREEN_WIDTH);
//     }, Math.max(3000, speed / Math.min(messages.length, 3)));

//     return () => clearInterval(interval);
//   }, [messages, speed]);

//   if (messages.length === 0) return null;

//   /* ================= UI ================= */
//   return (
//     <TouchableOpacity
//       activeOpacity={0.8}
//       onPress={() => onPress?.(messages[index])}
//     >
//       <View style={[styles.container, { height }]}>
//         {messages.length === 1 ? (
//           // ✅ STATIC (1 message)
//           <Text numberOfLines={1} style={styles.staticText}>
//             {messages[0].text}
//           </Text>
//         ) : (
//           // 🔁 GUARANTEED SCROLLING
//           <Animated.Text
//             numberOfLines={1}
//             style={[
//               styles.animatedText,
//               { transform: [{ translateX }] },
//             ]}
//           >
//             {messages[index].text}
//           </Animated.Text>
//         )}
//       </View>
//     </TouchableOpacity>
//   );
// }

// /* ================= STYLES ================= */

// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: "#020617",
//     borderRadius: 8,
//     overflow: "hidden",
//     justifyContent: "center",
//   },

//   staticText: {
//     color: "#facc15",
//     fontSize: 15,
//     fontWeight: "600",
//     textAlign: "center",
//     paddingHorizontal: 12,
//   },

//   animatedText: {
//     position: "absolute",
//     color: "#facc15",
//     fontSize: 15,
//     fontWeight: "600",
//     paddingHorizontal: 12,
//   },
// });
