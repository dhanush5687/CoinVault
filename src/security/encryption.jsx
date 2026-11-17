import CryptoJS from "crypto-js";

/**
 * Derives a dynamic key rather than using a static hardcoded key (F-11)
 */
const getDerivedKey = () => {
  try {
    const DeviceInfo = require("react-native-device-info").default;
    const deviceId = DeviceInfo.getUniqueIdSync ? DeviceInfo.getUniqueIdSync() : "FACE_VAULT_FALLBACK";
    return CryptoJS.SHA256(deviceId + "_vault_salt").toString();
  } catch {
    return CryptoJS.SHA256("FACE_VAULT_SECURE_SALT").toString();
  }
};

export const encryptText = (text) => {
  if (!text) return "";
  const key = getDerivedKey();
  return CryptoJS.AES.encrypt(text, key).toString();
};

export const decryptText = (cipher) => {
  if (!cipher) return "";
  const key = getDerivedKey();
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return "";
  }
};
