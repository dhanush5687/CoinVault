import ReactNativeBiometrics from "react-native-biometrics";

const rnBiometrics = new ReactNativeBiometrics();

export const authenticateBiometric = async () => {
  try {
    const { available } = await rnBiometrics.isSensorAvailable();
    if (!available) return false;

    const { success } = await rnBiometrics.simplePrompt({
      promptMessage: "Unlock using Fingerprint or Face",
    });

    return success;
  } catch {
    return false;
  }
};
