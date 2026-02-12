import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
} from "react-native";
import { useStallionUpdate, restart, sync } from "react-native-stallion";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

export default function StallionUpdateModal() {
    const { isRestartRequired, newReleaseBundle } = useStallionUpdate();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Force a sync check on mount
        sync();
    }, []);

    useEffect(() => {
        if (isRestartRequired) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [isRestartRequired]);

    const handleRestart = () => {
        restart();
    };

    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={styles.overlay}>
                <View style={styles.box}>
                    <View style={styles.iconCircle}>
                        <MaterialCommunityIcons name="update" size={40} color="#22c55e" />
                    </View>

                    <Text style={styles.title}>Update Available! 🚀</Text>

                    <Text style={styles.desc}>
                        {newReleaseBundle?.releaseNotes
                            ? newReleaseBundle.releaseNotes
                            : "A new version of the app is ready. Restart now to apply the latest features and fixes."}
                    </Text>

                    <TouchableOpacity style={styles.btn} onPress={handleRestart}>
                        <Text style={styles.btnText}>Restart & Update Now</Text>
                    </TouchableOpacity>

                    <Text style={styles.note}>
                        This is optimized for your device.
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    box: {
        backgroundColor: "#111827",
        width: "100%",
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#1e293b",
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#fff",
        textAlign: "center",
        marginBottom: 12,
    },
    desc: {
        fontSize: 15,
        color: "#9ca3af",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },
    btn: {
        backgroundColor: "#22c55e",
        width: "100%",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    btnText: {
        color: "#000",
        fontSize: 16,
        fontWeight: "bold",
    },
    note: {
        marginTop: 16,
        fontSize: 12,
        color: "#4b5563",
        fontStyle: "italic",
    }
});
