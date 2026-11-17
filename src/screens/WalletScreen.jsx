

import React, { useEffect, useState } from "react";
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
import { ADMOB_BANNER_ID } from "@env";
import { showAppOpenAd } from "../ads/AppOpenManager";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

const COIN_RATE = 0.01;     // 1 coin = ₹0.01
const MIN_WITHDRAW = 500;  // ₹5
const MAX_WITHDRAW = 10000;// ₹100

export default function WalletScreen() {
  const [coins, setCoins] = useState(0);
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawCoins, setWithdrawCoins] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [upi, setUpi] = useState("");
  const [payoutType, setPayoutType] = useState("UPI");
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

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

      // Fetch Profile for prefill and balance fallback
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance, display_name, mobile, phone, upi_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (!walletSnap.exists()) {
          setCoins(parseFloat(profile.wallet_balance) || 0);
        }
        if (profile.display_name) setName((prev) => prev || profile.display_name);
        if (profile.mobile || profile.phone) setMobile((prev) => prev || profile.mobile || profile.phone);
        if (profile.upi_id) {
          setUpi((prev) => prev || profile.upi_id);
          const savedUpi = profile.upi_id.toLowerCase();
          if (savedUpi.includes("paypal") || (!savedUpi.includes("ok") && !savedUpi.includes("upi") && !savedUpi.includes("paytm") && savedUpi.includes("@"))) {
            setPayoutType("PayPal");
          }
        }
      } else {
        const localProf = await AsyncStorage.getItem("USER_PROFILE");
        if (localProf) {
          const lp = JSON.parse(localProf);
          if (lp.name) setName((prev) => prev || lp.name);
          if (lp.mobile) setMobile((prev) => prev || lp.mobile);
          if (lp.upi) {
            setUpi((prev) => prev || lp.upi);
            if (lp.upi.toLowerCase().includes("paypal")) setPayoutType("PayPal");
          }
        }
      }

      // Fetch Transaction History
      const { data: transactions, error: tError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (transactions) {
        // 3. Fetch current status from Firebase to ensure real-time accuracy for user
        const withdrawQuery = query(ref(db, "/withdraw_requests"), orderByChild("userId"), equalTo(user.id));
        const fbSnap = await get(withdrawQuery);
        const fbData = fbSnap.val() || {};

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
          });
        });

        setHistory(formattedHistory);
        // Persist for offline view
        await AsyncStorage.setItem("COIN_HISTORY", JSON.stringify(formattedHistory));
      }
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

    if (amount < MIN_WITHDRAW) {
      alert(`Minimum withdraw is ${MIN_WITHDRAW} coins (₹5)`);
      return;
    }

    if (amount > MAX_WITHDRAW) {
      alert(`Maximum withdraw is ${MAX_WITHDRAW} coins (₹100)`);
      return;
    }

    if (amount % 500 !== 0) {
      alert("Withdraw only in multiples of 500 (500, 1000, 1500...)");
      return;
    }

    if (amount > coins) {
      alert("Not enough balance");
      return;
    }

    if (!name || !mobile || !upi) {
      alert(`Please enter Name, Mobile & ${payoutType === "PayPal" ? "PayPal ID" : "UPI ID"}`);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      const newBalance = coins - amount;

      // 1. Update Profile Balance
      const { error: pError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", user.id);

      if (pError) throw pError;

      const isPayPal = payoutType === "PayPal" || (upi.includes("@") && !upi.toLowerCase().includes("ok") && !upi.toLowerCase().includes("upi") && !upi.toLowerCase().includes("paytm"));
      const paymentMethod = isPayPal ? "PayPal" : "UPI";

      // 2. Create Transaction Record (Supabase)
      const { data: trans, error: tError } = await supabase
        .from("wallet_transactions")
        .insert([{
          user_id: user.id,
          transaction_type: "Withdrawal",
          amount: -amount,
          balance_after: newBalance,
          description: `Withdrawal via ${paymentMethod}: ${upi}`,
          metadata: { name, mobile, upi, paymentMethod, status: "Pending" }
        }])
        .select()
        .single();

      if (tError) throw tError;

      // 3. Sync to Firebase for Admin Panel Visibility
      try {
        const { getDatabase, ref: fbRef, set, update } = require("@react-native-firebase/database");
        const db = getDatabase();
        await set(fbRef(db, `/withdraw_requests/${trans.id}`), {
          id: trans.id,
          userId: user.id,
          name: name,
          mobile: mobile,
          upi: upi,
          paymentMethod: paymentMethod,
          coins: amount,
          rupees: (amount / 100).toFixed(2), // Assuming 100 coins = 1 Rupee
          status: "Pending",
          date: new Date().toLocaleString(),
          timestamp: Date.now()
        });
        // Also sync user balance to Firebase wallet for legacy support
        await update(fbRef(db, `/wallets/${user.id}`), {
          balance: newBalance,
          lastUpdated: Date.now()
        });
      } catch (fbError) {
        console.warn("Firebase Sync Error:", fbError.message);
        // Don't fail the whole request if only Firebase sync fails
      }

      // Update UI
      setCoins(newBalance);
      const historyItem = {
        id: trans.id,
        type: "Withdrawal",
        coins: -amount,
        status: "Pending",
        date: new Date().toLocaleString(),
      };
      setHistory([historyItem, ...history]);

      setWithdrawCoins("");
      setName("");
      setMobile("");
      setUpi("");
      setShowWithdraw(false);

      alert("Withdraw request submitted successfully!");
    } catch (e) {
      console.log("Withdrawal Error:", e);
      alert("Withdrawal failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const isRefunded = item.status === "Refunded";
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
                color: item.status === "Paid" ? "#22c55e" : 
                       (isRefunded ? "#38bdf8" : (item.status === "Rejected" ? "#ef4444" : "#facc15")),
                fontSize: 12,
                fontWeight: "900",
                textTransform: "uppercase",
              }}
            >
              • {item.status}
            </Text>
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
          <Text
            style={[
              styles.historyCoins,
              { color: isRefunded ? "#38bdf8" : (item.coins > 0 ? "#22c55e" : "#ef4444") },
            ]}
          >
            {isRefunded ? `+${Math.abs(item.coins)}` : (item.coins > 0 ? "+" : "") + item.coins}
          </Text>
          <MaterialCommunityIcons 
            name={isRefunded ? "cash-refund" : "database-arrow-up"} 
            size={16} 
            color={isRefunded ? "#38bdf8" : (item.coins > 0 ? "#22c55e" : "#ef4444")} 
            style={{ marginLeft: 4 }} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Top Banner */}
      <View style={{ alignItems: "center", marginBottom: 5 }}>
        <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
      </View>

      {/* Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitle}>Wallet Balance</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.balance}>{coins}</Text>
          <MaterialCommunityIcons name="database" size={30} color="#22c55e" style={{ marginLeft: 8 }} />
        </View>
        <Text style={styles.rupees}>₹ {(coins * COIN_RATE).toFixed(2)}</Text>
        <Text style={styles.rateText}>
          500 = ₹5 | 1000 = ₹10 | Min 500 | Max 10,000
        </Text>
      </View>

      {/* Withdraw Button */}
      <TouchableOpacity
        style={styles.withdrawMainBtn}
        onPress={() => setShowWithdraw(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="cash-fast" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.withdrawMainText}>Withdraw Coins</Text>
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

            <ScrollView>
              <TextInput
                placeholder="Coins (500, 1000, 1500...)"
                placeholderTextColor="#777"
                keyboardType="number-pad"
                value={withdrawCoins}
                onChangeText={setWithdrawCoins}
                style={styles.input}
              />
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
                      UPI ID
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
                      PayPal ID
                    </Text>
                  </TouchableOpacity>
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
                        {selectedTransaction.paidAt ? new Date(selectedTransaction.paidAt).toLocaleString() : "N/A"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        {selectedTransaction.paymentMethod === "PayPal" ? "PayPal Trans ID:" : "UTR ID:"}
                      </Text>
                      <Text style={[styles.detailValue, { color: "#38bdf8", fontWeight: "bold" }]}>
                        {selectedTransaction.utrId || "Processing"}
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
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.detailValue}>{Math.abs(selectedTransaction.coins)} 🪙 (₹{(Math.abs(selectedTransaction.coins) * 0.01).toFixed(2)})</Text>
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
        <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
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
  balanceTitle: { color: "#9ca3af" },
  balance: { fontSize: 30, fontWeight: "700", color: "#22c55e" },
  rupees: { color: "#facc15", marginTop: 4 },
  rateText: { color: "#38bdf8", fontSize: 12, marginTop: 4 },

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
