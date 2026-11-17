

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import AdmobBannerCard from "../components/AdmobBannerCard";
import { showAppOpenAd } from "../ads/AppOpenManager";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

const COIN_RATE = 0.01;            // 1 coin = ₹0.01 INR
const USD_RATE = 0.48 / 45;        // ₹45 INR = $0.48 USD (1 INR ≈ $0.01067 USD)
const MIN_WITHDRAW_UPI = 500;      // 500 coins = ₹5 INR
const MIN_WITHDRAW_USD = 4500;     // 4,500 coins = $0.48 USD
const MAX_WITHDRAW = 10000;        // ₹100 INR / $1.07 USD

export default function WalletScreen() {
  const [coins, setCoins] = useState(0);
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userCountry, setUserCountry] = useState("India");

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawCoins, setWithdrawCoins] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [upi, setUpi] = useState("");
  const [payoutType, setPayoutType] = useState("UPI");
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const isSubmittingRef = useRef(false);

  const getINR = (c) => (c * COIN_RATE).toFixed(2);
  const getUSD = (c) => (c * COIN_RATE * USD_RATE).toFixed(2);

  useEffect(() => {
    fetchWalletData();
  }, []);

  // Show App Open on Focus
  useFocusEffect(
    useCallback(() => {
      showAppOpenAd();
      fetchWalletData();
      syncWithdrawStatus();
    }, [])
  );

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Wallet Balance from Firebase (Primary Source of Truth)
      const { getDatabase, ref, get, query, orderByChild, equalTo } = require("@react-native-firebase/database");
      const db = getDatabase();
      const walletSnap = await get(ref(db, `/wallets/${user.id}`));

      if (walletSnap.exists()) {
        const walletData = walletSnap.val();
        setCoins(parseFloat(walletData.balance) || 0);
      }

      // Fetch Profile for prefill, country, and balance fallback
      let userMobile = "";
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance, display_name, mobile, phone, upi_id, country")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (!walletSnap.exists()) {
          setCoins(parseFloat(profile.wallet_balance) || 0);
        }
        if (profile.display_name) setName((prev) => prev || profile.display_name);
        if (profile.mobile || profile.phone) {
          userMobile = profile.mobile || profile.phone;
          setMobile((prev) => prev || userMobile);
        }
        if (profile.upi_id) {
          setUpi((prev) => prev || profile.upi_id);
          const savedUpi = profile.upi_id.toLowerCase();
          if (savedUpi.includes("paypal")) {
            setPayoutType("PayPal");
          }
        }
      } else {
        const localProf = await AsyncStorage.getItem("USER_PROFILE");
        if (localProf) {
          const lp = JSON.parse(localProf);
          if (lp.name) setName((prev) => prev || lp.name);
          if (lp.mobile) {
            userMobile = lp.mobile;
            setMobile((prev) => prev || lp.mobile);
          }
          if (lp.upi) {
            setUpi((prev) => prev || lp.upi);
            if (lp.upi.toLowerCase().includes("paypal")) setPayoutType("PayPal");
          }
        }
      }

      // Smart country & region auto-detection:
      // Prioritize physical location indicators (carrier, IP, Indian mobile format)
      try {
        const DeviceInfo = require("react-native-device-info").default;
        const carrier = await DeviceInfo.getCarrier().catch(() => "");
        const isIndianCarrier = /jio|airtel|vi|vodafone|idea|bsnl|mtnl/i.test(carrier || "");
        const isIndianMobile = userMobile.startsWith("+91") || (userMobile.length === 10 && /^[6-9]/.test(userMobile));
        const cachedDetectedCountry = await AsyncStorage.getItem("DETECTED_COUNTRY");

        let resolvedCountry = "India";
        if (isIndianCarrier || isIndianMobile) {
          // If carrier (e.g. Jio True5G) or mobile (+91) is clearly Indian, user is in India
          resolvedCountry = "India";
        } else if (cachedDetectedCountry) {
          resolvedCountry = cachedDetectedCountry;
        } else if (profile?.country) {
          resolvedCountry = profile.country;
        } else {
          const devCountry = await DeviceInfo.getCountry().catch(() => "");
          if (devCountry === "IN" || devCountry === "India") {
            resolvedCountry = "India";
          } else if (devCountry) {
            resolvedCountry = devCountry === "US" ? "USA" : devCountry;
          }
        }

        setUserCountry(resolvedCountry);
        if (resolvedCountry !== "India") {
          setPayoutType("PayPal");
        } else {
          setPayoutType("UPI");
        }
      } catch (_) {}

      // Fetch Transaction History from Supabase
      let transactions = [];
      try {
        const { data, error: tError } = await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data) transactions = data;
      } catch (_) {}

      // Fetch current status from Firebase to ensure real-time accuracy for user
      let fbData = {};
      try {
        const withdrawQuery = query(ref(db, "/withdraw_requests"), orderByChild("userId"), equalTo(user.id));
        const fbSnap = await get(withdrawQuery);
        fbData = fbSnap.val() || {};
      } catch (_) {}

      // Collect all refund transactions by originalId to prevent duplicate rows
      const refundByOriginalId = {};
      transactions.forEach((t) => {
        if (t.transaction_type === "Refund" && t.metadata?.originalId) {
          refundByOriginalId[t.metadata.originalId] = t;
        }
      });

      // Set to track seen withdrawal IDs and prevent duplicate entries
      const seenWithdrawalIds = new Set();
      const formattedHistory = [];

      transactions.forEach((t) => {
        // If this is a separate Refund ledger row whose original withdrawal exists, SKIP IT
        // so the user only sees ONE entry in Withdrawal History for that request
        if (t.transaction_type === "Refund") {
          const origId = t.metadata?.originalId;
          const originalExists = origId && transactions.some((other) => other.id === origId);
          if (originalExists) {
            return; // Skip duplicate refund entry!
          }
        }

        // Prevent duplicate rows with identical IDs
        if (seenWithdrawalIds.has(t.id)) {
          return;
        }
        seenWithdrawalIds.add(t.id);

        let status = "Completed";
        let rejectReason = null;
        let utrId = t.metadata?.utrId;
        let paidAt = t.metadata?.paidAt;
        let paymentMethod = t.metadata?.paymentMethod || (t.metadata?.upi?.toLowerCase().includes("paypal") ? "PayPal" : "UPI");

        // Merge Firebase Status if available (it has the latest "Paid" or "Refunded" update from Admin)
        const fbMatch = fbData[t.id];
        if (fbMatch) {
          status = fbMatch.status || "Pending";
          rejectReason = fbMatch.rejectReason || null;
          utrId = fbMatch.utrId || utrId;
          paidAt = fbMatch.paidAt || paidAt;
          if (fbMatch.paymentMethod) paymentMethod = fbMatch.paymentMethod;
        } else if (t.transaction_type === "Withdrawal" && t.metadata && t.metadata.status) {
          status = t.metadata.status;
          rejectReason = t.metadata.rejectReason;
        } else if (t.transaction_type === "Refund") {
          status = "Refunded";
          rejectReason = t.metadata?.reason;
        }

        // Check if there is a linked refund transaction that marks this withdrawal as refunded
        const linkedRefund = refundByOriginalId[t.id];
        if (linkedRefund) {
          status = "Refunded";
          if (!rejectReason) {
            rejectReason = linkedRefund.metadata?.reason || "Details rejected by admin";
          }
        }

        const tTimestamp = new Date(t.created_at).getTime();

        formattedHistory.push({
          id: t.id,
          type: t.transaction_type,
          coins: parseFloat(t.amount),
          status: status,
          rejectReason: rejectReason,
          utrId: utrId,
          paidAt: paidAt,
          paymentMethod: paymentMethod,
          date: new Date(t.created_at).toLocaleString(),
          timestamp: !isNaN(tTimestamp) ? tTimestamp : 0,
        });
      });

      // Merge any withdraw requests from Firebase not yet in Supabase ledger
      Object.keys(fbData).forEach((key) => {
        if (!seenWithdrawalIds.has(key)) {
          seenWithdrawalIds.add(key);
          const req = fbData[key];
          let reqTime = req.timestamp;
          if (!reqTime && req.paidAt) reqTime = new Date(req.paidAt).getTime();
          if (!reqTime && req.date) {
            const parts = String(req.date).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (parts) reqTime = new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`).getTime();
            else reqTime = new Date(req.date).getTime();
          }

          formattedHistory.push({
            id: key,
            type: "Withdrawal",
            coins: -Math.abs(parseFloat(req.coins || 0)),
            status: req.status || "Pending",
            rejectReason: req.rejectReason || null,
            utrId: req.utrId || null,
            paidAt: req.paidAt || null,
            paymentMethod: req.paymentMethod || (req.upi?.toLowerCase().includes("paypal") ? "PayPal" : "UPI"),
            date: req.date || (req.timestamp ? new Date(req.timestamp).toLocaleString() : new Date().toLocaleString()),
            timestamp: typeof reqTime === "number" && !isNaN(reqTime) ? reqTime : 0,
          });
        }
      });

      // Sort with current date and time on top (newest first)
      formattedHistory.sort((a, b) => {
        const timeA = (typeof a.timestamp === "number" && a.timestamp > 0)
          ? a.timestamp
          : (a.paidAt ? new Date(a.paidAt).getTime() : 0);
        const timeB = (typeof b.timestamp === "number" && b.timestamp > 0)
          ? b.timestamp
          : (b.paidAt ? new Date(b.paidAt).getTime() : 0);
        return timeB - timeA;
      });

      setHistory(formattedHistory);
      // Persist for offline view
      await AsyncStorage.setItem("COIN_HISTORY", JSON.stringify(formattedHistory));
    } catch (e) {
      console.log("Supabase Wallet Fetch Error:", e);
    }
  };

  // Pull-down refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  };

  // 🔥 Sync withdraw status + auto delete if admin removes
  const syncWithdrawStatus = async () => {
    const { getDatabase, ref: fbRef, onValue } = require("@react-native-firebase/database");
    const db = getDatabase();
    const local = await AsyncStorage.getItem("COIN_HISTORY");
    if (!local) return;

    let list = JSON.parse(local);

    list.forEach((item) => {
      // Listen for updates on any withdrawal category
      if (item.id && (item.type === "Withdrawal" || item.type === "Withdraw")) {
        const itemRef = fbRef(db, `/withdraw_requests/${item.id}`);

        onValue(itemRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.val();
            // Updatelist with new status if it changed
            let updated = false;
            const newList = list.map((h) => {
              if (h.id === item.id && (h.status !== data.status || h.rejectReason !== data.rejectReason)) {
                updated = true;
                return {
                  ...h,
                  status: data.status,
                  rejectReason: data.rejectReason || h.rejectReason,
                  type: "Withdrawal"
                };
              }
              return h;
            });

            if (updated) {
              list = newList;
              setHistory([...list]);
              await AsyncStorage.setItem("COIN_HISTORY", JSON.stringify(list));
            }
          } else {
            // Admin deleted → remove from history
            const newList = list.filter((h) => h.id !== item.id);
            if (newList.length !== list.length) {
              list = newList;
              setHistory([...list]);
              await AsyncStorage.setItem("COIN_HISTORY", JSON.stringify(list));
            }
          }
        });
      }
    });
  };

  // Withdraw Logic
  const withdraw = async () => {
    const amount = parseInt(withdrawCoins);

    if (!amount) {
      alert("Enter coins");
      return;
    }

    const isPayPal = payoutType === "PayPal";
    const minAmount = isPayPal ? MIN_WITHDRAW_USD : MIN_WITHDRAW_UPI;
    const minDisplay = isPayPal ? "4,500 coins ($0.48 USD)" : "500 coins (₹5 INR)";

    if (amount < minAmount) {
      alert(`Minimum withdraw for ${isPayPal ? "PayPal (USD)" : "UPI (INR)"} is ${minDisplay}`);
      return;
    }

    if (amount > MAX_WITHDRAW) {
      alert(`Maximum withdraw is ${MAX_WITHDRAW} coins (${isPayPal ? "$1.07 USD" : "₹100 INR"})`);
      return;
    }

    if (amount % 500 !== 0) {
      alert("Withdraw only in multiples of 500 (500, 1000, 1500... or 4500, 5000...)");
      return;
    }

    if (amount > coins) {
      alert("Not enough balance");
      return;
    }

    if (!name || !mobile || !upi) {
      alert(`Please enter Name, Mobile & ${isPayPal ? "PayPal ID" : "UPI ID"}`);
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      const paymentMethod = isPayPal ? "PayPal" : "UPI";
      const inrAmount = getINR(amount);
      const usdAmount = getUSD(amount);
      const currency = isPayPal ? "USD" : "INR";
      const displayAmount = isPayPal ? `$${usdAmount} USD` : `₹${inrAmount}`;
      const description = `Withdrawal via ${paymentMethod}: ${displayAmount} (${upi})`;
      const metadata = {
        name,
        mobile,
        upi,
        paymentMethod,
        status: "Pending",
        currency,
        rupees: inrAmount,
        usdAmount: usdAmount,
        displayAmount,
        country: userCountry
      };

      // 🛡️ Atomic Server-Side Withdrawal Execution (F-06 Race Condition Prevention)
      const { atomicProcessWithdrawal } = require("../services/supabaseService");
      const withdrawalResult = await atomicProcessWithdrawal(amount, description, metadata);

      if (!withdrawalResult.success) {
        throw new Error(withdrawalResult.error || "Withdrawal failed verification.");
      }

      const transId = withdrawalResult.transactionId || `req_${Date.now()}`;
      const newBalance = withdrawalResult.newBalance;

      // 3. Sync to Firebase for Admin Panel Visibility with Atomic Transaction
      try {
        const { getDatabase, ref: fbRef, set, update } = require("@react-native-firebase/database");
        const db = getDatabase();
        await set(fbRef(db, `/withdraw_requests/${transId}`), {
          id: transId,
          userId: user.id,
          name: name,
          mobile: mobile,
          upi: upi,
          paymentMethod: paymentMethod,
          coins: amount,
          rupees: inrAmount,
          usdAmount: usdAmount,
          currency: currency,
          displayAmount: displayAmount,
          country: userCountry,
          status: "Pending",
          date: new Date().toLocaleString(),
          timestamp: Date.now()
        });

        // Atomic balance update in Firebase
        const fbWalletRef = fbRef(db, `/wallets/${user.id}/balance`);
        await fbWalletRef.transaction((current) => {
          if (current === null || current === undefined) return newBalance;
          return Math.max(0, current - amount);
        });

        // Sync user UPI & mobile to Firebase user record for Admin Panel
        await update(fbRef(db, `/users/${user.id}`), {
          upi: upi,
          mobile: mobile,
          name: name
        });
        // Also persist UPI into Supabase profile
        await supabase.from("profiles").update({
          upi_id: upi,
          mobile: mobile,
          display_name: name
        }).eq("id", user.id);
      } catch (fbError) {
        console.warn("Firebase Sync Error:", fbError.message);
      }

      // Update UI
      setCoins(newBalance);
      setWithdrawCoins("");
      setShowWithdraw(false);
      alert(`Withdrawal request for ${displayAmount} submitted successfully!`);
      await fetchWalletData();
    } catch (e) {
      console.log("Withdrawal Error:", e);
      alert("Withdrawal failed: " + e.message);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const isRefunded = item.status === "Refunded";
    const isPaid = item.status === "Paid";
    return (
      <TouchableOpacity 
        style={styles.historyItem} 
        onPress={() => {
          setSelectedTransaction(item);
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.historyType}>
            {isRefunded ? "Withdrawal (Refunded)" : item.type}
          </Text>
          <Text style={styles.historyDate}>{item.date}</Text>
          
          {/* Prominent status for any Withdrawal or Refunded category */}
          <View style={{ marginTop: 4 }}>
            <Text
              style={{
                color: isPaid ? "#22c55e" : 
                       (isRefunded ? "#38bdf8" : (item.status === "Rejected" ? "#ef4444" : "#facc15")),
                fontSize: 12,
                fontWeight: "900",
                textTransform: "uppercase",
              }}
            >
              • {item.status}
            </Text>

            {/* Admin Paid Information on card */}
            {isPaid && (
              <View style={{ marginTop: 3 }}>
                {item.utrId ? (
                  <Text style={{ color: "#38bdf8", fontSize: 11, fontWeight: "700" }}>
                    {(item.paymentMethod === "PayPal" ? "PayPal Trans ID: " : "UTR / Ref: ") + item.utrId}
                  </Text>
                ) : null}
                {item.paidAt ? (
                  <Text style={{ color: "#9ca3af", fontSize: 10, fontWeight: "500", marginTop: 1 }}>
                    Paid on: {new Date(item.paidAt).toLocaleString()}
                  </Text>
                ) : null}
              </View>
            )}

            {item.rejectReason && (
              <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                ⚠️ {item.rejectReason}
              </Text>
            )}
            {isRefunded && (
              <Text style={{ color: "#38bdf8", fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                ↩ Coins restored to wallet
              </Text>
            )}
          </View>
        </View>
        <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={[
                styles.historyCoins,
                { color: isRefunded ? "#38bdf8" : (item.coins > 0 ? "#22c55e" : "#ef4444") },
              ]}
            >
              {isRefunded ? `+${Math.abs(item.coins)}` : (item.coins > 0 ? "+" : "") + item.coins}
            </Text>
            <Text style={[styles.historyCoinsUnit, { color: isRefunded ? "#38bdf8" : (item.coins > 0 ? "#22c55e" : "#ef4444") }]}>
              {" "}Coins
            </Text>
            <MaterialCommunityIcons 
              name={isRefunded ? "cash-refund" : (item.coins > 0 ? "database-arrow-up" : "database-arrow-down")} 
              size={16} 
              color={isRefunded ? "#38bdf8" : (item.coins > 0 ? "#22c55e" : "#ef4444")} 
              style={{ marginLeft: 4 }} 
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Balance */}
      <View style={styles.balanceCard}>
        <TouchableOpacity
          style={styles.countryPillRow}
          onPress={() => {
            const nextCountry = userCountry === "India" ? "USA" : "India";
            setUserCountry(nextCountry);
            setPayoutType(nextCountry === "India" ? "UPI" : "PayPal");
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.countryPill}>
            {userCountry === "India" ? "🇮🇳 India Region (Tap to Switch)" : `🌐 ${userCountry || "USA"} Region (Tap to Switch)`}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.balanceTitle, { color: "#9ca3af" }]}>Wallet Balance</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.balance, { color: "#22c55e" }]}>{coins}</Text>
          <MaterialCommunityIcons name="database" size={30} color="#22c55e" style={{ marginLeft: 8 }} />
        </View>

        {userCountry === "India" ? (
          <View style={styles.currencyRow}>
            <Text style={styles.rupees}>₹ {getINR(coins)}</Text>
            <Text style={styles.usdSubText}>≈ ${getUSD(coins)} USD</Text>
          </View>
        ) : (
          <View style={styles.currencyRow}>
            <Text style={styles.rupees}>${getUSD(coins)} USD</Text>
            <Text style={styles.usdSubText}>≈ ₹ {getINR(coins)}</Text>
          </View>
        )}
      </View>

      {/* Withdraw Button */}
      <TouchableOpacity
        style={styles.withdrawMainBtn}
        onPress={() => setShowWithdraw(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="cash-fast" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.withdrawMainText}>Withdraw Coins ({coins} Available)</Text>
        </View>
      </TouchableOpacity>

      {/* History */}
      <Text style={styles.historyTitle}>Withdrawal History</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 110 }}
      />

      {/* Withdraw Modal */}
      <Modal transparent animationType="slide" visible={showWithdraw}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Withdraw Coins</Text>

            {/* Available Coins Card inside Modal */}
            <View style={styles.modalBalanceBox}>
              <Text style={styles.modalBalanceLabel}>Available Coins Balance</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={styles.modalBalanceNumber}>{coins}</Text>
                <Text style={styles.modalBalanceUnit}> Coins</Text>
                <MaterialCommunityIcons name="database" size={20} color="#22c55e" style={{ marginLeft: 6 }} />
              </View>
              <Text style={styles.modalBalanceEquivalent}>
                ≈ {userCountry === "India" ? `₹${getINR(coins)} INR ($${getUSD(coins)} USD)` : `$${getUSD(coins)} USD (₹${getINR(coins)})`}
              </Text>
            </View>

            {/* Quick Coin Chips */}
            <View style={styles.quickChipsRow}>
              {(payoutType === "PayPal" ? [4500, 5000, 10000] : [500, 1000, 2000]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.quickChip, withdrawCoins === String(c) && styles.quickChipActive]}
                  onPress={() => setWithdrawCoins(String(c))}
                >
                  <Text style={[styles.quickChipText, withdrawCoins === String(c) && styles.quickChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.quickChip, withdrawCoins === String(coins) && styles.quickChipActive]}
                onPress={() => setWithdrawCoins(String(Math.min(coins, MAX_WITHDRAW)))}
              >
                <Text style={[styles.quickChipText, withdrawCoins === String(coins) && styles.quickChipTextActive]}>
                  All ({coins})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                placeholder={
                  payoutType === "PayPal"
                    ? "Coins (Min 4500 = $0.48 USD)"
                    : "Coins (Min 500 = ₹5 INR)"
                }
                placeholderTextColor="#777"
                keyboardType="number-pad"
                value={withdrawCoins}
                onChangeText={setWithdrawCoins}
                style={styles.input}
              />

              {/* Live Auto-Conversion Display */}
              {withdrawCoins && !isNaN(parseInt(withdrawCoins)) && parseInt(withdrawCoins) > 0 ? (
                <View style={styles.conversionBox}>
                  <MaterialCommunityIcons
                    name="currency-usd"
                    size={16}
                    color="#38bdf8"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.conversionText}>
                    {payoutType === "PayPal" ? (
                      <>
                        Auto-Converts to: <Text style={styles.conversionValue}>${getUSD(parseInt(withdrawCoins))} USD</Text> (≈ ₹{getINR(parseInt(withdrawCoins))})
                      </>
                    ) : (
                      <>
                        Auto-Converts to: <Text style={styles.conversionValue}>₹{getINR(parseInt(withdrawCoins))} INR</Text> (≈ ${getUSD(parseInt(withdrawCoins))} USD)
                      </>
                    )}
                  </Text>
                </View>
              ) : null}

              <TextInput
                placeholder="Full Name"
                placeholderTextColor="#777"
                value={name}
                onChangeText={setName}
                style={styles.input}
              />
              <TextInput
                placeholder="Mobile Number"
                placeholderTextColor="#777"
                keyboardType="number-pad"
                value={mobile}
                onChangeText={setMobile}
                style={styles.input}
              />
              {/* Payout Method Selector */}
              <View style={styles.payoutSelector}>
                <Text style={styles.payoutLabel}>Payment Method:</Text>
                <View style={styles.payoutToggleRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.payoutToggleBtn, payoutType === "UPI" && styles.payoutToggleActive]}
                    onPress={() => setPayoutType("UPI")}
                  >
                    <MaterialCommunityIcons
                      name="bank-transfer"
                      size={18}
                      color={payoutType === "UPI" ? "#000" : "#94a3b8"}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.payoutToggleText, payoutType === "UPI" && styles.payoutToggleActiveText]}>
                      UPI ID (INR)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.payoutToggleBtn, payoutType === "PayPal" && styles.payoutToggleActive]}
                    onPress={() => setPayoutType("PayPal")}
                  >
                    <MaterialCommunityIcons
                      name="credit-card-outline"
                      size={18}
                      color={payoutType === "PayPal" ? "#000" : "#94a3b8"}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.payoutToggleText, payoutType === "PayPal" && styles.payoutToggleActiveText]}>
                      PayPal (USD)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Min Withdraw Notice */}
                <View style={styles.minNoticeBanner}>
                  <Text style={styles.minNoticeText}>
                    {payoutType === "PayPal"
                      ? "🌐 PayPal (USD): Minimum withdrawal is 4,500 coins ($0.48 USD)"
                      : "🇮🇳 UPI (INR): Minimum withdrawal is 500 coins (₹5.00)"}
                  </Text>
                </View>
              </View>

              <TextInput
                placeholder={payoutType === "UPI" ? "Enter UPI ID (e.g. user@okhdfc)" : "Enter PayPal Email (e.g. user@paypal.com)"}
                placeholderTextColor="#777"
                value={upi}
                onChangeText={setUpi}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={payoutType === "PayPal" ? "email-address" : "default"}
                style={styles.input}
              />

              <Text style={styles.inputHelpText}>
                {payoutType === "UPI"
                  ? "💡 Examples: 9876543210@upi, name@okhdfc, name@paytm"
                  : "💡 Examples: user@paypal.com (Your PayPal registered email)"}
              </Text>

              <TouchableOpacity 
                style={[styles.withdrawBtn, loading && { opacity: 0.7 }]} 
                onPress={withdraw}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.withdrawText}>Submit Withdraw</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowWithdraw(false)}
              >
                <Text style={{ color: "#fff" }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Withdrawal Detail Modal */}
      <Modal transparent animationType="fade" visible={!!selectedTransaction}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailBox}>
            <Text style={styles.detailTitle}>Withdrawal Details</Text>
            
            {selectedTransaction && (
              <View style={{ marginVertical: 15 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailValue, { 
                    color: 
                      selectedTransaction.status === "Paid" ? "#22c55e" : 
                      selectedTransaction.status === "Refunded" ? "#38bdf8" : 
                      (selectedTransaction.status === "Rejected" ? "#ef4444" : "#facc15")
                  }]}>
                    {selectedTransaction.status}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={[styles.detailValue, { color: "#22c55e", fontWeight: "bold" }]}>
                    {selectedTransaction.paymentMethod === "PayPal"
                      ? `$${getUSD(Math.abs(selectedTransaction.coins))} USD (${Math.abs(selectedTransaction.coins)} 🪙)`
                      : `₹${getINR(Math.abs(selectedTransaction.coins))} (${Math.abs(selectedTransaction.coins)} 🪙)`}
                  </Text>
                </View>

                {selectedTransaction.status === "Paid" && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Method:</Text>
                      <Text style={[styles.detailValue, { color: selectedTransaction.paymentMethod === "PayPal" ? "#38bdf8" : "#22c55e", fontWeight: "bold" }]}>
                        {selectedTransaction.paymentMethod === "PayPal" ? "🌐 PayPal" : "🇮🇳 UPI"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Paid At:</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.paidAt ? new Date(selectedTransaction.paidAt).toLocaleString() : (selectedTransaction.date || "Completed")}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        {selectedTransaction.paymentMethod === "PayPal" ? "PayPal Trans ID:" : "UTR ID:"}
                      </Text>
                      <Text style={[styles.detailValue, { color: "#38bdf8", fontWeight: "bold" }]}>
                        {selectedTransaction.utrId || "Confirmed"}
                      </Text>
                    </View>
                  </>
                )}

                {(selectedTransaction.status === "Rejected" || selectedTransaction.status === "Refunded") && (
                  <View style={styles.detailRowVertical}>
                    <Text style={styles.detailLabel}>Reason:</Text>
                    <Text style={[styles.rejectText, selectedTransaction.status === "Refunded" && { color: "#38bdf8", borderColor: "#1e3a8a" }]}>
                      {selectedTransaction.rejectReason || "Invalid payment details"}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Net Value:</Text>
                  <Text style={[styles.detailValue, { color: "#38bdf8", fontWeight: "bold" }]}>
                    {selectedTransaction.paymentMethod === "PayPal"
                      ? `$${getUSD(Math.abs(selectedTransaction.coins))} USD (≈ ₹${getINR(Math.abs(selectedTransaction.coins))})`
                      : `₹${getINR(Math.abs(selectedTransaction.coins))} (≈ $${getUSD(Math.abs(selectedTransaction.coins))} USD)`}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.date}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedTransaction(null)}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Banner */}
      <View style={{ alignItems: "center", marginTop: 5, paddingBottom: 85 }}>
        <AdmobBannerCard asCard={false} />
      </View>
    </SafeAreaView>
  );
}


/* ================== STYLES ================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1f", padding: 12 },

  balanceCard: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  balanceTitle: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  balance: {
    fontSize: 32,
    fontWeight: "800",
    color: "#22c55e",
  },
  countryPillRow: {
    marginBottom: 6,
  },
  countryPill: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  rupees: { color: "#facc15", fontSize: 20, fontWeight: "800" },
  usdSubText: { color: "#38bdf8", fontSize: 14, fontWeight: "700" },
  rateText: { color: "#94a3b8", fontSize: 12, marginTop: 6, textAlign: "center" },

  conversionBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#082f49",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#0284c7",
  },
  conversionText: {
    color: "#bae6fd",
    fontSize: 12,
    flex: 1,
  },
  conversionValue: {
    color: "#38bdf8",
    fontWeight: "900",
    fontSize: 13,
  },

  minNoticeBanner: {
    backgroundColor: "#0f172a",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#38bdf8",
  },
  minNoticeText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },

  withdrawMainBtn: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  withdrawMainText: { color: "#fff", fontWeight: "700" },

  historyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginVertical: 6,
  },

  historyItem: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyType: { color: "#fff", fontWeight: "600" },
  historyDate: { color: "#9ca3af", fontSize: 11 },
  historyCoins: { fontSize: 16, fontWeight: "700" },
  historyCoinsUnit: {
    fontSize: 13,
    fontWeight: "700",
  },

  modalBalanceBox: {
    backgroundColor: "#020617",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  modalBalanceLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  modalBalanceNumber: {
    color: "#22c55e",
    fontSize: 22,
    fontWeight: "800",
  },
  modalBalanceUnit: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "700",
  },
  modalBalanceEquivalent: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  quickChip: {
    flex: 1,
    backgroundColor: "#1e293b",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  quickChipActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  quickChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  quickChipTextActive: {
    color: "#000",
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    width: "90%",
  },
  modalTitle: {
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  input: {
    backgroundColor: "#020617",
    color: "#fff",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },

  payoutSelector: {
    marginTop: 12,
    marginBottom: 4,
  },
  payoutLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  payoutToggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  payoutToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  payoutToggleActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  payoutToggleText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  payoutToggleActiveText: {
    color: "#000",
    fontWeight: "800",
  },
  inputHelpText: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 15,
  },

  withdrawBtn: {
    backgroundColor: "#22c55e",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  withdrawText: { color: "#000", fontWeight: "700" },

  cancelBtn: {
    backgroundColor: "#ef4444",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },

  detailBox: {
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 15,
    width: "85%",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  detailTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 5,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  detailRowVertical: {
    marginVertical: 8,
  },
  detailLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  detailValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  rejectText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
    backgroundColor: "#1a1523",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#451a1a",
  },
  closeBtn: {
    backgroundColor: "#374151",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
});
