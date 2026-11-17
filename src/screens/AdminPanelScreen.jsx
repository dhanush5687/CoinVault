import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    TextInput,
    Switch,
    Modal,
    ScrollView,
    BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import database from "@react-native-firebase/database";
import Clipboard from "@react-native-clipboard/clipboard";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { supabase } from "../config/supabase";
import { getQuizConfig, saveQuizConfig, fetchQuestionsFromApi } from "../services/quizService";

export default function AdminPanelScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState("Pending");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal States
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalValue, setModalValue] = useState("");
    const [currentEditItem, setCurrentEditItem] = useState(null);
    const [modalType, setModalType] = useState(""); // "coins" or "message" or "addMessage"
    const [selectedChatUser, setSelectedChatUser] = useState(null);

    // Quiz Controller States (Admin)
    const [quizApiUrl, setQuizApiUrl] = useState("");
    const [quizUseApi, setQuizUseApi] = useState(false);
    const [quizRewardPoints, setQuizRewardPoints] = useState("1");
    const [quizPenaltyPoints, setQuizPenaltyPoints] = useState("1");
    const [quizTesting, setQuizTesting] = useState(false);
    const [quizSaving, setQuizSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    // 🛡️ Hardware Back Button Handler for Admin
    useEffect(() => {
        const onBackPress = () => {
            if (modalVisible) {
                setModalVisible(false);
                return true;
            }
            if (activeTab !== "Pending") {
                setActiveTab("Pending");
                return true;
            }
            Alert.alert(
                "Exit Admin Panel",
                "Do you want to log out or exit the app?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Logout",
                        style: "destructive",
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: "Login" }],
                            });
                        },
                    },
                    {
                        text: "Exit App",
                        onPress: () => BackHandler.exitApp(),
                    },
                ]
            );
            return true;
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => subscription.remove();
    }, [modalVisible, activeTab]);

    const handleChatWithUser = (userItem) => {
        const targetUserName = userItem.full_name || userItem.name || userItem.mobile || userItem.email || "User";
        navigation.navigate("AdminChat", {
            userId: userItem.id,
            userName: targetUserName,
        });
    };

    const copyToClipboard = (text, label) => {
        Clipboard.setString(text);
        Alert.alert("Copied", `${label} copied to clipboard!`);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === "Quiz") {
                const config = await getQuizConfig();
                setQuizApiUrl(config.apiUrl || "");
                setQuizUseApi(!!config.useApi);
                setQuizRewardPoints(String(typeof config.rewardPoints === "number" ? config.rewardPoints : 1));
                setQuizPenaltyPoints(String(typeof config.penaltyPoints === "number" ? config.penaltyPoints : 1));
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (activeTab === "Users") {
                const usersSnap = await database().ref("/users").once("value");
                const walletsSnap = await database().ref("/wallets").once("value");

                if (usersSnap.exists()) {
                    const usersObj = usersSnap.val();
                    const walletsObj = walletsSnap.exists() ? walletsSnap.val() : {};

                    const usersList = Object.keys(usersObj).map((key) => {
                        const val = usersObj[key];
                        const walletData = walletsObj[key] || {};
                        return {
                            id: key,
                            ... (typeof val === 'object' ? val : { rawData: val }),
                            walletBalance: walletData.balance || 0
                        };
                    });
                    setData(usersList);
                } else {
                    setData([]);
                }
            } else if (activeTab === "Chats") {
                const snapshot = await database().ref("/chats").once("value");
                if (snapshot.exists()) {
                    const chatsObj = snapshot.val();
                    const chatList = Object.keys(chatsObj).map(userId => ({
                        id: userId,
                        ...chatsObj[userId].metadata
                    })).sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
                    setData(chatList);
                } else {
                    setData([]);
                }
            } else if (activeTab === "Messages") {
                const snapshot = await database().ref("/marqueeMessages/en").once("value");
                if (snapshot.exists()) {
                    const msgObj = snapshot.val();
                    const msgList = Object.keys(msgObj).map((key) => {
                        const val = msgObj[key];
                        if (typeof val === 'string') {
                            return { id: key, text: val, active: true };
                        }
                        return {
                            id: key,
                            text: val.text || "",
                            active: val.active !== false,
                            ...val
                        };
                    });
                    setData(msgList);
                } else {
                    setData([]);
                }
            } else {
                const snapshot = await database().ref("/withdraw_requests").once("value");
                const walletsSnap = await database().ref("/wallets").once("value");
                const usersSnap = await database().ref("/users").once("value");

                const walletsObj = walletsSnap.exists() ? walletsSnap.val() : {};
                const usersObj = usersSnap.exists() ? usersSnap.val() : {};

                // Create a mobile -> deviceId map for fallback
                const mobileToId = {};
                Object.keys(usersObj).forEach(id => {
                    const u = usersObj[id];
                    if (u.mobile) mobileToId[u.mobile] = id;
                });

                if (snapshot.exists()) {
                    const withdrawObj = snapshot.val();
                    const withdrawList = Object.keys(withdrawObj)
                        .map((key) => {
                            const req = withdrawObj[key];

                            // 1. Try match by deviceId or UUID
                            let balance = 0;
                            let userImage = null;
                            let foundUser = null;

                            if (req.deviceId && usersObj[req.deviceId]) {
                                foundUser = usersObj[req.deviceId];
                            } else if (req.mobile && mobileToId[req.mobile]) {
                                const matchedId = mobileToId[req.mobile];
                                foundUser = usersObj[matchedId];
                            }

                            if (foundUser) {
                                userImage = foundUser.image || foundUser.avatar || null;
                                // Get balance from matched wallet
                                const walletId = req.deviceId || mobileToId[req.mobile];
                                balance = walletsObj[walletId]?.balance || 0;
                            }

                            return {
                                id: key,
                                ...req,
                                userCurrentBalance: balance,
                                userImage: userImage || foundUser?.image || null
                            };
                        })
                        .filter((item) => item.status === activeTab);

                    withdrawList.sort((a, b) => new Date(b.date) - new Date(a.date));
                    setData(withdrawList);
                } else {
                    setData([]);
                }
            }
        } catch (error) {
            console.error("❌ Fetch Error:", error);
            Alert.alert("Error", "Failed to fetch data: " + error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleOpenModal = (type, title, initialValue, item = null) => {
        setModalType(type);
        setModalTitle(title);
        setModalValue(initialValue.toString());
        setCurrentEditItem(item);
        setModalVisible(true);
    };

    const handleModalSubmit = async () => {
        if (!modalValue.trim()) {
            Alert.alert("Error", "Value cannot be empty");
            return;
        }

        try {
            if (modalType === "coins") {
                const newCoins = parseInt(modalValue);
                if (isNaN(newCoins)) {
                    Alert.alert("Error", "Please enter a valid number");
                    return;
                }
                // 1. Update Firebase (for Admin Dashboard)
                await database().ref(`/wallets/${currentEditItem.id}`).update({
                    balance: newCoins,
                    lastUpdated: Date.now()
                });

                // 2. Update Supabase (only if ID is a valid UUID)
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentEditItem.id);
                if (isUUID) {
                    const { error: supErr } = await supabase
                        .from("profiles")
                        .update({ wallet_balance: newCoins })
                        .eq("id", currentEditItem.id);

                    if (supErr) {
                        console.error("Supabase Coin Sync Error:", supErr.message);
                    }
                } else {
                    console.log("Skipping Supabase Sync: Not a valid UUID");
                }

                Alert.alert("Success", "Coins updated");
            } else if (modalType === "addMessage") {
                const newMsgRef = database().ref("/marqueeMessages/en").push();
                await newMsgRef.set({
                    text: modalValue,
                    active: true,
                    action: null
                });
                Alert.alert("Success", "Message added");
            } else if (modalType === "editMessage") {
                await database().ref(`/marqueeMessages/en/${currentEditItem.id}`).update({
                    text: modalValue
                });
                Alert.alert("Success", "Message updated");
            } else if (modalType === "utr") {
                // Mark as Paid with UTR
                await database().ref(`/withdraw_requests/${currentEditItem.id}`).update({ 
                    status: "Paid", 
                    utrId: modalValue,
                    paidAt: new Date().toISOString() 
                });

                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentEditItem.id);
                if (isUUID) {
                    await supabase
                        .from("wallet_transactions")
                        .update({ 
                            metadata: { 
                                ...currentEditItem, 
                                userCurrentBalance: undefined, 
                                status: "Paid",
                                utrId: modalValue,
                                paidAt: new Date().toISOString()
                            } 
                        })
                        .eq("id", currentEditItem.id);
                }
                Alert.alert("Success", "Request marked as Paid with UTR");
            } else if (modalType === "reject") {
                // Mark as Refunded with Reason (Wrong Details)
                const statusUpdate = "Refunded";
                const reasonDetail = modalValue;
                const targetUserId = currentEditItem.userId;
                const refundAmount = parseInt(currentEditItem.coins || 0);

                if (!targetUserId) {
                    Alert.alert("Error", "User ID not found in request");
                    return;
                }

                // 1. Update Request Status in Firebase
                await database().ref(`/withdraw_requests/${currentEditItem.id}`).update({
                    status: statusUpdate,
                    rejectReason: reasonDetail
                });

                // 2. Refund Coins in Firebase Wallet
                const walletRef = database().ref(`/wallets/${targetUserId}`);
                const walletSnap = await walletRef.once("value");
                let currentBalance = 0;
                if (walletSnap.exists()) {
                    currentBalance = parseInt(walletSnap.val().balance || 0);
                }
                const newBalance = currentBalance + refundAmount;
                await walletRef.update({
                    balance: newBalance,
                    lastUpdated: Date.now()
                });

                // 3. Sync to Supabase
                const isUUIDUser = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
                if (isUUIDUser) {
                    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", targetUserId);
                    await supabase.from("wallet_transactions").insert([{
                        user_id: targetUserId,
                        transaction_type: "Refund",
                        amount: refundAmount,
                        balance_after: newBalance,
                        description: `Refund: ${reasonDetail} (Req #${currentEditItem.id.slice(0, 6)})`,
                        metadata: { originalId: currentEditItem.id, reason: reasonDetail }
                    }]);

                    await supabase.from("wallet_transactions")
                        .update({
                            metadata: {
                                ...currentEditItem,
                                userCurrentBalance: undefined,
                                status: statusUpdate,
                                paidAt: undefined,
                                utrId: undefined,
                                rejectReason: reasonDetail
                            }
                        })
                        .eq("id", currentEditItem.id);
                }
                Alert.alert("Success", "Request rejected and coins refunded");
            }

            setModalVisible(false);
            fetchData();
        } catch (e) {
            Alert.alert("Error", "Operation failed: " + e.message);
        }
    };

    const handleMarkAsPaid = (item) => {
        handleOpenModal("utr", "Enter UTR ID", "", item);
    };

    const handleMarkWrongDetails = (item) => {
        handleOpenModal("reject", "Rejection Reason", "Invalid Details", item);
    };

    const handleDeleteRequest = (item) => {
        Alert.alert("Delete Request", "Remove this withdrawal record?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await database().ref(`/withdraw_requests/${item.id}`).remove();
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Delete failed");
                    }
                }
            }
        ]);
    };

    const handleDeleteUser = (user) => {
        Alert.alert("Ban/Delete User", `Delete ${user.name || 'this user'} permanently?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete permanently",
                style: "destructive",
                onPress: async () => {
                    try {
                        setLoading(true);
                        // 1. Delete from Firebase
                        await database().ref(`/users/${user.id}`).remove();
                        await database().ref(`/wallets/${user.id}`).remove();

                        // 2. Delete from Supabase tables
                        const { error: pErr } = await supabase.from('profiles').delete().eq('id', user.id);
                        const { error: aErr } = await supabase.from('admin_user_data').delete().eq('user_id', user.id);

                        if (pErr || aErr) console.warn("Supabase data cleanup error:", pErr?.message || aErr?.message);

                        Alert.alert("Success", "User data removed from dashboard. Note: Auth record requires dashboard deletion.");
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Delete failed: " + e.message);
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    const getStatusColor = (lastActive) => {
        if (!lastActive) return "#ef4444"; // Red (Never joined/Old)
        const last = new Date(lastActive).getTime();
        const now = Date.now();
        const diff = now - last;

        if (diff < 24 * 60 * 60 * 1000) return "#22c55e"; // Green (<24h)
        if (diff < 7 * 24 * 60 * 60 * 1000) return "#f97316"; // Orange (<7d)
        return "#ef4444"; // Red (>7d)
    };

    const toggleMessageStatus = async (item) => {
        try {
            await database().ref(`/marqueeMessages/en/${item.id}`).update({ active: !item.active });
            fetchData();
        } catch (e) {
            Alert.alert("Error", "Toggle failed");
        }
    };

    const deleteMessage = (item) => {
        Alert.alert("Delete Message", "Delete this marquee message?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await database().ref(`/marqueeMessages/en/${item.id}`).remove();
                        fetchData();
                    } catch (e) {
                        Alert.alert("Error", "Delete failed");
                    }
                }
            }
        ]);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleSaveQuizConfig = async () => {
        setQuizSaving(true);
        const res = await saveQuizConfig({
            apiUrl: quizApiUrl.trim(),
            useApi: quizUseApi,
            rewardPoints: parseInt(quizRewardPoints, 10) || 1,
            penaltyPoints: parseInt(quizPenaltyPoints, 10) || 1,
        });
        setQuizSaving(false);
        if (res.success) {
            Alert.alert("Success 🎉", "Quiz settings and points saved to Firebase! Users will see updates immediately.");
        } else {
            Alert.alert("Error", "Failed to save quiz settings: " + res.error);
        }
    };

    const handleTestQuizApi = async () => {
        if (!quizApiUrl || !quizApiUrl.trim()) {
            Alert.alert("Missing API URL", "Please enter an API URL before testing.");
            return;
        }
        setQuizTesting(true);
        const questions = await fetchQuestionsFromApi(quizApiUrl.trim());
        setQuizTesting(false);
        if (questions && questions.length > 0) {
            Alert.alert(
                "API Test Successful! 🎉",
                `Successfully fetched ${questions.length} questions!\n\nSample Q: "${questions[0].question}"\nOptions: ${questions[0].options.join(", ")}`
            );
        } else {
            Alert.alert(
                "API Test Failed",
                "Could not fetch or parse questions from this URL. Please verify the URL and network connection."
            );
        }
    };

    const handlePreFillOpenTDB = () => {
        setQuizApiUrl("https://opentdb.com/api.php?amount=10&category=17&type=multiple");
        setQuizUseApi(true);
    };

    const handleResetQuizDefaults = () => {
        setQuizApiUrl("");
        setQuizUseApi(false);
        setQuizRewardPoints("1");
        setQuizPenaltyPoints("1");
    };

    const renderWithdrawItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardRow}>
                <View style={styles.userInfoMinimal}>
                    <View style={styles.avatarContainer}>
                        {item.userImage ? (
                            <Image source={{ uri: item.userImage }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitials}>
                                    {((item.name || "U")[0] || "U").toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.userTextInfo}>
                        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.balanceTagSmall}>
                            <Text style={styles.remainingText}>Wallet: {item.userCurrentBalance} 🪙</Text>
                        </View>
                    </View>
                </View>
                <Text style={styles.amount}>₹{item.rupees}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoLine}>
                <Text style={styles.detail}>Mobile: {item.mobile}</Text>
                <TouchableOpacity onPress={() => copyToClipboard(item.mobile, "Mobile Number")}>
                    <Text style={styles.copyLabel}>Copy</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.infoLine}>
                <Text style={styles.detail}>UPI: {item.upi}</Text>
                <TouchableOpacity onPress={() => copyToClipboard(item.upi, "UPI ID")}>
                    <Text style={styles.copyLabel}>Copy</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.detail}>Requested: {item.coins} Coins</Text>
            <Text style={styles.date}>{item.date}</Text>

            <View style={styles.actionRow}>
                {item.status === "Pending" && (
                    <>
                        <TouchableOpacity style={styles.paidBtn} onPress={() => handleMarkAsPaid(item)}>
                            <Text style={styles.btnText}>Mark Paid</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleMarkWrongDetails(item)}>
                            <Text style={styles.btnText}>Wrong Details</Text>
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteRequest(item)}>
                    <Text style={styles.btnText}>Delete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderUserItem = ({ item }) => (
        <View style={styles.card}>
            {/* 1. Header: Left Avatar + Name/Email (flex: 1), Right: Clean Balance Badge */}
            <View style={styles.cardRow}>
                <TouchableOpacity
                    style={styles.userInfoMinimal}
                    activeOpacity={0.7}
                    onPress={() => handleChatWithUser(item)}
                >
                    <View style={styles.avatarContainer}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitials}>
                                    {((item.full_name || item.name || item.email || "U")[0] || "U").toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.lastActive || item.lastLogin) }]} />
                    </View>
                    <View style={styles.userTextInfo}>
                        <Text style={styles.name} numberOfLines={1}>{item.full_name || item.name || "No Name"}</Text>
                        <Text style={styles.detail} numberOfLines={1}>{item.email || "N/A"}</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.balanceTag}
                    activeOpacity={0.8}
                    onPress={() => handleOpenModal("coins", "Edit Coins", item.walletBalance, item)}
                >
                    <Text style={styles.walletBalanceText}>{item.walletBalance || 0} 🪙</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* 2. Info lines with consistent Copy badges */}
            <View style={styles.infoLine}>
                <Text style={styles.detail}>📱 Mobile: {item.mobile || "N/A"}</Text>
                {item.mobile ? (
                    <TouchableOpacity onPress={() => copyToClipboard(item.mobile, "Mobile Number")}>
                        <Text style={styles.copyLabel}>Copy</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.infoLine}>
                <Text style={styles.detail}>💰 UPI: {item.upi || "N/A"}</Text>
                {item.upi ? (
                    <TouchableOpacity onPress={() => copyToClipboard(item.upi, "UPI ID")}>
                        <Text style={styles.copyLabel}>Copy</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.infoLine}>
                <Text style={[styles.detail, { flex: 1, marginRight: 8 }]} numberOfLines={1}>🆔 ID: {item.id}</Text>
                <TouchableOpacity onPress={() => copyToClipboard(item.id, "User ID")}>
                    <Text style={styles.copyLabel}>Copy</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>Device Info:</Text>
            {item.deviceInfo ? (
                <View style={styles.deviceBox}>
                    <Text style={styles.deviceText}>IP: {item.deviceInfo.ipAddress || "N/A"}</Text>
                    <Text style={styles.deviceText}>Location: {item.deviceInfo.city || "N/A"} ({item.deviceInfo.latitude || "0"}, {item.deviceInfo.longitude || "0"})</Text>
                    <Text style={styles.deviceText}>Model: {item.deviceInfo.model || "N/A"}</Text>
                    <Text style={styles.deviceText}>Brand: {item.deviceInfo.brand || "N/A"}</Text>
                    <Text style={styles.deviceText}>OS: {item.deviceInfo.systemVersion || "N/A"}</Text>
                    <Text style={styles.deviceText}>Carrier: {item.deviceInfo.carrier || "N/A"}</Text>
                </View>
            ) : (
                <View style={styles.deviceBox}>
                    <Text style={styles.deviceText}>No detailed info (Update Required)</Text>
                </View>
            )}

            <Text style={styles.date}>Last Active: {item.lastActive || item.lastLogin || "N/A"}</Text>

            <View style={styles.divider} />

            {/* 3. Balanced Action Row: Direct Message + Edit Coins + Delete (No Overflow) */}
            <View style={styles.userCardActionRow}>
                <TouchableOpacity
                    style={styles.chatUserBtn}
                    onPress={() => handleChatWithUser(item)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="chat-processing-outline" size={17} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.chatUserBtnText}>Direct Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.editCoinsBtn}
                    onPress={() => handleOpenModal("coins", "Edit Coins", item.walletBalance, item)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.editCoinsBtnText}>🪙 Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deleteUserBtn}
                    onPress={() => handleDeleteUser(item)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" style={{ marginRight: 4 }} />
                    <Text style={styles.deleteUserBtnText}>Del</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderMessageItem = ({ item }) => (
        <View style={styles.card}>
            <Text style={styles.name}>{item.text}</Text>
            <View style={styles.divider} />
            <View style={styles.actionRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={[styles.detail, { marginRight: 10 }]}>Active:</Text>
                    <Switch
                        value={item.active}
                        onValueChange={() => toggleMessageStatus(item)}
                        trackColor={{ false: "#334155", true: "#22c55e" }}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.paidBtn, { flex: 0, paddingHorizontal: 15 }]}
                    onPress={() => handleOpenModal("editMessage", "Edit Message", item.text, item)}
                >
                    <Text style={styles.btnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.deleteBtn, { flex: 0, paddingHorizontal: 15 }]} onPress={() => deleteMessage(item)}>
                    <Text style={styles.btnText}>Del</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderChatItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("AdminChat", { userId: item.id, userName: item.userName })}
        >
            <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.userName || "Unknown User"}</Text>
                    <Text style={[styles.detail, { marginTop: 4 }]} numberOfLines={1}>
                        {item.lastMessage || "No messages yet"}
                    </Text>
                </View>
                {item.unreadByAdmin && (
                    <View style={styles.unreadBadge} />
                )}
            </View>
            <Text style={styles.date}>
                {item.lastTimestamp ? new Date(item.lastTimestamp).toLocaleString() : ""}
            </Text>
        </TouchableOpacity>
    );

    const renderQuizSettings = () => (
        <ScrollView style={styles.quizSettingsContainer} contentContainerStyle={{ padding: 15 }}>
            <View style={styles.quizHeaderCard}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={styles.quizHeaderTitle}>Quiz & Points Controller</Text>
                    <View style={[styles.apiStatusBadge, { backgroundColor: quizUseApi ? "#14532d" : "#1e3a8a" }]}>
                        <Text style={[styles.apiStatusText, { color: quizUseApi ? "#4ade80" : "#60a5fa" }]}>
                            {quizUseApi ? "● API Mode Active" : "● Default Mode Active"}
                        </Text>
                    </View>
                </View>
                <Text style={styles.quizHeaderSub}>
                    Control whether questions load dynamically from an API or show default biology questions, and customize points for correct/wrong answers.
                </Text>
            </View>

            {/* API SETTINGS */}
            <View style={styles.quizSectionCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Text style={styles.quizSectionTitle}>1. Questions API Configuration</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ color: "#94a3b8", fontSize: 13, marginRight: 8 }}>Enable API</Text>
                        <Switch
                            value={quizUseApi}
                            onValueChange={setQuizUseApi}
                            trackColor={{ false: "#334155", true: "#22c55e" }}
                        />
                    </View>
                </View>

                <Text style={styles.inputLabel}>Questions API URL (OpenTDB or Custom JSON)</Text>
                <TextInput
                    style={styles.quizTextInput}
                    placeholder="e.g. https://opentdb.com/api.php?amount=10&category=17&type=multiple"
                    placeholderTextColor="#64748b"
                    value={quizApiUrl}
                    onChangeText={setQuizApiUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                <View style={styles.apiBtnRow}>
                    <TouchableOpacity style={styles.testApiBtn} onPress={handleTestQuizApi} disabled={quizTesting}>
                        {quizTesting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.btnText}>🧪 Test API Endpoint</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.prefillBtn} onPress={handlePreFillOpenTDB}>
                        <Text style={styles.btnText}>⚡ Load Biology API</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.helperText}>
                    💡 If API is disabled or fails to connect, the app seamlessly serves default curated biology questions.
                </Text>
            </View>

            {/* POINTS CONFIGURATION */}
            <View style={styles.quizSectionCard}>
                <Text style={styles.quizSectionTitle}>2. Points & Reward Controls</Text>
                
                <View style={styles.pointsRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.inputLabel}>Points on Correct (+)</Text>
                        <TextInput
                            style={styles.quizTextInput}
                            keyboardType="number-pad"
                            value={quizRewardPoints}
                            onChangeText={setQuizRewardPoints}
                            placeholder="1"
                            placeholderTextColor="#64748b"
                        />
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.inputLabel}>Penalty on Wrong (-)</Text>
                        <TextInput
                            style={styles.quizTextInput}
                            keyboardType="number-pad"
                            value={quizPenaltyPoints}
                            onChangeText={setQuizPenaltyPoints}
                            placeholder="1"
                            placeholderTextColor="#64748b"
                        />
                    </View>
                </View>
                <Text style={styles.helperText}>
                    💡 Each correct answer adds this amount to the user's wallet. Wrong answers deduct the penalty.
                </Text>
            </View>

            {/* ACTIONS */}
            <TouchableOpacity style={styles.saveQuizBtn} onPress={handleSaveQuizConfig} disabled={quizSaving}>
                {quizSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.saveQuizBtnText}>💾 Save & Publish Quiz Controls</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetQuizBtn} onPress={handleResetQuizDefaults}>
                <Text style={styles.resetQuizBtnText}>↺ Reset to Default Settings</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
        </ScrollView>
    );

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Admin Panel</Text>
                    <Text style={styles.headerSub}>Firebase Management Console</Text>
                </View>
                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })}
                    activeOpacity={0.7}
                >
                    <Text style={styles.logout}>Logout</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabBarContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabBarScroll}
                >
                    {["Pending", "Paid", "Users", "Messages", "Chats", "Quiz"].map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onPress={() => setActiveTab(tab)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {activeTab === "Messages" && (
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => handleOpenModal("addMessage", "Add New Message", "")}
                >
                    <Text style={styles.addBtnText}>+ Add New Message</Text>
                </TouchableOpacity>
            )}

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            ) : activeTab === "Quiz" ? (
                renderQuizSettings()
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={
                        activeTab === "Users" ? renderUserItem :
                            activeTab === "Messages" ? renderMessageItem :
                                activeTab === "Chats" ? renderChatItem :
                                    renderWithdrawItem
                    }
                    ListEmptyComponent={<Text style={styles.empty}>No {activeTab} data found</Text>}
                    contentContainerStyle={{ padding: 15 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}

            {/* CROSS-PLATFORM INPUT MODAL */}
            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{modalTitle}</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Enter value..."
                            placeholderTextColor="#64748b"
                            value={modalValue}
                            onChangeText={setModalValue}
                            keyboardType={modalType === "coins" ? "numeric" : "default"}
                            multiline={modalType !== "coins"}
                            autoFocus={true}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSubmit} onPress={handleModalSubmit}>
                                <Text style={styles.modalBtnText}>Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0f1f" },
    header: {
        paddingTop: 14,
        paddingBottom: 14,
        paddingHorizontal: 16,
        backgroundColor: "#1e293b",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#334155",
    },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
    headerSub: { color: "#64748b", fontSize: 11, marginTop: 1 },
    logoutBtn: {
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(239, 68, 68, 0.3)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    logout: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

    tabBarContainer: {
        backgroundColor: "#111827",
        borderBottomWidth: 1,
        borderBottomColor: "#1e293b",
        paddingVertical: 8,
    },
    tabBarScroll: {
        paddingHorizontal: 12,
        gap: 8,
        flexDirection: "row",
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
        backgroundColor: "#1e293b",
    },
    activeTab: {
        backgroundColor: "#2563eb",
    },
    tabText: {
        color: "#94a3b8",
        fontWeight: "600",
        fontSize: 13,
    },
    activeTabText: {
        color: "#fff",
        fontWeight: "bold",
    },

    loader: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { color: "#94a3b8", textAlign: "center", marginTop: 50 },

    addBtn: { backgroundColor: "#2563eb", margin: 15, padding: 12, borderRadius: 10, alignItems: "center" },
    addBtnText: { color: "#fff", fontWeight: "bold" },

    card: {
        backgroundColor: "#1e293b",
        padding: 15,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#334155",
    },
    cardRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    userInfoMinimal: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginRight: 10,
    },
    avatarContainer: {
        position: "relative",
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        backgroundColor: "#334155",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarInitials: {
        color: "#94a3b8",
        fontSize: 18,
        fontWeight: "bold",
    },
    userTextInfo: {
        flex: 1,
        justifyContent: "center",
    },
    balanceTag: {
        backgroundColor: "#064e3b",
        borderWidth: 1,
        borderColor: "#10b981",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    balanceTagSmall: {
        backgroundColor: "#1e3a8a",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginTop: 4,
        alignSelf: "flex-start",
    },
    walletBalanceText: {
        color: "#34d399",
        fontWeight: "bold",
        fontSize: 14,
    },
    divider: { height: 1, backgroundColor: "#334155", marginVertical: 12 },
    sectionLabel: { color: "#38bdf8", fontSize: 12, fontWeight: "700", marginBottom: 5, textTransform: "uppercase" },
    deviceBox: { backgroundColor: "#0f172a", padding: 10, borderRadius: 8, marginBottom: 10 },
    deviceText: { color: "#94a3b8", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
    name: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    amount: { color: "#4ade80", fontSize: 18, fontWeight: "bold" },
    detail: { color: "#94a3b8", fontSize: 14 },
    infoLine: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
    },
    copyLabel: {
        color: "#38bdf8",
        fontSize: 11,
        fontWeight: "bold",
        textTransform: "uppercase",
        backgroundColor: "#0f172a",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#1e3a8a",
    },
    remainingText: {
        color: "#facc15",
        fontSize: 12,
        fontWeight: "600",
        marginTop: 2,
    },
    date: { color: "#64748b", fontSize: 12, marginTop: 8 },
    userCardActionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
    },
    chatUserBtn: {
        flex: 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563eb",
        paddingVertical: 10,
        borderRadius: 8,
    },
    chatUserBtnText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 13,
    },
    editCoinsBtn: {
        flex: 1.2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "#f59e0b",
        paddingVertical: 10,
        borderRadius: 8,
    },
    editCoinsBtnText: {
        color: "#f59e0b",
        fontWeight: "bold",
        fontSize: 13,
    },
    deleteUserBtn: {
        flex: 0.9,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#450a0a",
        borderWidth: 1,
        borderColor: "#ef4444",
        paddingVertical: 10,
        borderRadius: 8,
    },
    deleteUserBtnText: {
        color: "#ef4444",
        fontWeight: "bold",
        fontSize: 13,
    },

    actionRow: { flexDirection: "row", marginTop: 15, gap: 10, alignItems: 'center' },
    paidBtn: { flex: 1, backgroundColor: "#22c55e", padding: 10, borderRadius: 8, alignItems: "center" },
    rejectBtn: { flex: 1, backgroundColor: "#f97316", padding: 10, borderRadius: 8, alignItems: "center" },
    deleteBtn: { flex: 1, backgroundColor: "#ef4444", padding: 10, borderRadius: 8, alignItems: "center" },
    btnText: { color: "#fff", fontWeight: "bold" },

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
        width: "100%",
        borderRadius: 15,
        padding: 20,
        borderWidth: 1,
        borderColor: "#334155"
    },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 15 },
    modalInput: {
        backgroundColor: "#0f172a",
        color: "#fff",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
        textAlignVertical: "top"
    },
    modalButtons: { flexDirection: "row", gap: 10 },
    modalCancel: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center", backgroundColor: "#334155" },
    modalSubmit: { flex: 2, padding: 12, borderRadius: 8, alignItems: "center", backgroundColor: "#2563eb" },
    modalBtnText: { color: "#fff", fontWeight: "bold" },

    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        position: 'absolute',
        top: -2,
        right: -2,
        zIndex: 10,
        borderWidth: 2,
        borderColor: '#1e293b'
    },
    deleteMiniBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#450a0a',
        borderWidth: 1,
        borderColor: '#ef4444'
    },
    deleteMiniText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: 'bold'
    },
    unreadBadge: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#2563eb',
        marginLeft: 10
    },

    // Quiz Controller Styles
    quizSettingsContainer: {
        flex: 1,
    },
    quizHeaderCard: {
        backgroundColor: "#1e293b",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#334155",
    },
    quizHeaderTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
    },
    quizHeaderSub: {
        color: "#94a3b8",
        fontSize: 13,
        marginTop: 8,
        lineHeight: 18,
    },
    apiStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    apiStatusText: {
        fontSize: 12,
        fontWeight: "bold",
    },
    quizSectionCard: {
        backgroundColor: "#1e293b",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#334155",
    },
    quizSectionTitle: {
        color: "#38bdf8",
        fontSize: 15,
        fontWeight: "bold",
        marginBottom: 8,
    },
    inputLabel: {
        color: "#cbd5e1",
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
        marginTop: 8,
    },
    quizTextInput: {
        backgroundColor: "#0f172a",
        color: "#fff",
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        borderWidth: 1,
        borderColor: "#334155",
    },
    apiBtnRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 12,
    },
    testApiBtn: {
        flex: 1,
        backgroundColor: "#0284c7",
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    prefillBtn: {
        flex: 1,
        backgroundColor: "#6366f1",
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    helperText: {
        color: "#64748b",
        fontSize: 12,
        marginTop: 10,
        fontStyle: "italic",
    },
    pointsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    saveQuizBtn: {
        backgroundColor: "#22c55e",
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    saveQuizBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    resetQuizBtn: {
        backgroundColor: "#334155",
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 12,
    },
    resetQuizBtnText: {
        color: "#94a3b8",
        fontSize: 14,
        fontWeight: "600",
    }
});
