import auth from "@react-native-firebase/auth";
import { saveUserToDB } from "../auth/saveUserToDB";

export const sendFirebaseOTP = async (phone) => {
  return await auth().signInWithPhoneNumber(phone);
};

export const verifyFirebaseOTP = async (confirmation, code) => {
  const result = await confirmation.confirm(code);
  await saveUserToDB(result.user);
  return result.user;
};
