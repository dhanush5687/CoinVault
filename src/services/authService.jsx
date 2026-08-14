// import auth from "@react-native-firebase/auth";
// import database from "@react-native-firebase/database";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export const loginWithEmail = async (email, password) => {
//   const userCred = await auth().signInWithEmailAndPassword(email, password);
//   await saveUserToDB(userCred.user);
// };

// export const signupWithEmail = async (email, password) => {
//   const userCred = await auth().createUserWithEmailAndPassword(email, password);
//   await saveUserToDB(userCred.user);
// };


import database from "@react-native-firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ================= SAVE USER ================= */

export const saveUserToDB = async (user) => {
  const uid = user.uid;

  const userData = {
    uid,
    email: user.email || "",
    mobile: user.phoneNumber || "",
    createdAt: Date.now(),
  };

  const DB_URL = 'https://facevaultapp-bb50e-default-rtdb.firebaseio.com';

  // Save user profile
  await database().refFromURL(`${DB_URL}/users/${uid}`).update(userData);

  // Create wallet if not exists
  const walletRef = database().refFromURL(`${DB_URL}/wallets/${uid}`);
  const snap = await walletRef.once("value");

  if (!snap.exists()) {
    await walletRef.set({
      balance: 0,
      totalEarned: 0,
      lastUpdated: Date.now(),
    });
  }

  // Store UID locally
  await AsyncStorage.setItem("USER_UID", uid);
};
