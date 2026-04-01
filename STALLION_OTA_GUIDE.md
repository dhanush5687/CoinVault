# Stallion OTA Update - Complete Setup Guide

## ✅ What Was Fixed

Your OTA updates weren't working in **release APK** builds because:

1. ❌ **Missing Stallion configuration in `app.json`**
2. ❌ **Public key not accessible in release builds**
3. ❌ **No periodic update checking**
4. ❌ **Sync function error handling issue**

## 🔧 Changes Made

### 1. **app.json** - Added Stallion Configuration
```json
"stallion": {
  "uploadPath": "rappletech69/facevaultapp/main",
  "publicKeyPath": "stallion/public-key.pem",
  "checkForUpdateOnStart": true,
  "checkForUpdateInterval": 3600000
}
```

### 2. **Public Key** - Copied to Android Assets
- Copied `stallion/secret-keys/public-key.pem` → `android/app/src/main/assets/stallion/public-key.pem`
- This ensures the public key is bundled in release APKs

### 3. **StallionUpdateModal.jsx** - Enhanced Update Detection
- ✅ Fixed `sync()` error (was calling `.then()` on undefined)
- ✅ Added periodic update checks every 5 minutes
- ✅ Added console logging for debugging
- ✅ Better error handling

### 4. **ProGuard Rules** - Already Configured
- Stallion classes are protected from minification
- Located in `android/app/proguard-rules.pro`

## 🚀 How to Build Release APK with OTA Support

### Option 1: Use the Build Script (Recommended)
```bash
npm run build-release-ota
```

This script will:
1. Copy the public key to assets
2. Clean previous builds
3. Build the release APK
4. Show you the APK location

### Option 2: Manual Build
```bash
# 1. Copy public key to assets
mkdir -p android/app/src/main/assets/stallion
cp stallion/secret-keys/public-key.pem android/app/src/main/assets/stallion/public-key.pem

# 2. Build release APK
cd android
./gradlew clean
./gradlew assembleRelease
cd ..
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## 📱 How to Test OTA Updates

### Step 1: Install the Release APK
```bash
# Install on connected device
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Step 2: Make Code Changes
Edit any JavaScript file (e.g., `ChatScreen.jsx`, `App.jsx`, etc.)

### Step 3: Publish OTA Update
```bash
npm run ota
```

You'll see:
```
✓ Success!, Published new version
ℹ Published bundle hash: 7e440306d85e6526ee79efd1d7f184dab5e01e7ae118e6b0701e85253f444151
```

### Step 4: Open the App
1. **On app start**, it will check for updates
2. **Every 5 minutes**, it will check again
3. **When update is found**, you'll see a modal:

```
┌─────────────────────────────┐
│    Update Available! 🚀     │
│                             │
│  new adds updated and ap    │
│  chat and fix bugs          │
│                             │
│  [Restart & Update Now]     │
└─────────────────────────────┘
```

4. **Tap the button** to restart and apply the update

## 🔍 Debugging OTA Updates

### Check Console Logs
Look for these messages in your React Native logs:

```
🔄 Stallion: Checking for updates on mount...
✅ Stallion: Sync initiated
🔄 Stallion: Periodic update check...
✅ Stallion: Periodic sync initiated
```

When an update is available:
```
🚀 Stallion: Update available! Showing modal...
📦 New bundle: { hash: "7e4403...", releaseNotes: "..." }
```

### Common Issues

#### 1. Update Not Detected
- **Check**: Is the app using the release APK? (Not debug build)
- **Check**: Is the device connected to internet?
- **Check**: Run `npm run ota` to ensure update was published
- **Check**: Look for Stallion logs in console

#### 2. "Cannot read property 'then' of undefined"
- **Fixed**: This was the original error, now resolved

#### 3. Update Modal Not Showing
- **Check**: Look for console logs showing update detection
- **Check**: Ensure `app.json` has correct Stallion config
- **Check**: Public key exists in `android/app/src/main/assets/stallion/`

## 📝 Update Workflow

### For Development (Debug Builds)
```bash
npm run android
```
- Uses Metro bundler
- Hot reload works
- No OTA needed

### For Production (Release APK)
```bash
# 1. Build release APK (only needed once or when changing native code)
npm run build-release-ota

# 2. Install on device
adb install android/app/build/outputs/apk/release/app-release.apk

# 3. Make JavaScript changes
# Edit any .js/.jsx files

# 4. Publish OTA update
npm run ota

# 5. Open app - update will be detected automatically
```

## 🎯 Key Points

1. **OTA updates only work for JavaScript changes**
   - ✅ UI changes, logic changes, new screens
   - ❌ Native code changes, new dependencies, AndroidManifest changes

2. **Release APK is required**
   - Debug builds use Metro bundler, not Stallion
   - OTA only works in release builds

3. **Public key must be in assets**
   - The build script handles this automatically
   - Or manually copy before building

4. **Update checks happen automatically**
   - On app start
   - Every 5 minutes while app is open
   - Can also call `sync()` manually

## 🔐 Security

- Updates are **signed** with your private key
- App **verifies** updates with the public key
- Only updates from your account can be applied
- Prevents tampering and unauthorized updates

## 📊 Published Updates

Your latest published updates:
- Hash: `7e440306d85e6526ee79efd1d7f184dab5e01e7ae118e6b0701e85253f444151`
- Size: 1.50 MB
- Release Note: "new adds updated and ap chat and fix bugs"

## 🎉 Success Checklist

- [x] Stallion configuration added to `app.json`
- [x] Public key copied to assets
- [x] Update modal enhanced with logging
- [x] ProGuard rules configured
- [x] Build script created
- [x] OTA updates published successfully

## 🚀 Next Steps

1. **Build the release APK**: `npm run build-release-ota`
2. **Install on device**: `adb install android/app/build/outputs/apk/release/app-release.apk`
3. **Make a test change** to any screen
4. **Publish update**: `npm run ota`
5. **Open the app** and watch for the update modal! 🎊

---

**Need Help?**
- Check console logs for Stallion messages
- Ensure internet connection
- Verify public key exists in assets
- Make sure using release APK, not debug
