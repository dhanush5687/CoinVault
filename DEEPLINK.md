# CoinVault – Android Deep Linking & App Links Guide

This document preserves the deep link configuration for **CoinVault** (`com.facevaultapp`). It details why the web link intent filter was removed, where the digital asset verification file is hosted, and how to re-enable deep linking in the future whenever needed.

---

## 1. Why Was Deep Linking Removed?

### The Google Play Console Error
In Google Play Console under **Deep links > Web links**, the domain `facevaultapp-bb50e.web.app` was reporting:
> **Status: Failed domain checks (1 issue found / 2 issues found)**

### Root Cause
In `android/app/src/main/AndroidManifest.xml`, the `MainActivity` contained an intent filter with `android:autoVerify="true"` for the host `facevaultapp-bb50e.web.app`.
Because the application does not yet host a website or have URL routing implemented in the React Native code, the automated domain checks in Google Play failed.

Removing this unused intent filter removes the domain verification requirement from Google Play Console, clearing the warning completely.

---

## 2. Removed Configuration

The following XML block was removed from `android/app/src/main/AndroidManifest.xml` inside `<activity android:name=".MainActivity" ...>`:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />

    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />

    <data
        android:scheme="https"
        android:host="facevaultapp-bb50e.web.app" />
</intent-filter>
```

---

## 3. Digital Asset Links (Already Configured on Firebase Hosting)

We have already set up and deployed the Digital Asset Links file to Firebase Hosting for your project (`facevaultapp-bb50e`):

- **Local Path**: `public/.well-known/assetlinks.json`
- **Live URL**: `https://facevaultapp-bb50e.web.app/.well-known/assetlinks.json`
- **Firebase Config**: Defined in `firebase.json` under `"hosting"`

### Contents of `public/.well-known/assetlinks.json`:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.facevaultapp",
      "sha256_cert_fingerprints": [
        "95:3F:A3:FD:96:BE:7F:CE:46:EC:21:DD:96:B0:9B:D4:79:6B:55:D6:F0:20:01:F0:CF:A2:AA:5E:DF:FA:B7:D6"
      ]
    }
  }
]
```

> **Note on SHA-256 Fingerprints:**
> - `95:3F:A3:...:B7:D6` is the SHA-256 of your release keystore `CoinVault.jks`.
> - If Google Play App Signing is enabled in Google Play Console (**Setup > App Signing**), Google Play signs production APKs with a Google-managed certificate. The SHA-256 fingerprint shown under **"App signing key certificate"** in Google Play Console should also be added into the `sha256_cert_fingerprints` array.

---

## 4. How to Re-Add Deep Linking in the Future

When you are ready to launch referral links (e.g. `https://facevaultapp-bb50e.web.app/ref/123`), password resets, or web deep links, follow these 4 steps:

### Step 1: Re-add the Intent Filter to `AndroidManifest.xml`
Open `android/app/src/main/AndroidManifest.xml` and insert the intent filter inside `<activity android:name=".MainActivity" ...>`:

```xml
<activity
    android:name=".MainActivity"
    ...
    android:exported="true">

    <!-- Launcher intent filter -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- Deep Link intent filter -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="https"
            android:host="facevaultapp-bb50e.web.app" />
    </intent-filter>
</activity>
```

### Step 2: Ensure Both SHA-256 Fingerprints are in `public/.well-known/assetlinks.json`
If using Google Play App Signing, ensure `public/.well-known/assetlinks.json` contains both fingerprints:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.facevaultapp",
      "sha256_cert_fingerprints": [
        "95:3F:A3:FD:96:BE:7F:CE:46:EC:21:DD:96:B0:9B:D4:79:6B:55:D6:F0:20:01:F0:CF:A2:AA:5E:DF:FA:B7:D6",
        "<GOOGLE_PLAY_APP_SIGNING_SHA256_FROM_PLAY_CONSOLE>"
      ]
    }
  }
]
```

Deploy changes to Firebase:
```bash
npx firebase-tools deploy --only hosting
```

### Step 3: Handle URL Routing in React Native (`App.jsx`)
In `App.jsx`, configure the `linking` object and pass it to `<NavigationContainer>`:

```jsx
const linking = {
  prefixes: ['https://facevaultapp-bb50e.web.app'],
  config: {
    screens: {
      Quiz: 'quiz',
      Wallet: 'wallet',
      MainTabs: 'home',
    },
  },
};

// In App component:
<NavigationContainer linking={linking}>
  ...
</NavigationContainer>
```

### Step 4: Test with ADB
Test that the link opens the app without showing a browser disambiguation dialog:
```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://facevaultapp-bb50e.web.app/quiz" \
  com.facevaultapp
```

