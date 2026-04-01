

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
} from "react-native";
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
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  // Show App Open on Focus
  useFocusEffect(
    useCallback(() => {
      showAppOpenAd();
      fetchWalletData();
    }, [])
  );

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Wallet Balance from Firebase (Primary Source of Truth)
      const database = require("@react-native-firebase/database").default;
      const walletSnap = await database().ref(`/wallets/${user.id}`).once("value");

      if (walletSnap.exists()) {
        const walletData = walletSnap.val();
        setCoins(parseFloat(walletData.balance) || 0);
      } else {
        // Fallback to Supabase if Firebase wallet doesn't exist yet
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", user.id)
          .single();

        if (profile) {
          setCoins(parseFloat(profile.wallet_balance) || 0);
        }
      }

      // Fetch Transaction History
      const { data: transactions, error: tError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (transactions) {
        // Map to expected UI format
        const formattedHistory = await Promise.all(transactions.map(async (t) => {
          let status = "Completed";
          let rejectReason = null;

          if (t.transaction_type === "Withdrawal") {
            // 1. Default from Supabase Metadata
            if (t.metadata && t.metadata.status) {
              status = t.metadata.status;
              rejectReason = t.metadata.rejectReason;
            } else {
              status = "Pending"; // Default if missing
            }

            // 2. Cross-check Firebase for authoritative status (Source of Truth for Admin)
            // This handles cases where Supabase update failed (e.g. RLS) but Firebase updated successfully
            if (status === "Pending") {
              try {
                const fbSnap = await database().ref(`/withdraw_requests/${t.id}/status`).once('value');
                if (fbSnap.exists()) {
                  status = fbSnap.val();
                  // Also check for reason if rejected
                  if (status === "Rejected") {
                    const reasonSnap = await database().ref(`/withdraw_requests/${t.id}/rejectReason`).once('value');
                    if (reasonSnap.exists()) rejectReason = reasonSnap.val();
                  }

                  // Check for paidAt if paid
                  if (status === "Paid") {
                    const metaSnap = await database().ref(`/withdraw_requests/${t.id}`).once('value');
                    if (metaSnap.exists() && metaSnap.val().paidAt) {
                      // Although we don't strictly need it here if we just use current date, but let's try to get it
                    }
                  }
                }
              } catch (e) {
                console.log("Firebase Check Error:", e);
              }
            }
          }

          return {
            id: t.id,
            type: t.transaction_type,
            coins: parseFloat(t.amount),
            status: status,
            rejectReason: rejectReason,
            rejectReason: rejectReason,
            date: new Date(t.created_at).toLocaleString(),
            // Pass extra metadata for details modal
            details: {
              name: t.metadata?.name || "N/A",
              mobile: t.metadata?.mobile || "N/A",
              upi: t.metadata?.upi || "N/A",
              paidAt: t.metadata?.paidAt ? new Date(t.metadata.paidAt).toLocaleString() : null
            }
          };
        }));
        setHistory(formattedHistory);
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
    const local = await AsyncStorage.getItem("COIN_HISTORY");
    if (!local) return;

    let list = JSON.parse(local);

    list.forEach((item) => {
      if (item.type === "Withdraw" && item.id) {
        const ref = database().ref(`/withdraw_requests/${item.id}`);
        ref.off();

        ref.on("value", async (snap) => {
          if (snap.exists()) {
            const data = snap.val();
            list = list.map((h) =>
              h.id === item.id ? { ...h, status: data.status } : h
            );
          } else {
            // Admin deleted → remove from user history
            list = list.filter((h) => h.id !== item.id);
          }

          await AsyncStorage.setItem("COIN_HISTORY", JSON.stringify(list));
          setHistory([...list]);
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
      alert("Enter Name, Mobile & UPI ID");
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

      // 2. Create Transaction Record (Supabase)
      const { data: trans, error: tError } = await supabase
        .from("wallet_transactions")
        .insert([{
          user_id: user.id,
          transaction_type: "Withdrawal",
          amount: -amount,
          balance_after: newBalance,
          description: `Withdrawal via UPI: ${upi}`,
          metadata: { name, mobile, upi, status: "Pending" }
        }])
        .select()
        .single();

      if (tError) throw tError;

      // 3. Sync to Firebase for Admin Panel Visibility
      try {
        const database = require("@react-native-firebase/database").default;
        await database().ref(`/withdraw_requests/${trans.id}`).set({
          id: trans.id,
          userId: user.id,
          name: name,
          mobile: mobile,
          upi: upi,
          coins: amount,
          rupees: (amount / 100).toFixed(2), // Assuming 100 coins = 1 Rupee
          status: "Pending",
          date: new Date().toLocaleString(),
          timestamp: Date.now()
        });
        // Also sync user balance to Firebase wallet for legacy support
        await database().ref(`/wallets/${user.id}`).update({
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

  const handleItemPress = (item) => {
    setSelectedTransaction(item);
    setDetailsModalVisible(true);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.historyItem} onPress={() => handleItemPress(item)}>
      <View>
        <Text style={styles.historyType}>{item.type}</Text>
        <Text style={styles.historyDate}>{item.date}</Text>
        {item.type === "Withdrawal" && (
          <View>
            <Text
              style={{
                color: item.status === "Paid" ? "#22c55e" : (item.status === "Rejected" ? "#ef4444" : "#facc15"),
                fontSize: 12,
                fontWeight: "600"
              }}
            >
              {item.status}
            </Text>
            {item.rejectReason && (
              <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                ⚠️ {item.rejectReason}
              </Text>
            )}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={[
            styles.historyCoins,
            { color: item.coins > 0 ? "#22c55e" : "#ef4444" },
          ]}
        >
          {item.coins > 0 ? "+" : ""}
          {item.coins}
        </Text>
        <MaterialCommunityIcons name="database-arrow-up" size={16} color={item.coins > 0 ? "#22c55e" : "#ef4444"} style={{ marginLeft: 4 }} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
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
        contentContainerStyle={{ paddingBottom: 40 }}
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
              <TextInput
                placeholder="UPI ID"
                placeholderTextColor="#777"
                value={upi}
                onChangeText={setUpi}
                style={styles.input}
              />

              <TouchableOpacity style={styles.withdrawBtn} onPress={withdraw}>
                <Text style={styles.withdrawText}>Submit Withdraw</Text>
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

      {/* Bottom Banner */}
      <View style={{ alignItems: "center", marginTop: 5 }}>
        <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
      </View>
      {/* Transaction Details Modal */}
      <Modal transparent animationType="fade" visible={detailsModalVisible} onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalBox}>
            <Text style={styles.modalTitle}>Transaction Details</Text>

            {selectedTransaction && (
              <View style={{ marginTop: 15 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.type}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailValue, { color: selectedTransaction.status === "Paid" ? "#22c55e" : (selectedTransaction.status === "Rejected" ? "#ef4444" : "#facc15") }]}>
                    {selectedTransaction.status}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={[styles.detailValue, { color: '#ef4444' }]}>{Math.abs(selectedTransaction.coins)} Coins</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.date}</Text>
                </View>

                {selectedTransaction.type === "Withdrawal" && selectedTransaction.details && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Name:</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.details.name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Mobile:</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.details.mobile}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>UPI ID:</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.details.upi}</Text>
                    </View>

                    {selectedTransaction.status === "Rejected" && selectedTransaction.rejectReason && (
                      <View style={[styles.detailRow, { marginTop: 10 }]}>
                        <Text style={[styles.detailLabel, { color: '#ef4444' }]}>Reason:</Text>
                        <Text style={[styles.detailValue, { color: '#ef4444' }]}>{selectedTransaction.rejectReason}</Text>
                      </View>
                    )}

                    {selectedTransaction.status === "Paid" && selectedTransaction.details.paidAt && (
                      <View style={[styles.detailRow, { marginTop: 10 }]}>
                        <Text style={[styles.detailLabel, { color: '#22c55e' }]}>Paid At:</Text>
                        <Text style={[styles.detailValue, { color: '#22c55e' }]}>{selectedTransaction.details.paidAt}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.withdrawBtn} onPress={() => setDetailsModalVisible(false)}>
              <Text style={styles.withdrawText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
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
  detailsModalBox: {
    backgroundColor: "#1e293b",
    padding: 20,
    borderRadius: 16,
    width: "85%",
    borderWidth: 1,
    borderColor: "#334155"
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  detailLabel: {
    color: "#94a3b8",
    fontWeight: "600",
    fontSize: 14
  },
  detailValue: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textAlign: 'right',
    maxWidth: '60%'
  },
  divider: {
    height: 1,
    backgroundColor: "#334155",
    marginVertical: 12
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
});
