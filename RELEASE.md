# CoinVault (FaceVaultApp) — Production Release Guide

This document describes the reproducible build and release procedures for **CoinVault** (`com.facevaultapp`).

---

## 1. Prerequisites

- **Node.js**: v20+ / v22+
- **JDK**: Java 17 (Azul Zulu 17 or OpenJDK 17 recommended for React Native 0.83+)
- **Android SDK**: Build-Tools 36.0.0, API Level 36 (`compileSdk 36`, `targetSdk 36`)
- **Android Keystore**: `android/app/CoinVault.jks` (Keep backed up safely offline)

---

## 2. Environment Setup

Copy `.env.example` to `.env` if not already present:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```ini
APP_NAME=CoinVault
VERSION_NAME=1.8
VERSION_CODE=3
PACKAGE_NAME=com.facevaultapp

RELEASE_STORE_PASSWORD=your_keystore_password
RELEASE_KEY_ALIAS=android
RELEASE_KEY_PASSWORD=your_key_password

ADMOB_APP_ID=ca-app-pub-2490251867268823~7957128323
ADMOB_BANNER_ID=ca-app-pub-2490251867268823/5116361111
ADMOB_INTERSTITIAL_ID=ca-app-pub-2490251867268823/2427667725
ADMOB_REWARDED_ID=ca-app-pub-2490251867268823/3936964593
ADMOB_APP_OPEN_ID=ca-app-pub-2490251867268823/2498586385

SUPABASE_URL=https://uwpnfnwqluxhzlnewcgp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

## 3. Pre-Flight Verification

Before generating any build for the store, run the automated security scanner:
```bash
npm run security:scan
```
All 5 checks must output **`✅`** and exit with code 0.

---

## 4. Building the Production Release Artifacts

### Option A: Generate Android App Bundle (.aab) for Google Play Console (Recommended)
```bash
# 1. Compile fresh JavaScript production bundle
npm run android-build

# 2. Build signed Android App Bundle (.aab)
npm run aab
```
The final bundle is generated at:
`android/app/build/outputs/bundle/release/app-release.aab`

### Option B: Generate Universal APK for Local Testing
```bash
npm run android-build-release
```
The APK is generated at:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 5. Over-the-Air (OTA) Hot Updates

When deploying non-native JS/asset bug fixes without app store review:
```bash
# Set your rotated service_role key temporarily in your terminal session:
export HOT_UPDATER_SUPABASE_SERVICE_ROLE_KEY="your_new_service_role_key"
export HOT_UPDATER_SUPABASE_URL="https://uwpnfnwqluxhzlnewcgp.supabase.co"
export HOT_UPDATER_SUPABASE_BUCKET_NAME="bundles"

# Deploy update:
npx hot-updater deploy -p android -c production -m "description of changes"
```

---

## 6. Emergency Rollback / Killswitch

If a critical crash or issue is reported:
1. Open HotUpdater Console:
   ```bash
   npx hot-updater console
   ```
2. Disable the active deployment or roll back to the prior stable bundle version with 1 click.
