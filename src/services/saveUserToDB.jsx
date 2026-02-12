// auth/saveUserToDB.js
import database from "@react-native-firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const saveUserToDB = async (user) => {
  const uid = user.uid;

  const userRef = database().ref(`users/${uid}`);
  const snap = await userRef.once("value");

  if (!snap.exists()) {
    await userRef.set({
      uid,
      name: user.displayName || "",
      email: user.email || "",
      mobile: user.phoneNumber || "",
      createdAt: Date.now(),
    });
  }

  const walletRef = database().ref(`wallets/${uid}`);
  const walletSnap = await walletRef.once("value");

  if (!walletSnap.exists()) {
    await walletRef.set({
      balance: 0,
      totalEarned: 0,
      lastUpdated: Date.now(),
    });
  }

  await AsyncStorage.setItem("USER_UID", uid);
};
