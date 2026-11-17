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
    Image,
    Modal,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { launchImageLibrary } from "react-native-image-picker";
import database from "@react-native-firebase/database";
import { supabase } from "../config/supabase";
import { markChatAsRead, getChatUserId } from "../services/chatService";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import {
    startVoiceRecording,
    stopVoiceRecording,
    cancelVoiceRecording,
    playVoiceAudio,
    stopVoiceAudio,
} from "../services/voiceService";

export default function ChatScreen({ navigation }) {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    // Image Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    // Voice State
    const [isRecording, setIsRecording] = useState(false);
    const [recordDuration, setRecordDuration] = useState(0);
    const [playingMessageId, setPlayingMessageId] = useState(null);

    const recordTimerRef = useRef(null);
    const flatListRef = useRef();

    useEffect(() => {
        setupChat();
        return () => {
            stopVoiceAudio();
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        };
    }, []);

    // Timer for voice recording
    useEffect(() => {
        if (isRecording) {
            setRecordDuration(0);
            recordTimerRef.current = setInterval(() => {
                setRecordDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
            setRecordDuration(0);
        }
    }, [isRecording]);

    const setupChat = async () => {
        try {
            const currentId = await getChatUserId();
            if (!currentId) {
                navigation.goBack();
                return;
            }
            setUserId(currentId);

            const chatRef = database().ref(`/chats/${currentId}/messages`);

            // Mark as read when user opens the chat
            markChatAsRead(currentId);

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

    const sendMessage = async (type = "text", content = "", duration = 0) => {
        if (!userId) return;
        if (type === "text" && !content.trim()) return;

        const newMessage = {
            sender: "user",
            timestamp: Date.now(),
            type: type, // 'text', 'image', or 'audio'
        };

        if (type === "text") {
            newMessage.text = content.trim();
        } else if (type === "image") {
            newMessage.imageUrl = content;
            newMessage.text = "📷 Image";
        } else if (type === "audio") {
            newMessage.audioUrl = content;
            newMessage.duration = duration;
            newMessage.text = "🎤 Voice Message";
        }

        try {
            await database().ref(`/chats/${userId}/messages`).push(newMessage);

            // Update last message and status for admin view
            const summary = type === "image" ? "📷 Image" : type === "audio" ? "🎤 Voice Message" : content.trim();
            await database().ref(`/chats/${userId}/metadata`).update({
                lastMessage: summary,
                lastTimestamp: Date.now(),
                unreadByAdmin: true,
                userName: (await supabase.auth.getUser()).data.user?.email || "User",
            });

            if (type === "text") setInputText("");
        } catch (error) {
            Alert.alert("Error", "Failed to send message: " + (error?.message || "Unknown error"));
        }
    };

    const pickImage = () => {
        launchImageLibrary(
            { mediaType: "photo", includeBase64: true, quality: 0.5 },
            (response) => {
                if (response.didCancel) return;
                if (response.errorCode) {
                    Alert.alert("Error", "Image selection failed: " + (response.errorMessage || response.errorCode));
                    return;
                }
                if (response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    const mimeType = asset.type || "image/jpeg";
                    const base64Image = `data:${mimeType};base64,${asset.base64}`;
                    sendMessage("image", base64Image);
                }
            }
        );
    };

    const startRecording = async () => {
        const res = await startVoiceRecording();
        if (res.success) {
            setIsRecording(true);
        }
    };

    const stopAndSendRecording = async () => {
        const dur = recordDuration;
        setIsRecording(false);
        const res = await stopVoiceRecording();
        if (res.success && res.audioData) {
            sendMessage("audio", res.audioData, dur);
        }
    };

    const cancelRecording = async () => {
        setIsRecording(false);
        await cancelVoiceRecording();
    };

    const toggleVoiceRecord = () => {
        if (isRecording) {
            stopAndSendRecording();
        } else {
            startRecording();
        }
    };

    const handlePlayAudio = async (msgId, audioUrl) => {
        if (playingMessageId === msgId) {
            await stopVoiceAudio();
            setPlayingMessageId(null);
        } else {
            if (playingMessageId) {
                await stopVoiceAudio();
            }
            setPlayingMessageId(msgId);
            const res = await playVoiceAudio(audioUrl);
            if (res.success) {
                setTimeout(() => {
                    setPlayingMessageId(prev => (prev === msgId ? null : prev));
                }, (res.duration || 3000) + 400);
            } else {
                setPlayingMessageId(null);
            }
        }
    };

    const openImage = (url) => {
        setSelectedImage(url);
        setModalVisible(true);
    };

    const closeImage = () => {
        setModalVisible(false);
        setSelectedImage(null);
    };

    const formatTime = (secs) => {
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins}:${remSecs < 10 ? "0" : ""}${remSecs}`;
    };

    const renderItem = ({ item }) => {
        const isUser = item.sender === "user";
        const isImage = item.type === "image" || Boolean(item.imageUrl);
        const isAudio = item.type === "audio" || Boolean(item.audioUrl);
        const isPlayingThis = playingMessageId === item.id;

        return (
            <View style={[
                styles.messageContainer,
                isUser ? styles.userMessage : styles.adminMessage
            ]}>
                <View style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.adminBubble
                ]}>
                    {isImage ? (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => openImage(item.imageUrl)}
                            style={styles.imageWrapper}
                        >
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={styles.chatImage}
                                resizeMode="cover"
                            />
                            {item.text && item.text !== "📷 Image" ? (
                                <Text style={[isUser ? styles.userText : styles.adminText, { marginTop: 6 }]}>
                                    {item.text}
                                </Text>
                            ) : null}
                        </TouchableOpacity>
                    ) : isAudio ? (
                        <TouchableOpacity
                            style={styles.audioRow}
                            activeOpacity={0.8}
                            onPress={() => handlePlayAudio(item.id, item.audioUrl)}
                        >
                            <View style={[styles.playBtnCircle, isPlayingThis && styles.playingBtnCircle]}>
                                <MaterialCommunityIcons
                                    name={isPlayingThis ? "pause" : "play"}
                                    size={22}
                                    color="#fff"
                                />
                            </View>
                            <View style={styles.audioInfo}>
                                <Text style={[isUser ? styles.userText : styles.adminText, styles.audioLabel]}>
                                    {isPlayingThis ? "Playing Voice Note..." : "Voice Note"}
                                </Text>
                                <Text style={styles.audioDuration}>
                                    {formatTime(item.duration || 0)}
                                </Text>
                            </View>
                            <MaterialCommunityIcons
                                name="waveform"
                                size={22}
                                color={isUser ? "#93c5fd" : "#94a3b8"}
                            />
                        </TouchableOpacity>
                    ) : (
                        <Text style={isUser ? styles.userText : styles.adminText}>
                            {item.text}
                        </Text>
                    )}
                    <Text style={styles.timeText}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            <StatusBar backgroundColor="#0f172a" barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Support Chat</Text>
                    <View style={styles.onlineRow}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>Agent Online</Text>
                    </View>
                </View>

                {/* 🎧 Headphone Icon -> Tap to Record/Upload Voice */}
                <TouchableOpacity
                    style={[styles.headerVoiceBtn, isRecording && styles.headerVoiceBtnActive]}
                    onPress={toggleVoiceRecord}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons
                        name={isRecording ? "microphone" : "headphones"}
                        size={24}
                        color={isRecording ? "#ef4444" : "#38bdf8"}
                    />
                </TouchableOpacity>
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
                {/* RECORDING IN PROGRESS BAR */}
                {isRecording ? (
                    <View style={styles.recordingBar}>
                        <View style={styles.recDot} />
                        <Text style={styles.recDurationText}>
                            Recording: {formatTime(recordDuration)}
                        </Text>
                        <TouchableOpacity style={styles.recCancelBtn} onPress={cancelRecording}>
                            <MaterialCommunityIcons name="close" size={20} color="#ef4444" />
                            <Text style={styles.recCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.recSendBtn} onPress={stopAndSendRecording}>
                            <MaterialCommunityIcons name="send" size={20} color="#fff" />
                            <Text style={styles.recSendText}>Send</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.inputArea}>
                        {/* 📷 IMAGE UPLOAD BUTTON */}
                        <TouchableOpacity
                            style={styles.attachBtn}
                            onPress={pickImage}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons name="image-plus" size={26} color="#38bdf8" />
                        </TouchableOpacity>

                        {/* 🎙️ VOICE RECORD BUTTON */}
                        <TouchableOpacity
                            style={styles.attachBtn}
                            onPress={startRecording}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons name="microphone" size={26} color="#38bdf8" />
                        </TouchableOpacity>

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
                            onPress={() => sendMessage("text", inputText)}
                            disabled={!inputText.trim()}
                        >
                            <MaterialCommunityIcons name="send" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* FULL SCREEN IMAGE MODAL */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeImage}
            >
                <View style={styles.modalContainer}>
                    <TouchableOpacity style={styles.closeBtn} onPress={closeImage}>
                        <MaterialCommunityIcons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            style={styles.fullScreenImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0f1f" },
    header: {
        paddingTop: 14,
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
    headerVoiceBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#0f172a",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#334155",
    },
    headerVoiceBtnActive: {
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.15)",
    },

    listContent: { padding: 15, paddingBottom: 20 },
    messageContainer: { marginBottom: 15, width: '100%' },
    userMessage: { alignItems: 'flex-end' },
    adminMessage: { alignItems: 'flex-start' },

    messageBubble: {
        maxWidth: '82%',
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

    imageWrapper: {
        borderRadius: 12,
        overflow: "hidden",
    },
    chatImage: {
        width: 200,
        height: 200,
        borderRadius: 10,
        backgroundColor: "#1e293b",
    },

    // Audio bubble styles
    audioRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
        minWidth: 160,
    },
    playBtnCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.25)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    playingBtnCircle: {
        backgroundColor: "#22c55e",
    },
    audioInfo: {
        flex: 1,
    },
    audioLabel: {
        fontSize: 14,
        fontWeight: "600",
    },
    audioDuration: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 11,
        marginTop: 2,
    },

    inputArea: {
        flexDirection: "row",
        padding: 10,
        paddingHorizontal: 12,
        backgroundColor: "#1e293b",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: "#334155",
    },
    attachBtn: {
        padding: 6,
        marginRight: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    input: {
        flex: 1,
        backgroundColor: "#0f172a",
        borderRadius: 25,
        paddingHorizontal: 18,
        paddingVertical: 10,
        color: "#fff",
        fontSize: 15,
        maxHeight: 100,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#2563eb",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
    },
    sendBtnDisabled: { backgroundColor: "#334155" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    // Recording bar
    recordingBar: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        backgroundColor: "#1e293b",
        borderTopWidth: 1,
        borderTopColor: "#ef4444",
    },
    recDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#ef4444",
        marginRight: 10,
    },
    recDurationText: {
        flex: 1,
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    recCancelBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: "rgba(239, 68, 68, 0.15)",
        marginRight: 8,
    },
    recCancelText: {
        color: "#ef4444",
        fontSize: 13,
        fontWeight: "600",
        marginLeft: 4,
    },
    recSendBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: "#22c55e",
    },
    recSendText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        marginLeft: 4,
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.92)",
        justifyContent: "center",
        alignItems: "center",
    },
    closeBtn: {
        position: "absolute",
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 20,
    },
    fullScreenImage: {
        width: "92%",
        height: "80%",
    },
});
