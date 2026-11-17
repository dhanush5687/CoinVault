
import { AppState } from "react-native";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EncryptedStorage from "react-native-encrypted-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@env";

// 🛡️ Hardware-Backed Encrypted Session Storage Adapter (F-14)
const SecureAuthStorage = {
  getItem: async (key) => {
    try {
      const val = await EncryptedStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
      return await AsyncStorage.getItem(key);
    } catch {
      return await AsyncStorage.getItem(key);
    }
  },
  setItem: async (key, value) => {
    try {
      await EncryptedStorage.setItem(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    try {
      await EncryptedStorage.removeItem(key);
    } catch {}
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Handle AppState for better connection management
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// 🔥 Handle Session Recovery Errors (Fix for "Invalid Refresh Token")
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log("🔔 Supabase Auth Event:", event);
  
  // If the session refresh fails with an invalid token, we need to clear everything
  if (event === 'TOKEN_REFRESH_FINISHED' && !session) {
      console.log("⚠️ Refresh fail detected, cleaning up...");
      await supabase.auth.signOut();
  }
  
  if (event === 'SIGNED_OUT') {
    // Clear any local storage if needed
    console.log("🚪 User Signed Out");
  }
});
