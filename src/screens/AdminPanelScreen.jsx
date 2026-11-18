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
    const [selectedUserForFraud, setSelectedUserForFraud] = useState(null);
    const [fraudModalTab, setFraudModalTab] = useState("coins"); // "coins" or "withdrawals"
    const [coinFilter, setCoinFilter] = useState("all"); // "all", "watch", "daily", "quiz"
    const [liveUserTransactions, setLiveUserTransactions] = useState([]);
    const [loadingTx, setLoadingTx] = useState(false);

    // Fetch fresh transactions when inspecting a user for full coin & fraud audit
    useEffect(() => {
        if (selectedUserForFraud) {
            setFraudModalTab("coins");
            setCoinFilter("all");
            fetchFreshUserTransactions(selectedUserForFraud);
        } else {
            setLiveUserTransactions([]);
        }
    }, [selectedUserForFraud]);

    const fetchFreshUserTransactions = async (user) => {
        if (!user || !user.id) return;
        setLoadingTx(true);
        try {
            const { data } = await supabase
                .from("wallet_transactions")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });
            if (data && data.length > 0) {
                setLiveUserTransactions(data);
            } else {
                setLiveUserTransactions(user.transactions || []);
            }
        } catch (_) {
            setLiveUserTransactions(user.transactions || []);
        } finally {
            setLoadingTx(false);
        }
    };

    // Quiz Controller States (Admin)
    const [quizApiUrl, setQuizApiUrl] = useState("");
    const [quizUseApi, setQuizUseApi] = useState(false);
    const [quizRewardPoints, setQuizRewardPoints] = useState("1");
    const [quizPenaltyPoints, setQuizPenaltyPoints] = useState("1");
    const [quizTesting, setQuizTesting] = useState(false);
    const [quizSaving, setQuizSaving] = useState(false);

    // 🛡️ Enforce Server-Side Admin Authorization (F-12)
    useEffect(() => {
        let isMounted = true;
        const verifyAdmin = async () => {
            const { isCurrentUserAdmin } = require("../services/supabaseService");
            const isAdmin = await isCurrentUserAdmin().catch(() => false);
            if (!isAdmin && isMounted) {
                Alert.alert(
                    "Unauthorized",
                    "You do not have administrative privileges to access this area.",
                    [{
                        text: "OK",
                        onPress: () => navigation.reset({
                            index: 0,
                            routes: [{ name: "MainTabs" }]
                        })
                    }]
                );
            }
        };
        verifyAdmin();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    // 🛡️ Hardware Back Button Handler for Admin
    useEffect(() => {
        const onBackPress = () => {
            if (selectedUserForFraud) {
                setSelectedUserForFraud(null);
                return true;
            }
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
    }, [modalVisible, selectedUserForFraud, activeTab]);

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
                const withdrawSnap = await database().ref("/withdraw_requests").once("value");

                if (usersSnap.exists()) {
                    const usersObj = usersSnap.val();
                    const walletsObj = walletsSnap.exists() ? walletsSnap.val() : {};
                    const withdrawObj = withdrawSnap.exists() ? withdrawSnap.val() : {};

                    // Also fetch Supabase profiles to enrich any missing fields (name, mobile, upi, country)
                    let supabaseProfiles = {};
                    try {
                        const { data: profiles } = await supabase
                            .from("profiles")
                            .select("id, display_name, mobile, phone, upi_id, email, country, avatar_data");
                        if (profiles) {
                            profiles.forEach(p => {
                                supabaseProfiles[p.id] = p;
                            });
                        }
                    } catch (_) {}

                    // Build user -> latest UPI map from withdraw_requests
                    const userToUpi = {};
                    Object.values(withdrawObj).forEach(req => {
                        if (req.upi && req.upi !== "N/A") {
                            if (req.userId) userToUpi[req.userId] = req.upi;
                            if (req.deviceId) userToUpi[req.deviceId] = req.upi;
                            if (req.mobile) userToUpi[req.mobile] = req.upi;
                        }
                    });

                    // Build list of all withdrawal requests for fraud analysis
                    const allWithdrawals = Object.keys(withdrawObj).map(key => ({
                        id: key,
                        ...withdrawObj[key]
                    }));

                    // Fetch wallet transactions from Supabase to compute full watch coins and coin sources
                    let allWalletTransactions = [];
                    try {
                        const { data: txData } = await supabase
                            .from("wallet_transactions")
                            .select("id, user_id, transaction_type, amount, balance_after, description, created_at")
                            .order("created_at", { ascending: false });
                        if (txData) allWalletTransactions = txData;
                    } catch (_) {}

                    const usersList = Object.keys(usersObj).map((key) => {
                        const val = usersObj[key];
                        const walletData = walletsObj[key] || {};
                        const sp = supabaseProfiles[key] || {};
                        const upiCandidate = val.upi || sp.upi_id || val.upi_id || userToUpi[key] || (val.mobile && userToUpi[val.mobile]) || "N/A";

                        // Collect and match all withdrawals for this user across ID, mobile, email, device
                        const userMobile = val.mobile || sp.mobile || sp.phone;
                        const userEmail = val.email || sp.email;
                        const userDeviceId = val.deviceInfo?.uniqueId || val.deviceId;

                        const userWithdrawals = allWithdrawals.filter(req => {
                            if (req.userId && (req.userId === key || req.userId === sp.id)) return true;
                            if (userDeviceId && req.deviceId && req.deviceId === userDeviceId) return true;
                            if (userMobile && req.mobile && req.mobile === userMobile) return true;
                            if (userEmail && req.email && req.email.toLowerCase() === userEmail.toLowerCase()) return true;
                            return false;
                        });

                        // Sort user withdrawals: newest first
                        userWithdrawals.sort((a, b) => {
                            const timeA = a.paidAt ? new Date(a.paidAt).getTime() : (a.timestamp || 0);
                            const timeB = b.paidAt ? new Date(b.paidAt).getTime() : (b.timestamp || 0);
                            return timeB - timeA;
                        });

                        // Calculate fraud metrics
                        const paidList = userWithdrawals.filter(w => w.status === "Paid");
                        const pendingList = userWithdrawals.filter(w => w.status === "Pending");
                        const refundedList = userWithdrawals.filter(w => w.status === "Refunded" || w.status === "Rejected");
                        const totalPaidCoins = paidList.reduce((acc, curr) => acc + (parseInt(curr.coins) || 0), 0);
                        const totalRequestedCoins = userWithdrawals.reduce((acc, curr) => acc + (parseInt(curr.coins) || 0), 0);

                        // Distinct payout accounts used
                        const upiSet = new Set();
                        userWithdrawals.forEach(w => {
                            if (w.upi && w.upi !== "N/A") upiSet.add(w.upi.trim().toLowerCase());
                        });

                        // Filter transactions for this user
                        const userTransactions = allWalletTransactions.filter(t => {
                            if (t.user_id && (t.user_id === key || t.user_id === sp.id)) return true;
                            return false;
                        });

                        // Breakdown of how the user got coins (Watch Ads, Daily Bonus, Quiz, Admin)
                        let watchCoins = 0;
                        let watchCount = 0;
                        let dailyBonusCoins = 0;
                        let dailyBonusCount = 0;
                        let quizCoins = 0;
                        let quizCount = 0;
                        let adminCoins = 0;
                        let refundCoins = 0;
                        let otherCoins = 0;

                        userTransactions.forEach(t => {
                            const amt = parseInt(t.amount) || 0;
                            const type = (t.transaction_type || "").toLowerCase();
                            const desc = (t.description || "").toLowerCase();

                            if (type.includes("ad") || desc.includes("watched") || desc.includes("rewarded ad") || desc.includes("ad reward")) {
                                watchCoins += amt;
                                watchCount += 1;
                            } else if (type.includes("daily") || desc.includes("daily") || desc.includes("spin")) {
                                dailyBonusCoins += amt;
                                dailyBonusCount += 1;
                            } else if (type.includes("quiz") || desc.includes("quiz")) {
                                quizCoins += amt;
                                quizCount += 1;
                            } else if (type.includes("admin") || type.includes("manual") || desc.includes("admin") || desc.includes("edit")) {
                                adminCoins += amt;
                            } else if (type.includes("refund") || desc.includes("refund")) {
                                refundCoins += amt;
                            } else if (amt > 0) {
                                otherCoins += amt;
                            }
                        });

                        const totalEarnedCoins = watchCoins + dailyBonusCoins + quizCoins + adminCoins + refundCoins + otherCoins;
                        const currentBalance = walletData.balance || 0;
                        const totalPendingCoins = pendingList.reduce((acc, curr) => acc + (parseInt(curr.coins) || 0), 0);
                        const unaccountedCoins = (currentBalance + totalPaidCoins + totalPendingCoins) - totalEarnedCoins;
                        const isSuspicious = unaccountedCoins > 100 && totalEarnedCoins > 0;

                        return {
                            id: key,
                            ... (typeof val === 'object' ? val : { rawData: val }),
                            name: val.name || val.display_name || sp.display_name || "No Name",
                            email: val.email || sp.email || "N/A",
                            mobile: val.mobile || sp.mobile || sp.phone || "N/A",
                            upi: upiCandidate,
                            country: val.country || sp.country || val.deviceInfo?.country || "India",
                            walletBalance: walletData.balance || 0,
                            withdrawals: userWithdrawals,
                            withdrawStats: {
                                total: userWithdrawals.length,
                                paid: paidList.length,
                                pending: pendingList.length,
                                refunded: refundedList.length,
                                totalPaidCoins,
                                totalRequestedCoins,
                                multiUpiCount: upiSet.size,
                                upiAccounts: Array.from(upiSet)
                            },
                            coinStats: {
                                watchCoins,
                                watchCount,
                                dailyBonusCoins,
                                dailyBonusCount,
                                quizCoins,
                                quizCount,
                                adminCoins,
                                refundCoins,
                                otherCoins,
                                totalEarnedCoins,
                                unaccountedCoins: Math.max(0, unaccountedCoins),
                                isSuspicious
                            },
                            transactions: userTransactions
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

                    const getRequestTime = (item) => {
                        let latest = 0;
                        if (item.paidAt) {
                            const t = new Date(item.paidAt).getTime();
                            if (!isNaN(t) && t > latest) latest = t;
                        }
                        if (item.refundedAt) {
                            const t = new Date(item.refundedAt).getTime();
                            if (!isNaN(t) && t > latest) latest = t;
                        }
                        if (item.lastUpdated && typeof item.lastUpdated === "number" && item.lastUpdated > latest) {
                            latest = item.lastUpdated;
                        }
                        if (item.updatedAt) {
                            const t = new Date(item.updatedAt).getTime();
                            if (!isNaN(t) && t > latest) latest = t;
                        }
                        if (typeof item.timestamp === "number" && item.timestamp > latest) {
                            latest = item.timestamp;
                        }
                        if (item.created_at) {
                            const t = new Date(item.created_at).getTime();
                            if (!isNaN(t) && t > latest) latest = t;
                        }
                        if (item.date && latest === 0) {
                            const parts = String(item.date).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                            if (parts) {
                                const parsed = new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`).getTime();
                                if (!isNaN(parsed)) latest = parsed;
                            } else {
                                const t = new Date(item.date).getTime();
                                if (!isNaN(t)) latest = t;
                            }
                        }
                        return latest;
                    };

                    withdrawList.sort((a, b) => getRequestTime(b) - getRequestTime(a));
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
                const isPayPal = currentEditItem?.paymentMethod === "PayPal" || (currentEditItem?.upi && currentEditItem?.upi.toLowerCase().includes("paypal"));
                const nowIso = new Date().toISOString();
                const nowTimestamp = Date.now();
                // Mark as Paid with UTR / PayPal Transaction ID and update timestamp for instant top-of-list display
                await database().ref(`/withdraw_requests/${currentEditItem.id}`).update({ 
                    status: "Paid", 
                    utrId: modalValue,
                    paidAt: nowIso,
                    lastUpdated: nowTimestamp,
                    updatedAt: nowIso
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
                                paidAt: nowIso,
                                lastUpdated: nowTimestamp,
                                updatedAt: nowIso
                            } 
                        })
                        .eq("id", currentEditItem.id);
                }
                Alert.alert("Success", `Request marked as Paid with ${isPayPal ? "PayPal Transaction ID" : "UTR ID"}`);
            } else if (modalType === "reject") {
                if (currentEditItem.status === "Refunded") {
                    Alert.alert("Notice", "This request is already marked as Refunded.");
                    return;
                }
                // Mark as Refunded with Reason (Wrong Details)
                const statusUpdate = "Refunded";
                const reasonDetail = modalValue;
                const targetUserId = currentEditItem.userId;
                const refundAmount = parseInt(currentEditItem.coins || 0);

                if (!targetUserId) {
                    Alert.alert("Error", "User ID not found in request");
                    return;
                }

                const nowIso = new Date().toISOString();
                const nowTimestamp = Date.now();

                // 1. Update Request Status in Firebase with update timestamp
                await database().ref(`/withdraw_requests/${currentEditItem.id}`).update({
                    status: statusUpdate,
                    rejectReason: reasonDetail,
                    refundedAt: nowIso,
                    lastUpdated: nowTimestamp,
                    updatedAt: nowIso
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
        const isPayPal = item.paymentMethod === "PayPal" || (item.upi && item.upi.toLowerCase().includes("paypal")) || (item.upi && item.upi.includes("@") && !item.upi.toLowerCase().includes("ok") && !item.upi.toLowerCase().includes("upi") && !item.upi.toLowerCase().includes("paytm"));
        const title = isPayPal ? "Enter PayPal Transaction ID" : "Enter UPI UTR ID";
        handleOpenModal("utr", title, "", item);
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
                <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.amount}>
                        {item.paymentMethod === "PayPal" || item.currency === "USD"
                            ? `$${item.usdAmount || (item.rupees * (0.48 / 45)).toFixed(2)} USD`
                            : `₹${item.rupees}`}
                    </Text>
                    {(item.paymentMethod === "PayPal" || item.currency === "USD") && (
                        <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "600" }}>
                            (₹{item.rupees})
                        </Text>
                    )}
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoLine}>
                <Text style={styles.detail}>Mobile: {item.mobile}</Text>
                <TouchableOpacity onPress={() => copyToClipboard(item.mobile, "Mobile Number")}>
                    <Text style={styles.copyLabel}>Copy</Text>
                </TouchableOpacity>
            </View>

            {(() => {
                const isPayPal = item.paymentMethod === "PayPal" || (item.upi && item.upi.toLowerCase().includes("paypal")) || (item.upi && item.upi.includes("@") && !item.upi.toLowerCase().includes("ok") && !item.upi.toLowerCase().includes("upi") && !item.upi.toLowerCase().includes("paytm"));
                return (
                    <View style={styles.infoLine}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                            <View style={[styles.methodBadge, { backgroundColor: isPayPal ? "#0284c7" : "#16a34a" }]}>
                                <Text style={styles.methodBadgeText}>{isPayPal ? "🌐 PayPal" : "🇮🇳 UPI"}</Text>
                            </View>
                            <Text style={[styles.detail, { marginLeft: 8, flexShrink: 1 }]}>
                                {isPayPal ? "PayPal ID: " : "UPI ID: "}
                                <Text style={{ color: "#fff", fontWeight: "bold" }}>{item.upi}</Text>
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => copyToClipboard(item.upi, isPayPal ? "PayPal ID" : "UPI ID")}>
                            <Text style={styles.copyLabel}>Copy</Text>
                        </TouchableOpacity>
                    </View>
                );
            })()}

            <Text style={styles.detail}>Requested: {item.coins} Coins</Text>

            {item.utrId ? (
                <View style={styles.infoLine}>
                    <Text style={[styles.detail, { color: "#38bdf8", fontWeight: "600" }]}>
                        {(item.paymentMethod === "PayPal" || item.upi?.toLowerCase().includes("paypal")) ? "PayPal Trans ID: " : "UTR ID: "}
                        {item.utrId}
                    </Text>
                    <TouchableOpacity onPress={() => copyToClipboard(item.utrId, "Confirmation ID")}>
                        <Text style={styles.copyLabel}>Copy</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {item.paidAt ? (
                <Text style={[styles.detail, { color: "#22c55e", fontWeight: "600", marginTop: 2 }]}>
                    Paid At: {new Date(item.paidAt).toLocaleString()}
                </Text>
            ) : null}

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
                <Text style={styles.detail}>💰 UPI / PayPal: {item.upi || "N/A"}</Text>
                {item.upi ? (
                    <TouchableOpacity onPress={() => copyToClipboard(item.upi, "UPI / PayPal ID")}>
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

            {/* 🛡️ Fraud Check & Withdrawal History Summary Card */}
            <View style={styles.fraudSummaryBox}>
                <View style={styles.fraudHeaderRow}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <MaterialCommunityIcons name="shield-search" size={17} color="#38bdf8" style={{ marginRight: 6 }} />
                        <Text style={styles.fraudTitle}>Fraud Check & Withdrawals</Text>
                    </View>
                    {item.withdrawStats?.pending > 0 && (
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>{item.withdrawStats.pending} PENDING</Text>
                        </View>
                    )}
                </View>

                <View style={styles.fraudGrid}>
                    <View style={styles.fraudGridItem}>
                        <Text style={styles.fraudGridLabel}>Total Req</Text>
                        <Text style={styles.fraudGridValue}>{item.withdrawStats?.total || 0}</Text>
                    </View>
                    <View style={styles.fraudGridItem}>
                        <Text style={styles.fraudGridLabel}>Paid</Text>
                        <Text style={[styles.fraudGridValue, { color: "#10b981" }]}>{item.withdrawStats?.paid || 0}</Text>
                    </View>
                    <View style={styles.fraudGridItem}>
                        <Text style={styles.fraudGridLabel}>Pending</Text>
                        <Text style={[styles.fraudGridValue, { color: item.withdrawStats?.pending > 0 ? "#f59e0b" : "#94a3b8" }]}>
                            {item.withdrawStats?.pending || 0}
                        </Text>
                    </View>
                    <View style={styles.fraudGridItem}>
                        <Text style={styles.fraudGridLabel}>Coins Paid</Text>
                        <Text style={[styles.fraudGridValue, { color: "#38bdf8" }]}>{item.withdrawStats?.totalPaidCoins || 0}</Text>
                    </View>
                </View>

                {/* Risk Alerts */}
                {item.withdrawStats?.multiUpiCount > 1 && (
                    <View style={styles.fraudAlertBadge}>
                        <MaterialCommunityIcons name="alert-decagram" size={15} color="#ef4444" style={{ marginRight: 6 }} />
                        <Text style={styles.fraudAlertText}>
                            High Risk: User used {item.withdrawStats.multiUpiCount} different UPI/Payout accounts!
                        </Text>
                    </View>
                )}

                {/* 🪙 Coin Earnings Breakdown (How He Got Coins) */}
                <View style={styles.coinEarningsSummaryBox}>
                    <View style={styles.coinEarningsHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Text style={{ fontSize: 13, marginRight: 5 }}>💰</Text>
                            <Text style={styles.coinEarningsTitle}>How He Got Coins</Text>
                        </View>
                        <Text style={styles.totalEarnedLabel}>
                            Total Earned: <Text style={{ color: "#10b981", fontWeight: "bold" }}>🪙 {item.coinStats?.totalEarnedCoins || 0}</Text>
                        </Text>
                    </View>

                    <View style={styles.coinGrid}>
                        {/* 📺 Full Watch Video Ads */}
                        <View style={[styles.coinGridItem, { borderColor: "rgba(56, 189, 248, 0.45)", backgroundColor: "rgba(14, 165, 233, 0.08)" }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                                <Text style={{ fontSize: 12, marginRight: 3 }}>📺</Text>
                                <Text style={[styles.coinGridLabel, { color: "#38bdf8", fontWeight: "bold" }]}>Watch Ads</Text>
                            </View>
                            <Text style={[styles.coinGridValue, { color: "#38bdf8" }]}>
                                {item.coinStats?.watchCoins || 0}
                            </Text>
                            <Text style={styles.coinGridSub}>
                                {item.coinStats?.watchCount || 0} ads watched
                            </Text>
                        </View>

                        {/* 🎁 Daily Bonus Spin */}
                        <View style={styles.coinGridItem}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                                <Text style={{ fontSize: 12, marginRight: 3 }}>🎁</Text>
                                <Text style={styles.coinGridLabel}>Daily Spin</Text>
                            </View>
                            <Text style={[styles.coinGridValue, { color: "#f59e0b" }]}>
                                {item.coinStats?.dailyBonusCoins || 0}
                            </Text>
                            <Text style={styles.coinGridSub}>
                                {item.coinStats?.dailyBonusCount || 0} spins
                            </Text>
                        </View>

                        {/* 🧠 Quiz Trivia */}
                        <View style={styles.coinGridItem}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                                <Text style={{ fontSize: 12, marginRight: 3 }}>🧠</Text>
                                <Text style={styles.coinGridLabel}>Quiz</Text>
                            </View>
                            <Text style={[styles.coinGridValue, { color: "#a855f7" }]}>
                                {item.coinStats?.quizCoins || 0}
                            </Text>
                            <Text style={styles.coinGridSub}>
                                {item.coinStats?.quizCount || 0} games
                            </Text>
                        </View>

                        {/* 💼 Current Wallet Balance */}
                        <View style={styles.coinGridItem}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                                <Text style={{ fontSize: 12, marginRight: 3 }}>💼</Text>
                                <Text style={styles.coinGridLabel}>Balance</Text>
                            </View>
                            <Text style={[styles.coinGridValue, { color: "#22c55e" }]}>
                                {item.walletBalance || 0}
                            </Text>
                            <Text style={styles.coinGridSub}>
                                in wallet
                            </Text>
                        </View>
                    </View>

                    {/* Discrepancy Alert */}
                    {item.coinStats?.isSuspicious && (
                        <View style={[styles.fraudAlertBadge, { marginTop: 6, marginBottom: 4 }]}>
                            <MaterialCommunityIcons name="alert" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                            <Text style={styles.fraudAlertText}>
                                Suspicious: Wallet + Withdrawn exceeds earned coins by {item.coinStats.unaccountedCoins} coins!
                            </Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.viewHistoryBtn}
                    onPress={() => setSelectedUserForFraud(item)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="shield-search" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                    <Text style={styles.viewHistoryBtnText}>
                        View Full Audit (Watch Coins & Withdrawals)
                    </Text>
                </TouchableOpacity>
            </View>

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
                            placeholder={
                                modalType === "utr"
                                    ? ((currentEditItem?.paymentMethod === "PayPal" || currentEditItem?.upi?.toLowerCase().includes("paypal"))
                                        ? "Enter PayPal Transaction ID (e.g. 9AB12345CD)"
                                        : "Enter 12-digit UPI UTR number (e.g. 405812345678)")
                                    : "Enter value..."
                            }
                            placeholderTextColor="#64748b"
                            value={modalValue}
                            onChangeText={setModalValue}
                            keyboardType={modalType === "coins" ? "numeric" : "default"}
                            multiline={modalType !== "coins" && modalType !== "utr"}
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

            {/* 🛡️ Full Fraud Audit Modal (User Withdrawal History) */}
            <Modal
                visible={!!selectedUserForFraud}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedUserForFraud(null)}
            >
                <View style={styles.fraudModalOverlay}>
                    <View style={styles.fraudModalContent}>
                        {/* Header */}
                        <View style={styles.fraudModalHeader}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.fraudModalTitle}>
                                    🛡️ User Audit & Coin History
                                </Text>
                                <Text style={styles.fraudModalSub} numberOfLines={1}>
                                    {selectedUserForFraud?.full_name || selectedUserForFraud?.name || "User"} • {selectedUserForFraud?.mobile || selectedUserForFraud?.email || "N/A"}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.fraudCloseBtn}
                                onPress={() => setSelectedUserForFraud(null)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialCommunityIcons name="close" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Segmented Audit Switcher */}
                        <View style={styles.modalTabBar}>
                            <TouchableOpacity
                                style={[styles.modalTabBtn, fraudModalTab === "coins" && styles.modalTabBtnActive]}
                                onPress={() => setFraudModalTab("coins")}
                            >
                                <Text style={[styles.modalTabBtnText, fraudModalTab === "coins" && styles.modalTabBtnTextActive]}>
                                    🪙 Coins & Watch History
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTabBtn, fraudModalTab === "withdrawals" && styles.modalTabBtnActive]}
                                onPress={() => setFraudModalTab("withdrawals")}
                            >
                                <Text style={[styles.modalTabBtnText, fraudModalTab === "withdrawals" && styles.modalTabBtnTextActive]}>
                                    💸 Withdrawals ({selectedUserForFraud?.withdrawals?.length || 0})
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {fraudModalTab === "coins" ? (
                            (() => {
                                const activeTx = liveUserTransactions.length > 0 ? liveUserTransactions : (selectedUserForFraud?.transactions || []);
                                let watchCoins = 0;
                                let watchCount = 0;
                                let dailyBonusCoins = 0;
                                let dailyBonusCount = 0;
                                let quizCoins = 0;
                                let quizCount = 0;
                                let adminCoins = 0;
                                let refundCoins = 0;
                                let otherCoins = 0;

                                activeTx.forEach(t => {
                                    const amt = parseInt(t.amount) || 0;
                                    const type = (t.transaction_type || "").toLowerCase();
                                    const desc = (t.description || "").toLowerCase();

                                    if (type.includes("ad") || desc.includes("watched") || desc.includes("rewarded ad") || desc.includes("ad reward")) {
                                        watchCoins += amt;
                                        watchCount += 1;
                                    } else if (type.includes("daily") || desc.includes("daily") || desc.includes("spin")) {
                                        dailyBonusCoins += amt;
                                        dailyBonusCount += 1;
                                    } else if (type.includes("quiz") || desc.includes("quiz")) {
                                        quizCoins += amt;
                                        quizCount += 1;
                                    } else if (type.includes("admin") || type.includes("manual") || desc.includes("admin") || desc.includes("edit")) {
                                        adminCoins += amt;
                                    } else if (type.includes("refund") || desc.includes("refund")) {
                                        refundCoins += amt;
                                    } else if (amt > 0) {
                                        otherCoins += amt;
                                    }
                                });

                                const totalEarned = watchCoins + dailyBonusCoins + quizCoins + adminCoins + refundCoins + otherCoins;
                                const currentBal = selectedUserForFraud?.walletBalance || 0;
                                const totalPaid = selectedUserForFraud?.withdrawStats?.totalPaidCoins || 0;
                                const totalPending = (selectedUserForFraud?.withdrawals || [])
                                    .filter(w => w.status === "Pending")
                                    .reduce((acc, curr) => acc + (parseInt(curr.coins) || 0), 0);
                                const unaccounted = (currentBal + totalPaid + totalPending) - totalEarned;
                                const isSuspicious = unaccounted > 100 && totalEarned > 0;

                                const filteredTx = activeTx.filter(t => {
                                    if (coinFilter === "all") return true;
                                    const type = (t.transaction_type || "").toLowerCase();
                                    const desc = (t.description || "").toLowerCase();
                                    if (coinFilter === "watch") {
                                        return type.includes("ad") || desc.includes("watched") || desc.includes("rewarded ad");
                                    }
                                    if (coinFilter === "daily") {
                                        return type.includes("daily") || desc.includes("spin");
                                    }
                                    if (coinFilter === "quiz") {
                                        return type.includes("quiz");
                                    }
                                    return true;
                                });

                                return (
                                    <ScrollView style={styles.fraudScroll} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 25 }}>
                                        {/* 📺 Hero Card: Full Watch Ads Breakdown */}
                                        <View style={styles.watchHeroCard}>
                                            <View style={styles.watchHeroLeft}>
                                                <Text style={{ fontSize: 26, marginRight: 10 }}>📺</Text>
                                                <View>
                                                    <Text style={styles.watchHeroTitle}>Watch Ads & Videos</Text>
                                                    <Text style={styles.watchHeroSub}>{watchCount} Rewarded Video Ads Watched</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.watchHeroCoins}>+{watchCoins} Coins</Text>
                                        </View>

                                        {/* 📊 All Coin Sources Grid */}
                                        <View style={styles.coinSourcesGrid}>
                                            <View style={styles.coinSourceCard}>
                                                <Text style={styles.coinSourceCardLabel}>🎁 Daily Spin</Text>
                                                <Text style={[styles.coinSourceCardVal, { color: "#f59e0b" }]}>{dailyBonusCoins}</Text>
                                                <Text style={styles.coinSourceCardSub}>{dailyBonusCount} spins claimed</Text>
                                            </View>
                                            <View style={styles.coinSourceCard}>
                                                <Text style={styles.coinSourceCardLabel}>🧠 Quiz Trivia</Text>
                                                <Text style={[styles.coinSourceCardVal, { color: "#a855f7" }]}>{quizCoins}</Text>
                                                <Text style={styles.coinSourceCardSub}>{quizCount} games won</Text>
                                            </View>
                                            <View style={styles.coinSourceCard}>
                                                <Text style={styles.coinSourceCardLabel}>📥 Total Earned</Text>
                                                <Text style={[styles.coinSourceCardVal, { color: "#10b981" }]}>{totalEarned}</Text>
                                                <Text style={styles.coinSourceCardSub}>all tasks combined</Text>
                                            </View>
                                            <View style={styles.coinSourceCard}>
                                                <Text style={styles.coinSourceCardLabel}>💼 Wallet Balance</Text>
                                                <Text style={[styles.coinSourceCardVal, { color: "#22c55e" }]}>{currentBal}</Text>
                                                <Text style={styles.coinSourceCardSub}>current coins</Text>
                                            </View>
                                        </View>

                                        {/* 🛡️ Coin Integrity Verdict */}
                                        {isSuspicious ? (
                                            <View style={styles.fraudAlertBadge}>
                                                <MaterialCommunityIcons name="alert-octagon" size={17} color="#ef4444" style={{ marginRight: 6 }} />
                                                <Text style={styles.fraudAlertText}>
                                                    ⚠️ Coin Discrepancy: Wallet ({currentBal}) + Withdrawn ({totalPaid}) exceeds task earnings ({totalEarned}) by {unaccounted} coins!
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={styles.verifiedBadge}>
                                                <MaterialCommunityIcons name="check-decagram" size={17} color="#10b981" style={{ marginRight: 6 }} />
                                                <Text style={styles.verifiedBadgeText}>
                                                    ✅ All Coins Verified: Every coin accounted for through verified ad watches and task activities.
                                                </Text>
                                            </View>
                                        )}

                                        {/* Filter Chips */}
                                        <View style={styles.filterRow}>
                                            <TouchableOpacity
                                                style={[styles.filterChip, coinFilter === "all" && styles.filterChipActive]}
                                                onPress={() => setCoinFilter("all")}
                                            >
                                                <Text style={[styles.filterChipText, coinFilter === "all" && styles.filterChipTextActive]}>
                                                    All ({activeTx.length})
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.filterChip, coinFilter === "watch" && styles.filterChipActive]}
                                                onPress={() => setCoinFilter("watch")}
                                            >
                                                <Text style={[styles.filterChipText, coinFilter === "watch" && styles.filterChipTextActive]}>
                                                    📺 Watch Ads ({watchCount})
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.filterChip, coinFilter === "daily" && styles.filterChipActive]}
                                                onPress={() => setCoinFilter("daily")}
                                            >
                                                <Text style={[styles.filterChipText, coinFilter === "daily" && styles.filterChipTextActive]}>
                                                    🎁 Daily Spin ({dailyBonusCount})
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.filterChip, coinFilter === "quiz" && styles.filterChipActive]}
                                                onPress={() => setCoinFilter("quiz")}
                                            >
                                                <Text style={[styles.filterChipText, coinFilter === "quiz" && styles.filterChipTextActive]}>
                                                    🧠 Quiz ({quizCount})
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Full Transaction History Ledger */}
                                        <Text style={styles.fraudListHeader}>
                                            Coin Transactions Ledger ({filteredTx.length})
                                        </Text>

                                        {loadingTx ? (
                                            <ActivityIndicator size="small" color="#38bdf8" style={{ marginVertical: 20 }} />
                                        ) : filteredTx.length === 0 ? (
                                            <View style={styles.emptyFraudBox}>
                                                <MaterialCommunityIcons name="information-outline" size={36} color="#64748b" />
                                                <Text style={styles.emptyFraudText}>No coin transactions found for this filter.</Text>
                                            </View>
                                        ) : (
                                            filteredTx.map((t, idx) => {
                                                const typeStr = (t.transaction_type || "").toLowerCase();
                                                const descStr = (t.description || "").toLowerCase();
                                                const amt = parseInt(t.amount) || 0;
                                                const isPositive = amt >= 0;

                                                let icon = "🪙";
                                                if (typeStr.includes("ad") || descStr.includes("watched")) icon = "📺";
                                                else if (typeStr.includes("daily") || descStr.includes("spin")) icon = "🎁";
                                                else if (typeStr.includes("quiz")) icon = "🧠";
                                                else if (typeStr.includes("refund")) icon = "↩️";
                                                else if (typeStr.includes("admin")) icon = "⚙️";
                                                else if (typeStr.includes("withdraw")) icon = "💸";

                                                return (
                                                    <View key={t.id || idx} style={styles.txCard}>
                                                        <View style={styles.txCardHeader}>
                                                            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                                                                <Text style={{ fontSize: 16, marginRight: 8 }}>{icon}</Text>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={styles.txCardTitle} numberOfLines={1}>
                                                                        {t.description || t.transaction_type || "Coin Transaction"}
                                                                    </Text>
                                                                    <Text style={styles.txCardDate}>
                                                                        {t.created_at ? new Date(t.created_at).toLocaleString() : "N/A"}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            <View style={{ alignItems: "flex-end" }}>
                                                                <Text style={[styles.txCardAmount, { color: isPositive ? "#10b981" : "#ef4444" }]}>
                                                                    {isPositive ? `+${amt}` : amt}
                                                                </Text>
                                                                {t.balance_after !== undefined && (
                                                                    <Text style={styles.txCardBalance}>Bal: {t.balance_after}</Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })
                                        )}
                                    </ScrollView>
                                );
                            })()
                        ) : (
                            <ScrollView style={styles.fraudScroll} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 25 }}>
                                {/* User Risk Overview Box */}
                                <View style={styles.fraudOverviewBox}>
                                    <View style={styles.fraudOverviewRow}>
                                        <Text style={styles.fraudOverviewLabel}>Current Wallet:</Text>
                                        <Text style={styles.fraudOverviewVal}>🪙 {selectedUserForFraud?.walletBalance || 0} Coins</Text>
                                    </View>
                                    <View style={styles.fraudOverviewRow}>
                                        <Text style={styles.fraudOverviewLabel}>Total Paid Coins:</Text>
                                        <Text style={[styles.fraudOverviewVal, { color: "#10b981" }]}>
                                            🪙 {selectedUserForFraud?.withdrawStats?.totalPaidCoins || 0} Coins
                                        </Text>
                                    </View>
                                    <View style={styles.fraudOverviewRow}>
                                        <Text style={styles.fraudOverviewLabel}>Primary UPI / PayPal:</Text>
                                        <Text style={styles.fraudOverviewVal} numberOfLines={1}>{selectedUserForFraud?.upi || "N/A"}</Text>
                                    </View>
                                    {selectedUserForFraud?.withdrawStats?.multiUpiCount > 1 && (
                                        <View style={[styles.fraudAlertBadge, { marginTop: 6 }]}>
                                            <MaterialCommunityIcons name="alert" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                                            <Text style={styles.fraudAlertText}>
                                                Multi-Account Warning: Requested payouts to {selectedUserForFraud.withdrawStats.multiUpiCount} different UPI/PayPal accounts!
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Withdrawal Transactions List */}
                                <Text style={styles.fraudListHeader}>
                                    All Withdrawal Requests ({selectedUserForFraud?.withdrawals?.length || 0})
                                </Text>

                                {(!selectedUserForFraud?.withdrawals || selectedUserForFraud.withdrawals.length === 0) ? (
                                    <View style={styles.emptyFraudBox}>
                                        <MaterialCommunityIcons name="check-circle-outline" size={40} color="#64748b" />
                                        <Text style={styles.emptyFraudText}>No withdrawal requests on record for this user.</Text>
                                    </View>
                                ) : (
                                    selectedUserForFraud.withdrawals.map((w, index) => {
                                        const isPaid = w.status === "Paid";
                                        const isPending = w.status === "Pending";
                                        const statusColor = isPaid ? "#10b981" : (isPending ? "#f59e0b" : "#ef4444");

                                        return (
                                            <View key={w.id || index} style={styles.fraudHistoryCard}>
                                                <View style={styles.fraudHistoryCardHeader}>
                                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                                        <Text style={styles.fraudCoinsText}>🪙 {w.coins} Coins</Text>
                                                        {w.rupees && (
                                                            <Text style={styles.fraudRupeesText}>(₹{w.rupees})</Text>
                                                        )}
                                                    </View>
                                                    <View style={[styles.fraudStatusBadge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
                                                        <Text style={[styles.fraudStatusText, { color: statusColor }]}>
                                                            {w.status || "Pending"}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View style={styles.divider} />

                                                <View style={styles.infoLine}>
                                                    <Text style={styles.detail}>Payout To:</Text>
                                                    <Text style={[styles.detail, { color: "#fff", fontWeight: "bold", flex: 1, textAlign: "right" }]}>
                                                        {w.upi || "N/A"}
                                                    </Text>
                                                </View>

                                                <View style={styles.infoLine}>
                                                    <Text style={styles.detail}>Date:</Text>
                                                    <Text style={[styles.detail, { color: "#94a3b8" }]}>
                                                        {w.date || (w.timestamp ? new Date(w.timestamp).toLocaleString() : "N/A")}
                                                    </Text>
                                                </View>

                                                {w.utrId ? (
                                                    <View style={styles.infoLine}>
                                                        <Text style={[styles.detail, { color: "#38bdf8", fontWeight: "600" }]}>
                                                            UTR / Ref ID: {w.utrId}
                                                        </Text>
                                                        <TouchableOpacity onPress={() => copyToClipboard(w.utrId, "UTR ID")}>
                                                            <Text style={styles.copyLabel}>Copy</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : null}

                                                {w.paidAt ? (
                                                    <Text style={[styles.detail, { color: "#22c55e", fontSize: 11, marginTop: 2 }]}>
                                                        Paid Timestamp: {new Date(w.paidAt).toLocaleString()}
                                                    </Text>
                                                ) : null}

                                                {w.rejectReason ? (
                                                    <Text style={[styles.detail, { color: "#ef4444", fontSize: 11, marginTop: 2 }]}>
                                                        Reason: {w.rejectReason}
                                                    </Text>
                                                ) : null}

                                                {/* Quick Actions if Pending */}
                                                {isPending && (
                                                    <View style={[styles.actionRow, { marginTop: 10 }]}>
                                                        <TouchableOpacity
                                                            style={styles.paidBtn}
                                                            onPress={() => {
                                                                setSelectedUserForFraud(null);
                                                                handleMarkAsPaid(w);
                                                            }}
                                                        >
                                                            <Text style={styles.btnText}>Mark Paid</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.rejectBtn}
                                                            onPress={() => {
                                                                setSelectedUserForFraud(null);
                                                                handleMarkWrongDetails(w);
                                                            }}
                                                        >
                                                            <Text style={styles.btnText}>Wrong Details</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })
                                )}
                            </ScrollView>
                        )}
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
    methodBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: "center",
    },
    methodBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "bold",
    },
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
    },

    // 🛡️ Fraud Check & User Withdrawal Audit Styles
    fraudSummaryBox: {
        backgroundColor: "#0b1329",
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: "rgba(56, 189, 248, 0.25)",
    },
    fraudHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    fraudTitle: {
        color: "#38bdf8",
        fontSize: 13,
        fontWeight: "bold",
    },
    pendingBadge: {
        backgroundColor: "rgba(245, 158, 11, 0.15)",
        borderWidth: 1,
        borderColor: "#f59e0b",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    pendingBadgeText: {
        color: "#f59e0b",
        fontSize: 10,
        fontWeight: "bold",
    },
    fraudGrid: {
        flexDirection: "row",
        backgroundColor: "#0f172a",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 6,
        justifyContent: "space-around",
        marginBottom: 8,
    },
    fraudGridItem: {
        alignItems: "center",
    },
    fraudGridLabel: {
        color: "#94a3b8",
        fontSize: 11,
        marginBottom: 2,
    },
    fraudGridValue: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
    },
    fraudAlertBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(239, 68, 68, 0.35)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
    },
    fraudAlertText: {
        color: "#ef4444",
        fontSize: 11,
        fontWeight: "700",
        flex: 1,
    },
    viewHistoryBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(56, 189, 248, 0.12)",
        borderWidth: 1,
        borderColor: "#38bdf8",
        paddingVertical: 8,
        borderRadius: 8,
        marginTop: 4,
    },
    viewHistoryBtnText: {
        color: "#38bdf8",
        fontSize: 12,
        fontWeight: "bold",
    },

    // Fraud Modal
    fraudModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "flex-end",
    },
    fraudModalContent: {
        backgroundColor: "#1e293b",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: "90%",
        borderTopWidth: 1,
        borderTopColor: "#334155",
    },
    fraudModalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#334155",
    },
    fraudModalTitle: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "bold",
    },
    fraudModalSub: {
        color: "#94a3b8",
        fontSize: 12,
        marginTop: 2,
    },
    fraudCloseBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: "#334155",
    },
    fraudOverviewBox: {
        backgroundColor: "#0f172a",
        borderRadius: 10,
        padding: 12,
        marginTop: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#334155",
    },
    fraudOverviewRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginVertical: 2,
    },
    fraudOverviewLabel: {
        color: "#94a3b8",
        fontSize: 12,
    },
    fraudOverviewVal: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "bold",
    },
    fraudListHeader: {
        color: "#cbd5e1",
        fontSize: 13,
        fontWeight: "bold",
        marginBottom: 10,
    },
    emptyFraudBox: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
    },
    emptyFraudText: {
        color: "#64748b",
        fontSize: 13,
        marginTop: 8,
    },
    fraudScroll: {
        maxHeight: 400,
    },
    fraudHistoryCard: {
        backgroundColor: "#0f172a",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#334155",
    },
    fraudHistoryCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    fraudCoinsText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "bold",
    },
    fraudRupeesText: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "600",
        marginLeft: 6,
    },
    fraudStatusBadge: {
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    fraudStatusText: {
        fontSize: 11,
        fontWeight: "bold",
    },

    // 🪙 Coin Earnings & Watch History Breakdown Styles
    coinEarningsSummaryBox: {
        backgroundColor: "#0d1829",
        borderRadius: 10,
        padding: 10,
        marginTop: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "rgba(56, 189, 248, 0.2)",
    },
    coinEarningsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    coinEarningsTitle: {
        color: "#38bdf8",
        fontSize: 12,
        fontWeight: "bold",
    },
    totalEarnedLabel: {
        color: "#94a3b8",
        fontSize: 11,
    },
    coinGrid: {
        flexDirection: "row",
        gap: 6,
    },
    coinGridItem: {
        flex: 1,
        backgroundColor: "#0f172a",
        borderRadius: 6,
        padding: 6,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#334155",
    },
    coinGridLabel: {
        color: "#94a3b8",
        fontSize: 10,
    },
    coinGridValue: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "bold",
        marginVertical: 1,
    },
    coinGridSub: {
        color: "#64748b",
        fontSize: 9,
        textAlign: "center",
    },

    // Modal Tab Bar
    modalTabBar: {
        flexDirection: "row",
        backgroundColor: "#0f172a",
        borderRadius: 10,
        padding: 4,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: "#334155",
    },
    modalTabBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    modalTabBtnActive: {
        backgroundColor: "#2563eb",
    },
    modalTabBtnText: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "600",
    },
    modalTabBtnTextActive: {
        color: "#fff",
        fontWeight: "bold",
    },

    // Watch Ads Hero Banner
    watchHeroCard: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "rgba(14, 165, 233, 0.12)",
        borderWidth: 1.5,
        borderColor: "#38bdf8",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    watchHeroLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    watchHeroTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
    },
    watchHeroSub: {
        color: "#38bdf8",
        fontSize: 11,
        marginTop: 2,
    },
    watchHeroCoins: {
        color: "#38bdf8",
        fontSize: 18,
        fontWeight: "900",
    },

    // Sources Grid
    coinSourcesGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 10,
    },
    coinSourceCard: {
        width: "48.5%",
        backgroundColor: "#0f172a",
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: "#334155",
    },
    coinSourceCardLabel: {
        color: "#94a3b8",
        fontSize: 11,
        fontWeight: "600",
        marginBottom: 4,
    },
    coinSourceCardVal: {
        fontSize: 16,
        fontWeight: "bold",
    },
    coinSourceCardSub: {
        color: "#64748b",
        fontSize: 10,
        marginTop: 2,
    },

    // Verified Badge
    verifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(16, 185, 129, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(16, 185, 129, 0.4)",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 10,
    },
    verifiedBadgeText: {
        color: "#10b981",
        fontSize: 11,
        fontWeight: "700",
        flex: 1,
    },

    // Filter Chips Row
    filterRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 10,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "#334155",
    },
    filterChipActive: {
        backgroundColor: "#38bdf8",
        borderColor: "#38bdf8",
    },
    filterChipText: {
        color: "#94a3b8",
        fontSize: 11,
        fontWeight: "600",
    },
    filterChipTextActive: {
        color: "#0a0f1f",
        fontWeight: "bold",
    },

    // Transaction Card
    txCard: {
        backgroundColor: "#0f172a",
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: "#1e293b",
    },
    txCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    txCardTitle: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
    txCardDate: {
        color: "#64748b",
        fontSize: 10,
        marginTop: 2,
    },
    txCardAmount: {
        fontSize: 13,
        fontWeight: "bold",
    },
    txCardBalance: {
        color: "#94a3b8",
        fontSize: 10,
        marginTop: 1,
    }
});
