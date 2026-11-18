// OnAirUpdateScreen.jsx
// Fallback component for HotUpdater: displays live download progress for On-Air updates

import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
    StatusBar,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const { width } = Dimensions.get("window");

export default function OnAirUpdateScreen({
    progress = 0,
    status = "UPDATING",
    message = null,
    downloadedBytes = 0,
    totalBytes = 0,
}) {
    const percent = Math.min(100, Math.max(0, Math.round((progress || 0) * 100)));

    const formatBytes = (bytes) => {
        if (!bytes || bytes <= 0) return "";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0f1f" />

            {/* RADAR/LIGHTNING ICON */}
            <View style={styles.iconContainer}>
                <View style={styles.iconCircleOuter}>
                    <View style={styles.iconCircleInner}>
                        <MaterialCommunityIcons name="lightning-bolt" size={48} color="#38bdf8" />
                    </View>
                </View>
            </View>

            {/* TITLE & DESCRIPTION */}
            <Text style={styles.title}>CoinVault On-Air Updater ⚡</Text>
            <Text style={styles.subtitle}>
                Applying live update over-the-air. Restarting automatically once completed!
            </Text>

            {/* PROGRESS BAR */}
            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>

            {/* PERCENTAGE & BYTES */}
            <View style={styles.progressTextRow}>
                <Text style={styles.percentText}>{percent}%</Text>
                {totalBytes > 0 ? (
                    <Text style={styles.bytesText}>
                        {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
                    </Text>
                ) : (
                    <Text style={styles.bytesText}>Downloading assets...</Text>
                )}
            </View>

            <View style={styles.statusBox}>
                <ActivityIndicator size="small" color="#22c55e" style={{ marginRight: 8 }} />
                <Text style={styles.statusText}>
                    {message || "Downloading latest update bundle..."}
                </Text>
            </View>

            <Text style={styles.helperNotice}>
                Please keep the app open while we finish installing the update.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0f1f",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },

    iconContainer: {
        marginBottom: 24,
    },

    iconCircleOuter: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: "rgba(56, 189, 248, 0.08)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "rgba(56, 189, 248, 0.25)",
    },

    iconCircleInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(56, 189, 248, 0.18)",
        alignItems: "center",
        justifyContent: "center",
    },

    title: {
        fontSize: 22,
        fontWeight: "900",
        color: "#fff",
        textAlign: "center",
        marginBottom: 8,
    },

    subtitle: {
        fontSize: 14,
        color: "#94a3b8",
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 30,
        maxWidth: width * 0.85,
    },

    progressBarTrack: {
        width: "100%",
        height: 10,
        backgroundColor: "#1e293b",
        borderRadius: 5,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#334155",
        marginBottom: 10,
    },

    progressBarFill: {
        height: "100%",
        backgroundColor: "#38bdf8",
        borderRadius: 5,
    },

    progressTextRow: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },

    percentText: {
        color: "#38bdf8",
        fontSize: 16,
        fontWeight: "800",
    },

    bytesText: {
        color: "#64748b",
        fontSize: 13,
        fontWeight: "600",
    },

    statusBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111827",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#1e293b",
        marginBottom: 16,
    },

    statusText: {
        color: "#22c55e",
        fontSize: 13,
        fontWeight: "600",
    },

    helperNotice: {
        color: "#64748b",
        fontSize: 12,
        textAlign: "center",
    },
});
