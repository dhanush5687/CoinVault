import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    Alert,
    ScrollView,
    Animated,
    Dimensions,
    I18nManager,
    Linking,
    Modal,
} from "react-native";
import database from "@react-native-firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo from "react-native-device-info";
import { launchImageLibrary } from "react-native-image-picker";
import { supabase } from "../config/supabase";
import { deleteAccount, updateUserProfile, signOut, syncUserActivity } from "../services/supabaseService";

import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { ADMOB_BANNER_ID } from "@env";
import { showAppOpenAd } from "../ads/AppOpenManager";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

const screenWidth = Dimensions.get("window").width;
const countries = ["India", "USA", "UK", "Canada", "Australia"];
const genders = ["Male", "Female", "Other"];

export default function ProfileScreen({ navigation }) {
    /* ================= PROFILE ================= */
    const [deviceId, setDeviceId] = useState("");
    const [name, setName] = useState("");
    const [mobile, setMobile] = useState("");
    const [upi, setUpi] = useState("");
    const [gender, setGender] = useState("Male");
    const [country, setCountry] = useState("India");
    const [image, setImage] = useState("");
    const [email, setEmail] = useState("");
    const [contactVisible, setContactVisible] = useState(false);
    const [privacyVisible, setPrivacyVisible] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(false);

    /* ================= MARQUEE ================= */
    const translateX = useRef(new Animated.Value(screenWidth)).current;
    const [messages, setMessages] = useState([]);
    const [index, setIndex] = useState(0);
    const [speed, setSpeed] = useState(12000);
    const language = I18nManager.isRTL ? "hi" : "en";

    /* ================= INIT ================= */
    useEffect(() => {
        initProfile();
        listenMarquee();
    }, []);

    // Show App Open on Focus
    useFocusEffect(
        useCallback(() => {
            showAppOpenAd();
            syncUserActivity();

            let ref;
            const check = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    ref = database().ref(`/chats/${user.id}/metadata/unreadByUser`);
                    ref.on("value", (snapshot) => {
                        setUnreadMessages(snapshot.val() === true);
                    });
                }
            };
            check();

            return () => {
                if (ref) ref.off();
            };
        }, [])
    );

    /* ================= PROFILE ================= */
    const initProfile = async () => {
        try {
            // 1. Fetch Supabase Auth User
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setEmail(user.email || "");

                // 2. Fetch Profile from Supabase
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setName(data.display_name || "");
                    setMobile(data.mobile || data.phone || "");
                    setUpi(data.upi_id || "");
                    setGender(data.gender || "Male");
                    setCountry(data.country || "India");
                    setImage(data.avatar_data || "");

                    // 3. BACKGROUND: Update Device Info & Last Active
                    updateDeviceInfo(user.id);
                }
            } else {
                // Fallback to local if no user session (rare)
                const saved = await AsyncStorage.getItem("USER_PROFILE");
                if (saved) {
                    const d = JSON.parse(saved);
                    setName(d.name || "");
                    setMobile(d.mobile || "");
                    setUpi(d.upi || "");
                    setGender(d.gender || "Male");
                    setCountry(d.country || "India");
                    setImage(d.image || "");
                }
            }
        } catch (e) {
            console.log("Profile Init Error:", e);
        }
    };

    const updateDeviceInfo = async (userId) => {
        try {
            const uniqueId = await DeviceInfo.getUniqueId();
            const model = DeviceInfo.getModel();
            const brand = DeviceInfo.getBrand();
            const systemVersion = DeviceInfo.getSystemVersion();
            let carrier = "Unknown";
            try {
                carrier = await DeviceInfo.getCarrier();
            } catch (e) { }

            // Fetch IP & Location
            let ipData = {};
            try {
                // Using ipapi.co (Free tier, strictly rate limited) or similar
                const response = await fetch('https://ipapi.co/json/');
                if (response.ok) {
                    ipData = await response.json();
                }
            } catch (e) {
                console.log("IP Fetch Error:", e);
            }

            const deviceDetails = {
                uniqueId,
                model,
                brand,
                systemVersion,
                carrier,
                ipAddress: ipData.ip || "Unknown",
                city: ipData.city || "Unknown",
                region: ipData.region || "",
                country: ipData.country_name || "",
                latitude: ipData.latitude || 0,
                longitude: ipData.longitude || 0,
                isp: ipData.org || ""
            };

            // Update Firebase
            await database().ref(`/users/${userId}`).update({
                deviceInfo: deviceDetails,
                lastActive: new Date().toISOString()
            });

        } catch (e) {
            console.log("Device Info Update Error:", e);
        }
    };

    const pickImage = () => {
        launchImageLibrary(
            { mediaType: "photo", includeBase64: true, quality: 0.6 },
            (res) => {
                if (!res.didCancel && res.assets?.length) {
                    setImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
                }
            }
        );
    };

    const saveProfile = async () => {
        if (!mobile) {
            Alert.alert("Error", "Mobile number is required");
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // 1. Save to Supabase
                const result = await updateUserProfile({
                    display_name: name,
                    mobile: mobile,
                    upi_id: upi,
                    avatar_data: image,
                    gender: gender,
                    country: country,
                });

                if (!result.success) {
                    throw new Error(result.error);
                }

                // 2. Refresh Local Profile Cache
                const profileData = {
                    name,
                    email: user.email,
                    mobile,
                    upi,
                    gender,
                    country,
                    image,
                    lastActive: new Date().toISOString()
                };
                await AsyncStorage.setItem("USER_PROFILE", JSON.stringify(profileData));

                Alert.alert(
                    "Success",
                    "Profile Updated Successfully!",
                    [{ text: "OK", onPress: () => navigation.navigate("MainTabs") }]
                );
            }
        } catch (err) {
            console.log("Save Error:", err);
            Alert.alert("Error", "Failed to save profile: " + err.message);
        }
    };

    const openFAQ = () => {
        Alert.alert("F.A.Q", "1. How to earn? \nAnswer: Complete tasks.\n\n2. When is payout? \nAnswer: Every Sunday.");
    };

    const openContact = () => {
        setContactVisible(true);
    };


    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account?",
            "Are you sure you want to delete your account? \n\nClick 'Delete Account' to permanently remove your data or 'Cancel' to keep your account and stay logged in.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Account",
                    style: "destructive",
                    onPress: async () => {
                        const res = await deleteAccount();
                        if (res.success) {
                            Alert.alert(
                                "Deleted",
                                "Your account has been deleted.",
                                [{
                                    text: "OK",
                                    onPress: () => {
                                        // Navigate to Create Account (Signup)
                                        navigation.replace("Signup");
                                    }
                                }]
                            );
                        } else {
                            Alert.alert("Note", "You might not be logged in or account already deleted.");
                            // Still navigate to Signup? 
                            navigation.replace("Signup");
                        }
                    }
                }
            ]
        );
    };

    /* ================= FIREBASE MARQUEE (FIXED) ================= */
    const listenMarquee = () => {
        // speed
        database()
            .ref("/marqueeConfig/speed")
            .on("value", (s) => {
                if (s.exists() && typeof s.val() === "number") {
                    setSpeed(s.val());
                }
            });

        // messages
        const ref = database().ref(`/marqueeMessages/${language}`);
        ref.on("value", (snap) => {
            if (!snap.exists()) {
                setMessages([]);
                return;
            }

            const data = snap.val();

            const activeMessages = Object.values(data)
                .filter(
                    (item) =>
                        item &&
                        typeof item === "object" &&
                        item.active === true
                )
                .map((item) => ({
                    text: item.text || "",
                    action: item.action || null,
                }));

            setMessages(activeMessages);
            setIndex(0);
        });

        return () => ref.off();
    };

    /* ================= MARQUEE ANIMATION ================= */
    useEffect(() => {
        if (!messages || messages.length === 0) return;

        translateX.setValue(screenWidth);

        Animated.timing(translateX, {
            toValue: -screenWidth * 1.6,
            duration: speed,
            useNativeDriver: true,
        }).start(() => {
            setIndex((prev) => (prev + 1) % messages.length);
        });
    }, [index, messages, speed]);

    const onMarqueePress = () => {
        const action = messages[index]?.action;
        if (action) navigation.navigate(action);
    };

    const logout = async () => {
        await signOut(); // Ensure Supabase signout
        await AsyncStorage.clear();
        navigation.replace("Login");
    };

    /* ================= UI ================= */
    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 150 }}>
            {/* Top Banner */}
            <View style={{ alignItems: "center", marginBottom: 10 }}>
                <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
            </View>

            {/* HEADER WITH INFO BUTTON */}
            <View style={styles.headerRow}>
                <Text style={styles.title}>Profile</Text>
                <TouchableOpacity onPress={() => setPrivacyVisible(true)} style={styles.infoBtn}>
                    <MaterialCommunityIcons name="information" size={22} color="#38bdf8" />
                </TouchableOpacity>
            </View>

            {/* 🔁 SAFE MARQUEE */}
            {messages.length > 0 && (
                <TouchableOpacity activeOpacity={0.8} onPress={onMarqueePress}>
                    <View style={styles.marquee}>
                        <Animated.Text
                            numberOfLines={1}
                            style={[styles.marqueeText, { transform: [{ translateX }] }]}
                        >
                            {messages[index]?.text}
                        </Animated.Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* IMAGE */}
            <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.image} />
                ) : (
                    <View style={{ alignItems: 'center' }}>
                        <MaterialCommunityIcons name="camera-plus" size={40} color="#9ca3af" />
                        <Text style={styles.imageText}>Pick Image</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* INPUTS */}
            <TextInput
                style={[styles.input, { opacity: 0.7 }]}
                placeholder="Email Address"
                placeholderTextColor="#777"
                value={email}
                editable={false}
            />
            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#777" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Mobile" placeholderTextColor="#777" keyboardType="number-pad" value={mobile} onChangeText={setMobile} />
            <TextInput style={styles.input} placeholder="UPI ID" placeholderTextColor="#777" value={upi} onChangeText={setUpi} />

            {/* GENDER */}
            <View style={styles.row}>
                {genders.map((g) => (
                    <TouchableOpacity key={g} onPress={() => setGender(g)}
                        style={[styles.selectBtn, { backgroundColor: gender === g ? "#22c55e" : "#1f2933" }]}>
                        <Text style={{ color: "#fff" }}>{g}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* COUNTRY */}
            <View style={styles.row}>
                {countries.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setCountry(c)}
                        style={[styles.selectBtn, { backgroundColor: country === c ? "#2563eb" : "#1f2933" }]}>
                        <Text style={{ color: "#fff" }}>{c}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                <Text style={styles.saveText}>Save Profile</Text>
            </TouchableOpacity>



            <View style={styles.row}>
                <TouchableOpacity onPress={openFAQ} style={styles.extraBtn}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="help-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.extraBtnText}>F.A.Q</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={openContact} style={styles.extraBtn}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="phone" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.extraBtnText}>Contact Us</Text>
                        {unreadMessages && (
                            <View style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: "#22c55e",
                                marginLeft: 8
                            }} />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.footerButtons}>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="logout" size={20} color="#38bdf8" style={{ marginRight: 8 }} />
                        <Text style={styles.logoutBtnText}>Logout</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleDeleteAccount} style={[styles.logout, { marginTop: 25 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                        <Text style={[styles.logoutText, { color: '#ef4444', fontSize: 13 }]}>Delete Account Permanently</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Bottom Banner */}
            <View style={{ alignItems: "center", marginTop: 20 }}>
                <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
            </View>

            {/* PRIVACY POLICY MODAL */}
            <Modal
                visible={privacyVisible}
                animationType="slide"
                onRequestClose={() => setPrivacyVisible(false)}
            >
                <View style={[styles.container, { padding: 0 }]}>
                    <View style={styles.privacyHeader}>
                        <Text style={styles.privacyTitle}>Privacy Policy</Text>
                        <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
                            <MaterialCommunityIcons name="close-circle" size={28} color="#ef4444" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.privacyContent} contentContainerStyle={{ paddingBottom: 50 }}>
                        <Text style={styles.privacySubtitle}>Last updated February 10, 2026</Text>

                        <Text style={styles.p}>
                            This Privacy Notice for <Text style={styles.bold}>Rappletech</Text> ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you download and use our mobile application (<Text style={styles.bold}>FaceVaultApp</Text>).
                        </Text>

                        <Text style={styles.h2}>1. WHAT INFORMATION DO WE COLLECT?</Text>
                        <Text style={styles.h3}>Personal information you disclose to us</Text>
                        <Text style={styles.p}>We collect personal information that you voluntarily provide to us when you register on the Services. This includes:</Text>
                        <View style={styles.ul}>
                            <Text style={styles.li}>• Names</Text>
                            <Text style={styles.li}>• Phone numbers</Text>
                            <Text style={styles.li}>• Email addresses</Text>
                        </View>

                        <Text style={styles.h3}>Application Data</Text>
                        <Text style={styles.p}>If you use our application(s), we also may collect:</Text>
                        <View style={styles.ul}>
                            <Text style={styles.li}>• <Text style={styles.bold}>Mobile Device Data:</Text> ID, model, manufacturer, OS version, and IP address.</Text>
                            <Text style={styles.li}>• <Text style={styles.bold}>Location Data:</Text> Information about your device's location (precise or imprecise) to provide location-based services.</Text>
                        </View>

                        <Text style={styles.h2}>2. HOW DO WE PROCESS YOUR INFORMATION?</Text>
                        <Text style={styles.p}>We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. Purposes include:</Text>
                        <View style={styles.ul}>
                            <Text style={styles.li}>• Account creation and management</Text>
                            <Text style={styles.li}>• Delivery of targeted advertising</Text>
                            <Text style={styles.li}>• Identifying usage trends</Text>
                            <Text style={styles.li}>• Marketing campaigns effectiveness</Text>
                        </View>

                        <Text style={styles.h2}>3. SHARING INFORMATION</Text>
                        <Text style={styles.p}>We may share information in specific situations, such as:</Text>
                        <View style={styles.ul}>
                            <Text style={styles.li}>• <Text style={styles.bold}>Business Transfers:</Text> In connection with any merger, sale of company assets, financing, or acquisition.</Text>
                        </View>

                        <Text style={styles.h2}>4. THIRD-PARTY WEBSITES</Text>
                        <Text style={styles.p}>We are not responsible for the safety of any information that you share with third parties that we may link to or who advertise on our Services, but are not affiliated with our Services.</Text>

                        <Text style={styles.h2}>5. COOKIES & TRACKING</Text>
                        <Text style={styles.p}>We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information.</Text>

                        <Text style={styles.h2}>6. HOW LONG DO WE KEEP YOUR INFORMATION?</Text>
                        <Text style={styles.p}>We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</Text>

                        <Text style={styles.h2}>7. DATA SAFETY</Text>
                        <Text style={styles.p}>We aim to protect your personal information through a system of organizational and technical security measures.</Text>

                        <Text style={styles.h2}>8. CONTACT US</Text>
                        <Text style={styles.p}>If you have questions or comments about this notice, you may email us or contact us by post.</Text>
                        <Text style={[styles.p, { marginBottom: 40 }]}>Email: coinvault.app@gmail.com</Text>

                    </ScrollView>
                </View>
            </Modal>

            {/* Contact Us Modal */}
            <Modal
                transparent
                visible={contactVisible}
                animationType="fade"
                onRequestClose={() => setContactVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Contact Us</Text>
                        <Text style={[styles.detail, { marginBottom: 20, textAlign: 'center' }]}>
                            How would you like to reach our support team?
                        </Text>

                        <TouchableOpacity
                            style={[styles.modalOption, { backgroundColor: "#2563eb" }]}
                            onPress={() => {
                                setContactVisible(false);
                                navigation.navigate("Chat");
                            }}
                        >
                            <MaterialCommunityIcons name="chat-processing" size={20} color="#fff" />
                            <Text style={styles.modalOptionText}>Support Chat (Admin)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalOption, { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" }]}
                            onPress={() => {
                                setContactVisible(false);
                                Linking.openURL("mailto:coinvault.app@gmail.com");
                            }}
                        >
                            <MaterialCommunityIcons name="email" size={20} color="#fff" />
                            <Text style={styles.modalOptionText}>Email Us</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalOption, { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" }]}
                            onPress={() => {
                                setContactVisible(false);
                                Linking.openURL("http://t.me/Coinvault_sbot");
                            }}
                        >
                            <MaterialCommunityIcons name="telegram" size={20} color="#fff" />
                            <Text style={styles.modalOptionText}>Telegram Bot</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancel}
                            onPress={() => setContactVisible(false)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0f1f", padding: 15 },
    title: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },

    marquee: {
        height: 40,
        backgroundColor: "#020617",
        borderRadius: 8,
        overflow: "hidden",
        justifyContent: "center",
        marginVertical: 12,
    },
    marqueeText: {
        position: "absolute",
        color: "#facc15",
        fontSize: 15,
        fontWeight: "600",
        paddingHorizontal: 10,
    },

    imageBox: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: "#1f2933",
        alignSelf: "center",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#22c55e",
        marginBottom: 20,
    },
    image: { width: 130, height: 130, borderRadius: 65 },
    imageText: { color: "#9ca3af" },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20
    },
    modalContent: {
        backgroundColor: "#1e293b",
        width: "90%",
        borderRadius: 20,
        padding: 25,
        borderWidth: 1,
        borderColor: "#334155",
        alignItems: 'center'
    },
    modalTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 10
    },
    modalOption: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        gap: 12
    },
    modalOptionText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600"
    },
    modalCancel: {
        marginTop: 10,
        padding: 10,
        width: '100%',
        alignItems: 'center'
    },
    modalCancelText: {
        color: "#ef4444",
        fontSize: 16,
        fontWeight: "bold"
    },

    input: {
        backgroundColor: "#020617",
        color: "#fff",
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
    },

    row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10 },
    selectBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 6 },

    saveBtn: {
        backgroundColor: "#22c55e",
        padding: 14,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 20,
    },
    saveText: { color: "#000", fontWeight: "700" },

    extraBtn: {
        backgroundColor: "#1f2933",
        padding: 12,
        borderRadius: 10,
        flex: 0.48,
        alignItems: "center",
        marginTop: 10,
    },
    extraBtnText: { color: "#fff", fontWeight: "600" },

    logout: { alignItems: "center" },
    logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },

    footerButtons: {
        marginTop: 50,
        width: '100%',
        alignItems: 'center',
    },
    logoutBtn: {
        backgroundColor: '#1e293b',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#334155',
        width: '80%',
        alignItems: 'center',
    },
    logoutBtnText: {
        color: '#38bdf8',
        fontSize: 16,
        fontWeight: '700',
    },

    // Header Row
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        position: 'relative'
    },
    infoBtn: {
        position: 'absolute',
        right: 10,
        padding: 5
    },

    // Privacy Modal
    privacyHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 15,
        backgroundColor: "#1e293b",
        borderBottomWidth: 1,
        borderBottomColor: "#334155",
        marginTop: 40 // Safe area
    },
    privacyTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#fff"
    },
    privacyContent: {
        flex: 1,
        padding: 20
    },
    privacySubtitle: {
        color: "#9ca3af",
        textAlign: "center",
        marginBottom: 20,
        fontStyle: "italic"
    },
    h2: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 20,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#334155",
        paddingBottom: 5
    },
    h3: {
        color: "#e2e8f0",
        fontSize: 16,
        fontWeight: "600",
        marginTop: 15,
        marginBottom: 5
    },
    p: {
        color: "#cbd5e1",
        lineHeight: 22,
        marginBottom: 10,
        fontSize: 14
    },
    bold: {
        fontWeight: "bold",
        color: "#fff"
    },
    ul: {
        paddingLeft: 10,
        marginBottom: 10
    },
    li: {
        color: "#cbd5e1",
        lineHeight: 24,
        fontSize: 14
    }
});
