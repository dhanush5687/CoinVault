import { getDatabase, ref, onValue, update } from "@react-native-firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";

/**
 * Resolves the persistent chat user ID (Supabase Auth UUID with DeviceId fallback)
 */
export const getChatUserId = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) return session.user.id;

        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) return user.id;

        // Fallback to AsyncStorage cached profile
        const cached = await AsyncStorage.getItem("USER_PROFILE");
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.id) return parsed.id;
        }

        // Fallback to unique device ID
        const DeviceInfo = require("react-native-device-info").default;
        return await DeviceInfo.getUniqueId();
    } catch (e) {
        console.log("Error getting chat user id:", e);
        try {
            const DeviceInfo = require("react-native-device-info").default;
            return await DeviceInfo.getUniqueId();
        } catch {
            return null;
        }
    }
};

/**
 * Subscribes to support chat metadata for unread messages from admin
 * Automatically re-evaluates when user signs in or restores session
 */
export const subscribeToSupportChat = (onUpdate) => {
    let currentUserId = null;
    let unsubscribeFirebase = null;
    let isDisposed = false;

    const attachFirebaseListener = (userId) => {
        if (!userId || isDisposed) return;
        if (currentUserId === userId && unsubscribeFirebase) return; // already listening

        // Clean up previous listener
        if (unsubscribeFirebase) {
            unsubscribeFirebase();
            unsubscribeFirebase = null;
        }

        currentUserId = userId;
        const db = getDatabase();
        const chatRef = ref(db, `/chats/${userId}/metadata`);

        unsubscribeFirebase = onValue(chatRef, (snapshot) => {
            if (isDisposed) return;
            if (snapshot.exists()) {
                const meta = snapshot.val();
                onUpdate({
                    hasUnread: Boolean(meta.unreadByUser),
                    lastMessage: meta.lastMessage || "",
                    lastTimestamp: meta.lastTimestamp || 0,
                    userName: meta.userName || "",
                    raw: meta,
                });
            } else {
                onUpdate({
                    hasUnread: false,
                    lastMessage: "",
                    lastTimestamp: 0,
                    userName: "",
                    raw: null,
                });
            }
        });
    };

    // 1. Initial resolution
    getChatUserId().then((id) => {
        if (id && !isDisposed) attachFirebaseListener(id);
    });

    // 2. React to auth state changes (e.g. user logs in, tokens refresh)
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user?.id && !isDisposed) {
            attachFirebaseListener(session.user.id);
        }
    });

    return () => {
        isDisposed = true;
        if (authSub?.subscription) {
            authSub.subscription.unsubscribe();
        }
        if (unsubscribeFirebase) {
            unsubscribeFirebase();
        }
    };
};

/**
 * Marks messages as read by user
 */
export const markChatAsRead = async (userId) => {
    try {
        const targetId = userId || await getChatUserId();
        if (targetId) {
            const db = getDatabase();
            const chatRef = ref(db, `/chats/${targetId}/metadata`);
            await update(chatRef, {
                unreadByUser: false,
            });
        }
    } catch (e) {
        console.log("Error marking chat as read:", e);
    }
};

