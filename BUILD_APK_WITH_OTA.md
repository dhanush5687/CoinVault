# Building Signed Production APK with OTA Support in Android Studio

## ✅ Prerequisites Completed
- [x] Public key copied to `android/app/src/main/assets/stallion/public-key.pem`
- [x] Stallion configuration added to `app.json`
- [x] ProGuard rules configured
- [x] Latest OTA update published (hash: 978da2a9e3717db88ab873661b14e7c560e3cf1341ead7e527fda6a416e61e36)

## 📱 Steps to Build in Android Studio

### 1. Open Android Studio
```bash
npm run studio
# OR manually: open -a "Android Studio"
```

### 2. Open the Android Project
- File → Open
- Navigate to: `/Users/dhanushraj/Desktop/FaceVaultApp/FaceVaultApp/android`
- Click "Open"

### 3. Build Signed APK
1. **Build** → **Generate Signed Bundle / APK**
2. Select **APK** (or AAB for Play Store)
3. Click **Next**

### 4. Configure Signing
Use your existing keystore:
- **Key store path**: `android/app/CoinVault.jks`
- **Key store password**: (from your `.env` file: `RELEASE_STORE_PASSWORD`)
- **Key alias**: (from your `.env` file: `RELEASE_KEY_ALIAS`)
- **Key password**: (from your `.env` file: `RELEASE_KEY_PASSWORD`)

### 5. Select Build Variant
- **Build Variants**: `release`
- **Signature Versions**: Check both V1 and V2
- Click **Next**

### 6. Build
- Select **release** variant
- Click **Finish**

### 7. Find Your APK
After build completes, the APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

Android Studio will show a notification with a link to the APK location.

## 🎯 Verify OTA Support

After building, verify the public key is included:

```bash
# Extract APK contents
unzip -l android/app/build/outputs/apk/release/app-release.apk | grep stallion

# You should see:
# assets/stallion/public-key.pem
```

## 📲 Install and Test

### Install on Device
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Test OTA Update
1. **Open the app** - it will check for updates on start
2. **Watch console logs** for:
   ```
   🔄 Stallion: Checking for updates on mount...
   ✅ Stallion: Sync initiated
   🚀 Stallion: Update available! Showing modal...
   ```
3. **Update modal should appear** with your latest update!

## 🔄 Workflow for Future Updates

### For JavaScript-Only Changes:
```bash
# 1. Make your code changes
# Edit any .js/.jsx files

# 2. Publish OTA update
npm run ota

# 3. Users get the update automatically!
# No need to rebuild APK
```

### For Native Changes (Rare):
```bash
# 1. Copy public key to assets
mkdir -p android/app/src/main/assets/stallion
cp stallion/secret-keys/public-key.pem android/app/src/main/assets/stallion/public-key.pem

# 2. Build in Android Studio (follow steps above)

# 3. Distribute new APK to users
```

## 🚨 Common Mistakes to Avoid

1. ❌ **Building without copying public key to assets**
   - OTA updates won't work
   - Always run the copy command before building

2. ❌ **Testing with debug build**
   - Debug builds use Metro bundler, not Stallion
   - Always test with release APK

3. ❌ **Forgetting to publish OTA update**
   - Run `npm run ota` after making changes
   - App won't find updates if you don't publish

## 📊 Your Current Setup

- **Upload Path**: `rappletech69/facevaultapp/main`
- **Latest Bundle Hash**: `978da2a9e3717db88ab873661b14e7c560e3cf1341ead7e527fda6a416e61e36`
- **Bundle Size**: 1.50 MB
- **Release Note**: "new adds updated and ap chat and fix bugs"

## ✅ Checklist Before Building

- [x] Public key copied to assets
- [x] `app.json` has Stallion config
- [x] ProGuard rules configured
- [x] Keystore file exists (`CoinVault.jks`)
- [x] `.env` file has signing credentials
- [x] Latest code changes committed

## 🎉 You're Ready!

Your APK will now support OTA updates! After users install this APK:
1. They'll get automatic update checks
2. Updates will download in the background
3. Beautiful modal will prompt them to restart
4. App updates instantly without Play Store!

---

**Need to rebuild?** Just remember to copy the public key to assets first:
```bash
mkdir -p android/app/src/main/assets/stallion && cp stallion/secret-keys/public-key.pem android/app/src/main/assets/stallion/public-key.pem
```
