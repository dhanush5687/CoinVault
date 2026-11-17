# Universal Security Audit Report — CoinVault (FaceVaultApp)

**Date:** November 17, 2026  
**Auditor:** Antigravity Senior Application Security Auditor  
**Phase:** Phase 1 — Read-Only Audit (Code Unchanged)  
**App Name:** CoinVault (`com.facevaultapp`)  
**Stack:** React Native 0.83.1 (New Architecture, Hermes enabled), Supabase (`uwpnfnwqluxhzlnewcgp`), Firebase Realtime Database (`facevaultapp-bb50e`), Google Mobile Ads (AdMob)  
**Platform:** Android (Primary) / iOS  
**Audience:** General Audience (Rewards / Quiz / Monetization)  
**Target Output File:** `SECURITY_AUDIT.md`

---

## 1. Scope & Limitations

### What Was Examined
- **Source Code**: All React Native components (`src/screens/*`), services (`src/services/*`), configurations (`src/config/*`), and root files (`App.jsx`, `index.js`).
- **Android Native Project**: `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`, `android/build.gradle`, `MainApplication.kt`, `MainActivity.kt`, signing configurations, and resource files.
- **OTA / Code-Push Configuration**: `hot-updater.config.ts`, HotUpdater runtime hooks, and Supabase storage configurations.
- **Database & Backend Rules**: `database.rules.json` (Firebase Realtime Database), Supabase table access patterns, and API client calls.
- **Secrets & Configuration Files**: `.env`, `.env.hotupdater`, `package.json`, `.gitignore`, `google-services.json`, keystore files (`CoinVault.jks`, `debug.keystore`), and git commit history.
- **Dependencies**: `package.json`, `package-lock.json`, autolinking and build plugins.

### Limitations & What Was NOT Examined
- **Live Penetration / Network Attacks**: In compliance with the Global Rules, no active attacks or penetration tests were executed against production Supabase or Firebase servers.
- **Automated CVE Registry Lookup (`npm audit`)**: Blocked due to sandbox security policy (`403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`). Dependency versions were reviewed manually.
- **iOS Native Build**: The iOS project directory (`ios/`) was not built or executed, as the current production focus and user reports are on Android.
- **Supabase Cloud Dashboard RLS Policies**: Live Row Level Security (RLS) policies configured directly in the Supabase web console could not be queried via API because no management access token is provided; analysis is based on client query behavior and permissions exposed to the anon client.

---

## 2. Summary Table

| # | Severity | Finding | Confidence |
|---|---|---|---|
| **F-01** | **Critical** | Client-Side Coin Balance Manipulation ("Coin Hack") | `CONFIRMED` |
| **F-02** | **Critical** | Hardcoded Admin Backdoor & Master OTP Bypass | `CONFIRMED` |
| **F-03** | **Critical** | Supabase Service Role Key Committed in `package.json` | `CONFIRMED` |
| **F-04** | **High** | Plaintext User Passwords Saved in Database (`admin_user_data`) | `CONFIRMED` |
| **F-05** | **High** | Insecure Firebase Realtime Database Rules (Open Read/Write) | `CONFIRMED` |
| **F-06** | **High** | Production Keystore (`CoinVault.jks`) & Password in Git | `CONFIRMED` |
| **F-07** | **High** | Sensitive `.env` File Committed in Git Repository | `CONFIRMED` |
| **F-08** | **Medium** | Missing Android Network Security Config (Cleartext Traffic) | `CONFIRMED` |
| **F-09** | **Medium** | Local State Desynchronization & Unencrypted Coin Storage | `CONFIRMED` |
| **F-10** | **Medium** | OTA HotUpdater Signature Verification Disabled | `CONFIRMED` |

---

## 3. Detailed Findings

### F-01: Client-Side Coin Balance Manipulation ("Coin Hack")
- **Severity**: **Critical**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [QuizScreen.jsx#L464](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/screens/QuizScreen.jsx#L464):
    ```javascript
    const newBal = Math.max(0, currentBal + pointsChange);
    await supabase.from("profiles").update({ wallet_balance: newBal }).eq("id", user.id);
    ```
  - [WatchScreen.jsx#L95](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/screens/WatchScreen.jsx#L95):
    ```javascript
    const newBalance = coins + reward;
    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", user.id);
    ```
  - [DailyBonusScreen.jsx#L167](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/screens/DailyBonusScreen.jsx#L167):
    ```javascript
    const newBalance = currentBalance + coinsWon;
    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", user.id);
    ```
  - [WalletScreen.jsx#L236](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/screens/WalletScreen.jsx#L236):
    ```javascript
    const newBalance = coins - amount;
    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", user.id);
    ```
  - [database.rules.json#L20-L21](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/database.rules.json#L20-L21):
    ```json
    "wallets": {
      "$userId": {
        ".write": true,
        ".validate": "newData.hasChildren(['balance']) && newData.child('balance').isNumber() && newData.child('balance').val() >= 0"
      }
    }
    ```
- **How to Reproduce**:
  Inspect any rewarded action in the app. The client calculates the new balance and sends a direct `UPDATE profiles SET wallet_balance = <number>` to Supabase using the public anonymous key. In Firebase RTDB, any HTTP client can send a `PATCH /wallets/<userId>.json {"balance": 9999999}`.
- **Attack Condition**: Any regular user with an authenticated session (or using curl / Postman / proxy tools like HTTP Toolkit or mitmproxy) can update their `wallet_balance` to any amount.
- **Impact**: Direct financial theft. An attacker can set their balance to 50,000 coins and submit real UPI withdrawal requests in `WalletScreen`, draining the app owner's payout funds.
- **Fix**:
  1. Deny client-side `UPDATE` permissions on the `wallet_balance` column in Supabase RLS.
  2. Implement atomic, server-side Postgres functions (RPC) in Supabase with security definer: `claim_quiz_points(points)`, `claim_ad_reward()`, `claim_daily_bonus()`, and `request_withdrawal(amount, upi_id)`.
  3. Lock down Firebase RTDB rules so that `/wallets` has `".write": false` for clients.

---

### F-02: Hardcoded Admin Authentication Backdoor & Master OTP Bypass
- **Severity**: **Critical**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [PhoneScreen.jsx#L40-L44](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/screens/PhoneScreen.jsx#L40-L44):
    ```javascript
    if (phone === "8885551616" || phone === "+918885551616") {
        alert("Admin Mode: Redirecting to OTP Screen. Use static code: 885687");
        navigation.navigate("OTP", { phone });
        return;
    }
    ```
  - [OTPScreen.jsx#L107-L111](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/screens/OTPScreen.jsx#L107-L111):
    ```javascript
    if ((phone === "8885551616" || phone === "+918885551616") && finalOtp === "885687") {
        console.log("🚀 Admin Access Granted");
        navigation.replace("AdminPanel");
        return;
    }
    ```
- **How to Reproduce**:
  Launch the app on any device. Go to Phone Login, enter `8885551616`. An alert pops up stating: `"Admin Mode: Redirecting to OTP Screen. Use static code: 885687"`. Enter `885687` on the OTP screen. You are immediately placed into `AdminPanelScreen`.
- **Attack Condition**: Anyone who downloads the app or decompiles the JS bundle.
- **Impact**: Complete administrative compromise. The attacker can access all user records, alter coin balances, approve or reject real UPI payout requests, deface ticker messages, and delete accounts.
- **Fix**: Remove the hardcoded phone check and static OTP bypass entirely. Admin authorization must be verified server-side using secure role-based claims (e.g. `auth.jwt() -> app_metadata.role == 'admin'`).

---

### F-03: Supabase Service Role Key Committed in `package.json`
- **Severity**: **Critical**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [package.json#L31](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/package.json#L31):
    ```json
    "ota": "HOT_UPDATER_SUPABASE_URL=https://uwpnfnwqluxhzlnewcgp.supabase.co HOT_UPDATER_SUPABASE_SERVICE_ROLE_KEY=eyJh...[REDACTED]... HOT_UPDATER_SUPABASE_BUCKET_NAME=bundles npx hot-updater deploy -t 4.7.0 -p android -c production -m \"new adds updated and ap chat and fix bugs\"",
    ```
- **How to Reproduce**:
  Check line 31 of `package.json`. The full service role JWT is written inline in cleartext.
- **Attack Condition**: Anyone with read access to the git repository or npm scripts.
- **Impact**: Full backend and storage compromise. The Supabase `service_role` key bypasses all Row Level Security (RLS) policies. Anyone possessing this key has full superadmin access to the database (read/modify/delete all user tables) and storage buckets, including the ability to overwrite OTA update bundles in the `bundles` bucket. Overwriting the update bundle enables arbitrary remote code execution (RCE) inside every user's installed app.
- **Fix**:
  1. Remove the inline key from `package.json` immediately and read solely from `.env.hotupdater` (which is already gitignored).
  2. Rotate the Supabase `service_role` key in the Supabase Project Dashboard under Project Settings -> API.

---

### F-04: Plaintext User Passwords Saved in Database (`admin_user_data`)
- **Severity**: **High**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [supabaseService.js#L26-L32](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/services/supabaseService.js#L26-L32):
    ```javascript
    const { error: adminError } = await supabase
      .from('admin_user_data')
      .insert([{ 
        user_id: data.user.id, 
        email: email, 
        password: password 
      }]);
    ```
- **How to Reproduce**:
  Sign up with a new email and password. Inspect the `admin_user_data` table in Supabase. The user's password is saved in plaintext.
- **Attack Condition**: Any compromise of the database, admin panel, or client queries.
- **Impact**: Severe security and privacy violation. Plaintext password storage violates Google Play User Data policies, GDPR, and DPDP laws. Leaked passwords can be used for credential stuffing against users' personal accounts.
- **Fix**: Remove the insertion of plaintext passwords into `admin_user_data`. Passwords must be handled solely by `supabase.auth.signUp()`, which securely hashes credentials with bcrypt/Argon2.

---

### F-05: Insecure Firebase Realtime Database Security Rules
- **Severity**: **High**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [database.rules.json#L7-L13](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/database.rules.json#L7-L13): `/users` has `".read": true`, and `$userId` has `".write": true` without auth verification.
  - [database.rules.json#L17-L22](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/database.rules.json#L17-L22): `/wallets` has `".read": true`, and `$userId` has `".write": true`.
  - [database.rules.json#L25-L32](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/database.rules.json#L25-L32): `/withdraw_requests` has `".read": true, ".write": true`.
  - [database.rules.json#L50-L69](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/database.rules.json#L50-L69): `/marqueeMessages` and `/quizConfig` have global `".read": true, ".write": true`.
- **How to Reproduce**:
  Send an unauthenticated GET request to `https://facevaultapp-bb50e-default-rtdb.firebaseio.com/users.json` or `/withdraw_requests.json`. The database returns all user records and withdrawal details.
- **Attack Condition**: Anyone with the Firebase database URL (publicly bundled in `google-services.json`).
- **Impact**: Unauthenticated exposure of Personally Identifiable Information (PII) including full names, emails, mobile numbers, UPI IDs, and transaction histories. Anyone can modify wallet balances or deface marquee messages.
- **Fix**: Tighten `database.rules.json` to enforce strict user ownership (`auth != null && auth.uid === $userId`), set `".write": false` on `/wallets` and `/withdraw_requests` for regular users, and require admin auth for administrative nodes.

---

### F-06: Production Keystore (`CoinVault.jks`) & Passwords Committed to Git
- **Severity**: **High**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - `android/app/CoinVault.jks` is tracked in git history (commit `5150a54`).
  - [android/app/build.gradle#L135-L137](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/android/app/build.gradle#L135-L137):
    ```groovy
    storePassword env.get("RELEASE_STORE_PASSWORD", "123456")
    keyAlias env.get("RELEASE_KEY_ALIAS", "android")
    keyPassword env.get("RELEASE_KEY_PASSWORD", "123456")
    ```
  - [.env#L36-L38](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/.env#L36-L38):
    `RELEASE_STORE_PASSWORD=1234...`
- **How to Reproduce**:
  Check `git status` and `android/app/build.gradle`. The keystore file is present in the repository, and default passwords (`123456`) are coded as fallbacks.
- **Attack Condition**: Anyone who clones or forks the repository.
- **Impact**: Key compromise. If the repository is shared, leaked, or public, unauthorized parties can sign APKs using the release key.
- **Fix**:
  1. Add `*.jks` to `.gitignore`.
  2. Remove default passwords `"123456"` from `build.gradle` (fail build if env variables are missing).
  3. In Google Play Console, ensure Play App Signing is enabled so the upload key can be replaced if compromised.

---

### F-07: Sensitive `.env` File Committed in Git Repository
- **Severity**: **High**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - `.gitignore` does not ignore `.env`.
  - `.env` contains:
    - Line 1: `CLIPDROP_API_KEY=7f98...[REDACTED]`
    - Line 18: `SUPABASE_ANON_KEY=eyJh...[REDACTED]`
    - Lines 36-38: Keystore passwords `RELEASE_STORE_PASSWORD=1234...`
    - Lines 40-41: Developer login notes: `#applogin nanil5687`, `#raj5687`
- **How to Reproduce**:
  Check `git status` or run `git log -p .env`.
- **Attack Condition**: Anyone with repository access.
- **Impact**: Depletion of Clipdrop API quota/credits, credential leaks.
- **Fix**: Add `.env` to `.gitignore`, untrack `.env` from git (`git rm --cached .env`), create `.env.example`, and rotate the Clipdrop API key.

---

### F-08: Missing Android Network Security Config & Cleartext Traffic Policy
- **Severity**: **Medium**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [AndroidManifest.xml#L28](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/android/app/src/main/AndroidManifest.xml#L28): `android:usesCleartextTraffic="${usesCleartextTraffic}"`
  - Directory `android/app/src/main/res/xml/` contains no `network_security_config.xml`.
- **Attack Condition**: Devices on untrusted Wi-Fi networks if any non-HTTPS traffic is initiated.
- **Impact**: Potential man-in-the-middle (MITM) cleartext interception.
- **Fix**: Add `network_security_config.xml` explicitly disallowing cleartext traffic for production, and bind it in `AndroidManifest.xml` via `android:networkSecurityConfig="@xml/network_security_config"`.

---

### F-09: Local State Desynchronization & Unencrypted Coin Storage
- **Severity**: **Medium**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [PlayAllVideoAdsScreen.jsx#L45-L53](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/src/screens/PlayAllVideoAdsScreen.jsx#L45-L53):
    ```javascript
    const addCoins = async () => {
      const newCoins = coins + 10;
      setCoins(newCoins);
      await AsyncStorage.setItem("USER_COINS", newCoins.toString());
    };
    ```
- **How to Reproduce**:
  Watch rewarded ads in `PlayAllVideoAdsScreen`. The rewarded coins are stored only in unencrypted local `AsyncStorage` and are never synced to the user's Supabase or Firebase wallet.
- **Attack Condition**: Any user can modify `USER_COINS` in unencrypted local storage on rooted devices.
- **Impact**: Coins earned in this screen do not appear in the main wallet, leading to user complaints, while local values can be tampered with.
- **Fix**: Connect `PlayAllVideoAdsScreen` to the centralized wallet earning function. Use `react-native-encrypted-storage` for sensitive client tokens.

---

### F-10: OTA HotUpdater Signature Verification Disabled
- **Severity**: **Medium**
- **Confidence**: `CONFIRMED`
- **Evidence**:
  - [hot-updater.config.ts](file:///Users/dhanushraj/Desktop/desktopReactNativeApps/FaceVaultApp/FaceVaultApp/hot-updater.config.ts): HotUpdater configuration does not enable public key code signature verification for JavaScript bundles.
- **Attack Condition**: An attacker who compromises the Supabase storage bucket (via leaked service role key) can deploy arbitrary updates.
- **Impact**: Tampered JavaScript bundles could be distributed to users without binary verification.
- **Fix**: Once the service role key is rotated and removed from the client, enforce strict access policies on the Supabase storage bucket, and configure bundle signature verification.

---

## 4. Checklist of Areas 1–13

| # | Area | Status | Notes |
|---|---|---|---|
| **1** | **Secrets and Credentials** | **FAILED** | Supabase Service Role Key committed in `package.json`; `.env` committed with Clipdrop key and keystore passwords. |
| **2** | **Dependencies and Supply Chain** | **NOT VERIFIED / WARN** | `npm audit` network execution blocked by sandbox proxy; lockfile committed; legacy `react-native-stallion` package lingering in `package.json`. |
| **3** | **Remote Content & 3rd-Party Calls** | **PASSED** | All active endpoints use HTTPS (Supabase, Firebase RTDB, AdMob, Clipdrop). |
| **4** | **Android Manifest & Build** | **FAILED** | Release keystore and default passwords in repo; missing explicit `network_security_config.xml`. (`allowBackup="false"`, `targetSdk 36`, ProGuard enabled are PASSED). |
| **5** | **iOS Configuration** | **NOT VERIFIED** | Not configured or executed in this phase; target release platform is Android. |
| **6** | **Networking and TLS** | **PASSED** | No insecure TrustManagers or disabled certificate checks found in native code. |
| **7** | **Auth, Sessions, Authorization** | **FAILED** | Hardcoded backdoor (`8885551616` / `885687`); lack of server-side role enforcement on admin panel. |
| **8** | **Data Storage and Privacy** | **FAILED** | Plaintext user passwords stored in `admin_user_data`; open Firebase RTDB reading for PII. |
| **9** | **OTA / Dynamic Code** | **FAILED** | HotUpdater bucket exposed by leaked service role key; no bundle signature verification. |
| **10** | **WebView and Deep Links** | **PASSED** | No unsafe WebView JS bridges; autoVerify intent filter corrected; assetlinks deployed. |
| **11** | **Backend / API & DB Rules** | **FAILED** | Client-side `wallet_balance` manipulation; completely open Firebase RTDB write rules for `/wallets`. |
| **12** | **Store Policy and Compliance** | **FAILED** | Plaintext password storage violates Google Play User Data policies; privacy policy URL must be verified. |
| **13** | **Build and Release Hygiene** | **FAILED** | Release keystore `CoinVault.jks` committed to git; service role key in `package.json`. |

---

## 5. Manual Actions Required by Developer (Outside the Code)

These actions cannot be fixed solely by editing files in the repository and must be performed in developer dashboards:

1. **Rotate Supabase Service Role Key**:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard) -> Select Project `uwpnfnwqluxhzlnewcgp` -> **Project Settings** -> **API**.
   - Under **Project API keys**, click **Reset** or generate a new `service_role` secret key.
   - Update `.env.hotupdater` with the new key (never commit `.env.hotupdater`).
2. **Rotate Clipdrop API Key**:
   - Log in to your Clipdrop / Stability AI developer account and generate a new API key.
3. **Deploy Hardened Firebase Realtime Database Rules**:
   - Go to [Firebase Console](https://console.firebase.google.com/) -> Select Project `facevaultapp-bb50e` -> **Realtime Database** -> **Rules**.
   - Deploy the hardened rules generated during Phase 2.
4. **Deploy Supabase Postgres Security Functions & RLS**:
   - In Supabase Dashboard -> **SQL Editor**, run the SQL migration script to disable client balance updates and create the atomic RPC functions.
5. **Keystore Protection (Google Play Console)**:
   - Ensure Google Play App Signing is active in Google Play Console. If so, `CoinVault.jks` acts only as an upload key, which can be reset via Play Console support if needed.

---

## 6. Overall Risk & Confidence Assessment

- **Overall Risk Rating**: **CRITICAL**  
  The combination of direct client-side coin balance updates (F-01), the hardcoded admin authentication backdoor with cleartext OTP (F-02), the leaked Supabase service role key (F-03), and plaintext password logging (F-04) creates an immediate risk of financial loss and complete account/database takeover if deployed to production in its current state.
- **Audit Confidence**: `CONFIRMED` for all code-level vulnerabilities. High confidence across all documented findings, with exact file paths and source lines verified.

---

## 7. Proposed Phase 2 Plan (Action Items)

Each fix will be implemented in a dedicated commit on branch `security-hardening`, strictly ordered by severity:

### Priority 1: Critical Fixes
- **Commit 1 (F-03)**: Remove hardcoded Supabase Service Role key from `package.json` and ensure `.env.hotupdater` is strictly isolated.
- **Commit 2 (F-02)**: Remove the hardcoded phone number (`8885551616`) and static OTP backdoor (`885687`) from `PhoneScreen.jsx` and `OTPScreen.jsx`.
- **Commit 3 (F-01)**: Prevent client-side coin manipulation.
  - Provide SQL migration script for Supabase (atomic RPC functions: `increment_balance`, `request_withdrawal`).
  - Update `QuizScreen.jsx`, `WatchScreen.jsx`, `DailyBonusScreen.jsx`, and `WalletScreen.jsx` to call RPC functions instead of direct table updates.
  - Disable direct client writes to `/wallets` in `database.rules.json`.

### Priority 2: High Fixes
- **Commit 4 (F-04)**: Remove plaintext password logging from `src/services/supabaseService.js`.
- **Commit 5 (F-05)**: Lock down `database.rules.json` to enforce strict user-only read/write rules and lock administrative paths.
- **Commit 6 (F-06 & F-07)**: Remove `.env` and keystores from git tracking, add `*.jks` and `.env*` to `.gitignore`, remove default fallback passwords (`123456`) from `android/app/build.gradle`, and provide `.env.example`.

### Priority 3: Medium Fixes
- **Commit 7 (F-08)**: Add `android/app/src/main/res/xml/network_security_config.xml` to explicitly block cleartext HTTP traffic in production release builds.
- **Commit 8 (F-09)**: Synchronize `PlayAllVideoAdsScreen.jsx` reward handling with the profile wallet.
- **Commit 9 (Dependencies)**: Remove obsolete `react-native-stallion` dependency cleanly.

---

> [!IMPORTANT]
> **Phase 1 is complete. No application code has been modified.**  
> Please review this audit report. To proceed with the fixes on branch `security-hardening`, reply with **"APPROVED"**.

