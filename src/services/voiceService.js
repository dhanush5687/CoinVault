import { NativeModules, PermissionsAndroid, Platform, Alert } from "react-native";

const { VoiceModule } = NativeModules;

/**
 * Request Microphone permission on Android
 */
export const requestAudioPermission = async () => {
    if (Platform.OS !== "android") return true;

    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
                title: "Microphone Access Required",
                message: "CoinVault needs access to your microphone to record and send voice messages to support.",
                buttonPositive: "Grant Permission",
                buttonNegative: "Cancel",
            }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
        console.warn("Audio permission error:", err);
        return false;
    }
};

/**
 * Start recording voice note
 */
export const startVoiceRecording = async () => {
    if (!VoiceModule) {
        Alert.alert("Error", "Voice recording module is not available on this platform.");
        return { success: false, error: "Module unavailable" };
    }

    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
        Alert.alert("Permission Denied", "Microphone permission is required to record voice notes.");
        return { success: false, error: "Permission denied" };
    }

    try {
        const filePath = await VoiceModule.startRecording();
        return { success: true, filePath };
    } catch (e) {
        console.error("Start recording error:", e);
        return { success: false, error: e.message || "Failed to start recording" };
    }
};

/**
 * Stop recording and get base64 audio data URL
 */
export const stopVoiceRecording = async () => {
    if (!VoiceModule) return { success: false, error: "Module unavailable" };
    try {
        const audioData = await VoiceModule.stopRecording();
        return { success: true, audioData };
    } catch (e) {
        console.error("Stop recording error:", e);
        return { success: false, error: e.message || "Failed to stop recording" };
    }
};

/**
 * Cancel current recording
 */
export const cancelVoiceRecording = async () => {
    if (!VoiceModule) return;
    try {
        await VoiceModule.cancelRecording();
    } catch (e) {
        console.warn("Cancel recording error:", e);
    }
};

/**
 * Play audio from data URL or path
 */
export const playVoiceAudio = async (audioData) => {
    if (!VoiceModule) {
        Alert.alert("Playback", "Voice playback is not supported on this platform.");
        return { success: false };
    }
    try {
        const duration = await VoiceModule.playAudio(audioData);
        return { success: true, duration };
    } catch (e) {
        console.error("Play audio error:", e);
        return { success: false, error: e.message };
    }
};

/**
 * Stop currently playing audio
 */
export const stopVoiceAudio = async () => {
    if (!VoiceModule) return;
    try {
        await VoiceModule.stopAudio();
    } catch (e) {
        console.warn("Stop audio error:", e);
    }
};

