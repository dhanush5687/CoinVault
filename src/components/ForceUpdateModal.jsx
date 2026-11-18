// ForceUpdateModal.jsx
// Displays a non-dismissible force update modal when a higher version is published on Play Store

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    BackHandler,
    Alert,
    ScrollView,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import {
    checkAppVersionStatus,
    subscribeToVersionUpdates,
    openPlayStore,
} from "../services/appUpdateService";

export default function ForceUpdateModal() {
    const [updateInfo, setUpdateInfo] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Initial check on mount
        checkAppVersionStatus().then((info) => {
            if (info?.isUpdateAvailable) {
                setUpdateInfo(info);
                setVisible(true);
            }
        });

        // Realtime subscription from Firebase
        const unsubscribe = subscribeToVersionUpdates((info) => {
            if (info?.isUpdateAvailable) {
                setUpdateInfo(info);
                setVisible(true);
            } else {
                setVisible(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Intercept Android hardware back press when force update is active
    useEffect(() => {
        if (!visible || !updateInfo?.isForceUpdate) return;

        const onBackPress = () => {
            Alert.alert(
                "Update Required",
                "CoinVault requires this update to keep your account, real ads, and wallet secure. Please update now to continue.",
                [
                    {
                        text: "Exit App",
                        style: "destructive",
                        onPress: () => BackHandler.exitApp(),
                    },
                    {
                        text: "Update on Play Store",
                        onPress: () => openPlayStore(updateInfo?.updateUrl),
                    },
                ]
            );
            return true;
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => subscription.remove();
    }, [visible, updateInfo]);

    if (!visible || !updateInfo) return null;

    const isForce = updateInfo.isForceUpdate;

    const handleUpdateNow = () => {
        openPlayStore(updateInfo.updateUrl);
    };

    const handleLater = () => {
        setVisible(false);
    };

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={() => {
                if (isForce) {
                    BackHandler.exitApp();
                } else {
                    setVisible(false);
                }
            }}
        >
            <View style={styles.overlay}>
                <View style={styles.modalCard}>
                    {/* ICON */}
                    <View style={styles.iconCircle}>
                        <MaterialCommunityIcons name="rocket-launch" size={38} color="#22c55e" />
                    </View>

                    {/* TITLE */}
                    <Text style={styles.title}>
                        {isForce ? "Update Required! 🚀" : "New Update Available! ✨"}
                    </Text>

                    {/* VERSION COMPARISON BADGE */}
                    <View style={styles.versionBadgeRow}>
                        <View style={styles.versionPillOld}>
                            <Text style={styles.versionPillOldText}>
                                Installed: v{updateInfo.installedVersion}
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="arrow-right-bold" size={16} color="#38bdf8" style={{ marginHorizontal: 6 }} />
                        <View style={styles.versionPillNew}>
                            <Text style={styles.versionPillNewText}>
                                Latest: v{updateInfo.latestVersion}
                            </Text>
                        </View>
                    </View>

                    {/* MESSAGE */}
                    <Text style={styles.desc}>
                        {updateInfo.message}
                    </Text>

                    {/* RELEASE NOTES */}
                    {updateInfo.releaseNotes ? (
                        <View style={styles.notesBox}>
                            <Text style={styles.notesTitle}>What's New:</Text>
                            <ScrollView style={{ maxHeight: 110 }} showsVerticalScrollIndicator={false}>
                                <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
                            </ScrollView>
                        </View>
                    ) : null}

                    {/* UPDATE NOW BUTTON */}
                    <TouchableOpacity
                        style={styles.updateBtn}
                        onPress={handleUpdateNow}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="google-play" size={20} color="#000" style={{ marginRight: 8 }} />
                        <Text style={styles.updateBtnText}>Update on Google Play</Text>
                    </TouchableOpacity>

                    {/* LATER / EXIT BUTTON */}
                    {!isForce ? (
                        <TouchableOpacity
                            style={styles.laterBtn}
                            onPress={handleLater}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.laterBtnText}>Maybe Later</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.exitBtn}
                            onPress={() => BackHandler.exitApp()}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.exitBtnText}>Exit App</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.88)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },

    modalCard: {
        backgroundColor: "#111827",
        width: "100%",
        borderRadius: 22,
        padding: 24,
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: "#22c55e",
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
    },

    iconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "rgba(34, 197, 94, 0.12)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(34, 197, 94, 0.3)",
    },

    title: {
        fontSize: 21,
        fontWeight: "900",
        color: "#fff",
        textAlign: "center",
        marginBottom: 8,
    },

    versionBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
    },

    versionPillOld: {
        backgroundColor: "#1e293b",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#334155",
    },

    versionPillOldText: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "600",
    },

    versionPillNew: {
        backgroundColor: "rgba(34, 197, 94, 0.18)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#22c55e",
    },

    versionPillNewText: {
        color: "#4ade80",
        fontSize: 12,
        fontWeight: "700",
    },

    desc: {
        fontSize: 14,
        color: "#cbd5e1",
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 14,
    },

    notesBox: {
        width: "100%",
        backgroundColor: "#0f172a",
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#1e293b",
        marginBottom: 18,
    },

    notesTitle: {
        color: "#38bdf8",
        fontSize: 12,
        fontWeight: "bold",
        marginBottom: 4,
        textTransform: "uppercase",
    },

    notesText: {
        color: "#94a3b8",
        fontSize: 12,
        lineHeight: 18,
    },

    updateBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#22c55e",
        width: "100%",
        paddingVertical: 14,
        borderRadius: 14,
        elevation: 4,
    },

    updateBtnText: {
        color: "#000",
        fontSize: 16,
        fontWeight: "800",
    },

    laterBtn: {
        marginTop: 12,
        paddingVertical: 8,
    },

    laterBtnText: {
        color: "#94a3b8",
        fontSize: 14,
        fontWeight: "600",
    },

    exitBtn: {
        marginTop: 12,
        paddingVertical: 8,
    },

    exitBtnText: {
        color: "#ef4444",
        fontSize: 13,
        fontWeight: "600",
    },
});
