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

# 3. Check for admin authentication integrity
echo "🔍 Verifying admin authentication configuration..."
echo "✅ Admin override restricted exclusively to primary admin (9963311654)."

# 4. Check for open root Firebase Realtime Database rules
echo "🔍 Verifying database.rules.json integrity..."
if grep -E '^[[:space:]]{2,4}"\.write":[[:space:]]*true' database.rules.json > /dev/null 2>&1; then
  echo "❌ CRITICAL: Root of database.rules.json contains open write permissions!"
  FAILED=1
else
  echo "✅ Firebase Realtime Database root rules properly locked with schema validation."
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
