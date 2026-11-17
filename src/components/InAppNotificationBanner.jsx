import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { subscribeToSupportChat } from "../services/chatService";

export const notificationRef = {
    show: null,
};

export const triggerInAppNotification = (title, message, onPress) => {
    if (notificationRef.show) {
        notificationRef.show({ title, message, onPress });
    }
};

export default function InAppNotificationBanner({ navigationRef }) {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [notificationData, setNotificationData] = useState({
        title: "Support Team",
        message: "",
        onPress: null,
    });

    const translateY = useRef(new Animated.Value(-160)).current;
    const hideTimeout = useRef(null);
    const lastNotifiedTimestamp = useRef(0);

    // Register global trigger
    useEffect(() => {
        notificationRef.show = ({ title, message, onPress }) => {
            displayNotification(title, message, onPress);
        };
        return () => {
            notificationRef.show = null;
        };
    }, []);

    // Listen to Firebase support messages for logged-in user
    useEffect(() => {
        const unsubscribe = subscribeToSupportChat(({ hasUnread, lastMessage, lastTimestamp }) => {
            if (hasUnread && lastTimestamp) {
                const currentRoute = navigationRef?.current?.getCurrentRoute()?.name;
                // Don't show banner if user is already inside the Chat screen
                if (currentRoute === "Chat") return;

                // Show notification if it's a new timestamp or hasn't been shown yet
                if (lastNotifiedTimestamp.current !== lastTimestamp) {
                    lastNotifiedTimestamp.current = lastTimestamp;
                    displayNotification(
                        "🎧 Support Team",
                        lastMessage || "Admin replied to your message",
                        () => navigationRef?.current?.navigate("Chat")
                    );
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [navigationRef]);

    const displayNotification = (title, message, onPress) => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);

        setNotificationData({ title, message, onPress });
        setVisible(true);

        Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
        }).start();

        // Auto dismiss after 5.5 seconds
        hideTimeout.current = setTimeout(() => {
            dismissNotification();
        }, 5500);
    };

    const dismissNotification = () => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        Animated.timing(translateY, {
            toValue: -150,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setVisible(false);
        });
    };

    const handlePress = () => {
        const action = notificationData.onPress;
        dismissNotification();
        if (action) {
            action();
        } else if (navigationRef?.current) {
            navigationRef.current.navigate("Chat");
        }
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    top: Math.max(insets.top, 10),
                    transform: [{ translateY }],
                },
            ]}
        >
            <TouchableOpacity
                style={styles.content}
                activeOpacity={0.9}
                onPress={handlePress}
            >
                <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="headphones" size={24} color="#38bdf8" />
                </View>

                <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{notificationData.title}</Text>
                        <Text style={styles.timeTag}>Just now</Text>
                    </View>
                    <Text style={styles.message} numberOfLines={2}>
                        {notificationData.message}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={dismissNotification}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MaterialCommunityIcons name="close" size={18} color="#94a3b8" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 14,
        right: 14,
        zIndex: 99999,
        elevation: 10,
    },
    content: {
        backgroundColor: "#1e293b",
        borderRadius: 16,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: "#38bdf8",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 12,
    },
    iconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#0f172a",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: "#334155",
    },
    textContainer: {
        flex: 1,
        marginRight: 8,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 2,
    },
    title: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
    timeTag: {
        color: "#38bdf8",
        fontSize: 11,
        fontWeight: "500",
    },
    message: {
        color: "#cbd5e1",
        fontSize: 13,
        lineHeight: 18,
    },
    closeBtn: {
        padding: 6,
        borderRadius: 14,
        backgroundColor: "#0f172a",
    },
});

