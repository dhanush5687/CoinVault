
import { AppState } from "react-native";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@env";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
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
