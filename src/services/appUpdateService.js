// appUpdateService.js
// Handles Play Store version check, Firebase remote config, and force update logic

import DeviceInfo from "react-native-device-info";
import database from "@react-native-firebase/database";
import { Linking, Platform } from "react-native";

export const getInstalledVersionInfo = () => {
    const version = DeviceInfo.getVersion() || "1.8";
    const buildNumber = parseInt(DeviceInfo.getBuildNumber() || "3", 10);
    const bundleId = DeviceInfo.getBundleId() || "com.facevaultapp";
    return { version, buildNumber, bundleId };
};

/**
 * Compare two dot-separated version strings (e.g. "1.9" vs "1.8", "2.0.1" vs "2.0.0")
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export const compareVersions = (v1, v2) => {
    if (!v1 && !v2) return 0;
    if (!v1) return -1;
    if (!v2) return 1;

    const clean1 = v1.toString().replace(/[^0-9.]/g, "").split(".").map(n => parseInt(n, 10) || 0);
    const clean2 = v2.toString().replace(/[^0-9.]/g, "").split(".").map(n => parseInt(n, 10) || 0);

    const maxLen = Math.max(clean1.length, clean2.length);
    for (let i = 0; i < maxLen; i++) {
        const num1 = clean1[i] || 0;
        const num2 = clean2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
};

/**
 * Optional scraper fallback: check Google Play Store listing directly
 */
export const fetchPlayStoreVersion = async (packageName) => {
    try {
        const url = `https://play.google.com/store/apps/details?id=${packageName}&hl=en&gl=US`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
            },
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;
        const html = await response.text();

        // Pattern matching for Play Store version string
        const match = html.match(/\[\[\["([0-9]+\.[0-9]+(\.[0-9]+)?)"\]\]/) ||
                      html.match(/Current Version.*?([0-9]+\.[0-9]+(\.[0-9]+)?)/i) ||
                      html.match(/"softwareVersion":\s*"([0-9]+\.[0-9]+(\.[0-9]+)?)"/);

        if (match && match[1]) {
            return match[1];
        }
    } catch (_) {
        // Fallback silently if network or Play Store blocks HTML scraping
    }
    return null;
};

/**
 * Main version check: checks Firebase RTDB config + Play Store scraper fallback
 */
export const checkAppVersionStatus = async () => {
    const { version: installedVersion, buildNumber: installedVersionCode, bundleId } = getInstalledVersionInfo();

    try {
        const ref = database().ref("/app_config/version");
        const snapshot = await ref.once("value");

        let remoteConfig = null;
        if (snapshot.exists()) {
            remoteConfig = snapshot.val();
        } else {
            // Seed initial configuration in Firebase
            remoteConfig = {
                latestVersion: installedVersion,
                latestVersionCode: installedVersionCode,
                minRequiredVersion: installedVersion,
                minRequiredVersionCode: installedVersionCode,
                forceUpdate: false,
                updateUrl: `market://details?id=${bundleId}`,
                playStoreUrl: `https://play.google.com/store/apps/details?id=${bundleId}`,
                title: "Update Available 🚀",
                message: "A new version of CoinVault is available on Google Play Store. Please update now to enjoy the latest features and bug fixes.",
                releaseNotes: "• Real ads playback & continuous ad marathon\n• Performance enhancements & bug fixes\n• Security & wallet improvements",
                lastUpdated: Date.now(),
            };
            await ref.set(remoteConfig).catch(() => {});
        }

        let latestVersion = remoteConfig.latestVersion || installedVersion;
        let latestVersionCode = parseInt(remoteConfig.latestVersionCode || installedVersionCode, 10);
        let minRequiredVersion = remoteConfig.minRequiredVersion || installedVersion;
        let minRequiredVersionCode = parseInt(remoteConfig.minRequiredVersionCode || installedVersionCode, 10);
        let forceUpdateFlag = remoteConfig.forceUpdate === true;

        // Also check Play Store scraper as a secondary source of truth
        const playStoreLiveVer = await fetchPlayStoreVersion(bundleId);
        if (playStoreLiveVer && compareVersions(playStoreLiveVer, latestVersion) > 0) {
            latestVersion = playStoreLiveVer;
        }

        // Compare versions
        const isHigherVersion = compareVersions(latestVersion, installedVersion) > 0;
        const isHigherCode = latestVersionCode > installedVersionCode;
        const isUpdateAvailable = isHigherVersion || isHigherCode;

        // Determine if update is mandatory (force)
        const isBelowMinVer = compareVersions(minRequiredVersion, installedVersion) > 0;
        const isBelowMinCode = installedVersionCode < minRequiredVersionCode;
        const isForceUpdate = isUpdateAvailable && (forceUpdateFlag || isBelowMinVer || isBelowMinCode);

        const marketUrl = remoteConfig.updateUrl || `market://details?id=${bundleId}`;
        const webUrl = remoteConfig.playStoreUrl || `https://play.google.com/store/apps/details?id=${bundleId}`;

        return {
            isUpdateAvailable,
            isForceUpdate,
            installedVersion,
            installedVersionCode,
            latestVersion,
            latestVersionCode,
            minRequiredVersion,
            updateUrl: marketUrl,
            playStoreWebUrl: webUrl,
            title: remoteConfig.title || "Update Required! 🚀",
            message: remoteConfig.message || "A new version of CoinVault is available on Google Play Store. Please update the app to continue.",
            releaseNotes: remoteConfig.releaseNotes || "• Bug fixes & performance improvements\n• Enhanced real ads and continuous playback",
        };
    } catch (e) {
        console.warn("Version check error:", e.message);
        return {
            isUpdateAvailable: false,
            isForceUpdate: false,
            installedVersion,
            installedVersionCode,
            latestVersion: installedVersion,
            latestVersionCode: installedVersionCode,
        };
    }
};

/**
 * Open Play Store app page directly (market:// with fallback to https://)
 */
export const openPlayStore = async (customUrl) => {
    const { bundleId } = getInstalledVersionInfo();
    const marketUrl = customUrl || `market://details?id=${bundleId}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${bundleId}`;

    try {
        const canOpen = await Linking.canOpenURL(marketUrl);
        if (canOpen) {
            await Linking.openURL(marketUrl);
        } else {
            await Linking.openURL(webUrl);
        }
    } catch (_) {
        await Linking.openURL(webUrl);
    }
};

/**
 * Realtime listener for app version changes from Firebase
 */
export const subscribeToVersionUpdates = (onStatusChange) => {
    try {
        const ref = database().ref("/app_config/version");
        const onValueChange = async () => {
            const status = await checkAppVersionStatus();
            onStatusChange(status);
        };
        ref.on("value", onValueChange);

        return () => {
            ref.off("value", onValueChange);
        };
    } catch (e) {
        console.warn("subscribeToVersionUpdates error:", e.message);
        return () => {};
    }
};

/**
 * Fetch raw version config from Firebase RTDB
 */
export const getAppVersionConfig = async () => {
    try {
        const ref = database().ref("/app_config/version");
        const snap = await ref.once("value");
        if (snap.exists()) {
            return snap.val();
        }
        return null;
    } catch (e) {
        console.error("Error fetching version config:", e);
        return null;
    }
};

/**
 * Save / Update version config in Firebase RTDB
 */
export const saveAppVersionConfig = async (newConfig) => {
    try {
        const ref = database().ref("/app_config/version");
        await ref.update({
            ...newConfig,
            lastUpdated: Date.now(),
        });
        return { success: true };
    } catch (e) {
        console.error("Error saving version config:", e);
        return { success: false, error: e.message };
    }
};

