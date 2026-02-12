// import auth from "@react-native-firebase/auth";

// export const sendOTP = async (mobile) => {
//   const confirmation = await auth().signInWithPhoneNumber(`+91${mobile}`);
//   return confirmation;
// };

// export const verifyOTP = async (confirm, code) => {
//   const userCred = await confirm.confirm(code);
//   return userCred.user;
// };

// const user = await verifyOTP(confirm, code);
// await database().ref(`users/${user.uid}`).update({
//   uid: user.uid,
//   mobile: user.phoneNumber,
//   createdAt: Date.now(),
// });

import auth from "@react-native-firebase/auth";
import { saveUserToDB } from "../auth/saveUserToDB";

const sendOTP = async (phone) => {
  const confirmation = await auth().signInWithPhoneNumber(phone);
  setConfirm(confirmation);
};

const verifyOTP = async (code) => {
  const result = await confirm.confirm(code);
  await saveUserToDB(result.user);
  navigation.replace("MainTabs");
};
