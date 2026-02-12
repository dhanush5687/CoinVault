import EncryptedStorage from "react-native-encrypted-storage";

/*
 This will store a simple token after successful face setup.
 Later we can replace it with real face embeddings.
*/

export const saveFaceToken = async () => {
  try {
    await EncryptedStorage.setItem("FACE_REGISTERED", "true");
    return true;
  } catch (e) {
    return false;
  }
};

export const isFaceRegistered = async () => {
  try {
    const value = await EncryptedStorage.getItem("FACE_REGISTERED");
    return value === "true";
  } catch (e) {
    return false;
  }
};

export const clearFaceToken = async () => {
  try {
    await EncryptedStorage.removeItem("FACE_REGISTERED");
  } catch (e) {}
};
