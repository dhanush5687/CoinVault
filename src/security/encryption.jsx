import CryptoJS from "crypto-js";

const SECRET_KEY = "FACE_VAULT_SECRET_2026";

export const encryptText = (text) => {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

export const decryptText = (cipher) => {
  const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
