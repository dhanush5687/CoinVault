#!/bin/bash

# Stallion OTA Release Build Script
# This script prepares and builds a release APK with Stallion OTA support

echo "🚀 Building Release APK with Stallion OTA Support..."

# Step 1: Copy public key to assets
echo "📦 Step 1: Copying Stallion public key to assets..."
mkdir -p android/app/src/main/assets/stallion
cp stallion/secret-keys/public-key.pem android/app/src/main/assets/stallion/public-key.pem
echo "✅ Public key copied"

# Step 2: Clean previous builds
echo "🧹 Step 2: Cleaning previous builds..."
cd android
./gradlew clean
cd ..
echo "✅ Clean completed"

# Step 3: Build release APK
echo "🔨 Step 3: Building release APK..."
cd android
./gradlew assembleRelease
cd ..
echo "✅ Build completed"

# Step 4: Show APK location
echo ""
echo "✅ SUCCESS! Release APK built with Stallion OTA support"
echo "📍 APK Location: android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "📝 Next steps:"
echo "1. Install this APK on your device"
echo "2. Run 'npm run ota' to publish updates"
echo "3. Open the app - it will check for updates automatically"
echo ""
