# 🔧 Quick Fix - Environment Variables Updated

## ✅ Fixed!

I've updated your `.env` file with the correct AdMob environment variable names.

### **What Was Changed:**

**Before:**
```bash
ADMOB_REWARDED_AD_UNIT_ID_ANDROID=ca-app-pub-3940256099942544/5224354917
ADMOB_REWARDED_AD_UNIT_ID_IOS=ca-app-pub-3940256099942544/1712485313
```

**After:**
```bash
ADMOB_REWARDED_ID=ca-app-pub-3940256099942544/5224354917
ADMOB_BANNER_ID=ca-app-pub-3940256099942544/6300978111
ADMOB_APP_OPEN_ID=ca-app-pub-3940256099942544/9257395921
ADMOB_INTERSTITIAL_ID=ca-app-pub-3940256099942544/1033173712
```

---

## 🚀 How to Apply the Fix

### **Option 1: Reload App in Emulator** (Easiest)

1. In your Android emulator, press **R** twice quickly (Double-tap R) 
   - This will **reload** the app with new environment variables

OR

2. Shake the device (Cmd + M on Mac / Ctrl + M on Windows)
   - Select **"Reload"**

---

### **Option 2: Restart Metro Bundler** (If Option 1 doesn't work)

1. **Stop the current Metro bundler:**
   - In the terminal where Metro is running, press `Ctrl + C`

2. **Clear cache and restart:**
   ```bash
   cd /Users/dhanushraj/Desktop/FaceVaultApp/FaceVaultApp
   npx react-native start --reset-cache
   ```

3. **In a new terminal, rebuild the app:**
   ```bash
   cd /Users/dhanushraj/Desktop/FaceVaultApp/FaceVaultApp
   npx react-native run-android
   ```

---

## 📱 Test the App

After reloading, the app should:
- ✅ Launch without errors
- ✅ Show wallet balance on HomeScreen
- ✅ Load ads in WatchScreen
- ✅ Allow spinning the daily bonus wheel

---

## 🎯 What These IDs Are

All the AdMob IDs I added are **Google's official test IDs**:

| Variable | Purpose | Test ID |
|----------|---------|---------|
| `ADMOB_REWARDED_ID` | Rewarded video ads | ca-app-pub-3940256099942544/5224354917 |
| `ADMOB_BANNER_ID` | Banner ads | ca-app-pub-3940256099942544/6300978111 |
| `ADMOB_APP_OPEN_ID` | App open ads | ca-app-pub-3940256099942544/9257395921 |
| `ADMOB_INTERSTITIAL_ID` | Interstitial ads | ca-app-pub-3940256099942544/1033173712 |

**⚠️ Important:** These are test IDs. For production:
1. Create your AdMob account
2. Generate your own ad unit IDs
3. Replace these test IDs in `.env`

---

## ✅ Verification

After the app reloads, check:
- [ ] No error about "ADMOB_REWARDED_ID not defined"
- [ ] App shows splash screen
- [ ] HomeScreen displays with wallet card
- [ ] No red error screen

---

## 🐛 If You Still See Errors

Try this complete reset:

```bash
# 1. Stop Metro
# Press Ctrl+C in Metro terminal

# 2. Clean cache
cd /Users/dhanushraj/Desktop/FaceVaultApp/FaceVaultApp
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

# 3. Restart with cache reset
npx react-native start --reset-cache

# 4. In new terminal, rebuild
npx react-native run-android
```

---

**🎉 You're all set! Just reload the app to see the changes!**
