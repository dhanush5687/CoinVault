import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
} from "react-native";
import database from "@react-native-firebase/database";
import { supabase } from "../config/supabase";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

export default function ChatScreen({ navigation }) {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const flatListRef = useRef();

    useEffect(() => {
        setupChat();
    }, []);

    const setupChat = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigation.goBack();
                return;
            }
            setUserId(user.id);

            const chatRef = database().ref(`/chats/${user.id}/messages`);

            // Listen for messages
            chatRef.on("value", (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const msgList = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    })).sort((a, b) => a.timestamp - b.timestamp);
                    setMessages(msgList);
                } else {
                    setMessages([]);
                }
                setLoading(false);
            });

            return () => chatRef.off();
        } catch (error) {
            console.error("Chat Setup Error:", error);
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim() || !userId) return;

        const newMessage = {
            text: inputText.trim(),
            sender: "user",
            timestamp: Date.now(),
        };

        try {
            await database().ref(`/chats/${userId}/messages`).push(newMessage);

            // Update last message and status for admin view
            await database().ref(`/chats/${userId}/metadata`).update({
                lastMessage: inputText.trim(),
                lastTimestamp: Date.now(),
                unreadByAdmin: true,
                userName: (await supabase.auth.getUser()).data.user?.email || "User",
            });

            setInputText("");
        } catch (error) {
            alert("Failed to send message");
        }
    };

    const renderItem = ({ item }) => {
        const isUser = item.sender === "user";
        return (
            <View style={[
                styles.messageContainer,
                isUser ? styles.userMessage : styles.adminMessage
            ]}>
                <View style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.adminBubble
                ]}>
                    <Text style={isUser ? styles.userText : styles.adminText}>
                        {item.text}
                    </Text>
                    <Text style={styles.timeText}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#0f172a" barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Support Chat</Text>
                    <View style={styles.onlineRow}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>Agent Online</Text>
                    </View>
                </View>
                <MaterialCommunityIcons name="headphones" size={24} color="#38bdf8" />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#38bdf8" />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                />
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <View style={styles.inputArea}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#94a3b8"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                        onPress={sendMessage}
                        disabled={!inputText.trim()}
                    >
                        <MaterialCommunityIcons name="send" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0f1f" },
    header: {
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: "#1e293b",
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#334155",
    },
    headerInfo: { flex: 1, marginLeft: 15 },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
    onlineRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e", marginRight: 5 },
    onlineText: { color: "#94a3b8", fontSize: 12 },

    listContent: { padding: 15, paddingBottom: 20 },
    messageContainer: { marginBottom: 15, width: '100%' },
    userMessage: { alignItems: 'flex-end' },
    adminMessage: { alignItems: 'flex-start' },

    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
    },
    userBubble: {
        backgroundColor: "#2563eb",
        borderBottomRightRadius: 4,
    },
    adminBubble: {
        backgroundColor: "#334155",
        borderBottomLeftRadius: 4,
    },
    userText: { color: "#fff", fontSize: 15 },
    adminText: { color: "#f1f5f9", fontSize: 15 },
    timeText: { color: "rgba(255,255,255,0.5)", fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },

    inputArea: {
        flexDirection: "row",
        padding: 15,
        backgroundColor: "#1e293b",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: "#334155",
    },
    input: {
        flex: 1,
        backgroundColor: "#0f172a",
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: 10,
        color: "#fff",
        fontSize: 16,
        maxHeight: 100,
    },
    sendBtn: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: "#2563eb",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 10,
    },
    sendBtnDisabled: { backgroundColor: "#334155" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
