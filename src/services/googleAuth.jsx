import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import database from "@react-native-firebase/database";

GoogleSignin.configure({
  webClientId: "YOUR_FIREBASE_WEB_CLIENT_ID",
});

export const googleLogin = async () => {
  const { idToken } = await GoogleSignin.signIn();
  const googleCred = auth.GoogleAuthProvider.credential(idToken);

  const userCred = await auth().signInWithCredential(googleCred);
  await saveGoogleUser(userCred.user);
};

const saveGoogleUser = async (user) => {
  const uid = user.uid;

  await database().ref(`users/${uid}`).update({
    uid,
    name: user.displayName,
    email: user.email,
    profileImage: user.photoURL,
    createdAt: Date.now(),
  });
};
