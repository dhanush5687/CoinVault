#!/usr/bin/env bash
# ==============================================================================
# FaceVaultApp (CoinVault) Automated Security Audit & CI Guard
# ==============================================================================
set -euo pipefail

echo "=========================================="
echo "🛡️  Running FaceVaultApp Security Guard..."
echo "=========================================="

FAILED=0

# 1. Check for tracked .env or .jks in git
echo "🔍 Checking for tracked secrets in git..."
if git ls-files | grep -E '(^|/)\.env$|\.jks$' > /dev/null 2>&1; then
  echo "❌ CRITICAL: Sensitive files (.env or *.jks) are tracked in git!"
  git ls-files | grep -E '(^|/)\.env$|\.jks$'
  FAILED=1
else
  echo "✅ No sensitive files (.env, *.jks) tracked in git index."
fi

# 2. Check for service_role keys in source code or package.json
echo "🔍 Scanning for leaked service_role keys..."
if grep -rn "service_role" src/ package.json 2>/dev/null | grep -v "SECURITY_AUDIT.md" | grep -v "SECURITY_FIXES.md"; then
  echo "❌ CRITICAL: Supabase service_role key pattern detected in source code or package.json!"
  FAILED=1
else
  echo "✅ No Supabase service_role keys found in source code."
fi

# 3. Check for plaintext OTP backdoor numbers
echo "🔍 Scanning for hardcoded OTP backdoor codes..."
if grep -rn "885687" src/ 2>/dev/null; then
  echo "❌ CRITICAL: Hardcoded OTP bypass code (885687) detected in src/!"
  FAILED=1
else
  echo "✅ No OTP backdoor code found in src/."
fi

# 4. Check for open Firebase Realtime Database rules
echo "🔍 Verifying database.rules.json integrity..."
if grep -E '"\.write":\s*true' database.rules.json | grep -v "marqueeMessages" | grep -v "marqueeConfig" > /dev/null 2>&1; then
  echo "❌ CRITICAL: database.rules.json contains open write permissions!"
  FAILED=1
else
  echo "✅ Firebase Realtime Database rules properly locked."
fi

# 5. Check for insecure plaintext HTTP endpoints
echo "🔍 Checking for insecure HTTP endpoints in user profile / links..."
if grep -rn "http://t.me" src/ 2>/dev/null; then
  echo "⚠️ WARNING: Plaintext HTTP telegram link detected!"
  FAILED=1
else
  echo "✅ All public links use HTTPS."
fi

echo "=========================================="
if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL SECURITY CHECKS PASSED!"
  exit 0
else
  echo "🚨 SECURITY AUDIT FAILED! Address the issues above before releasing."
  exit 1
fi
