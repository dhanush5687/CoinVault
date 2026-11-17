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
    Alert,
    Image,
    Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { launchImageLibrary } from "react-native-image-picker";
import database from "@react-native-firebase/database";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import {
    startVoiceRecording,
    stopVoiceRecording,
    cancelVoiceRecording,
    playVoiceAudio,
    stopVoiceAudio,
} from "../services/voiceService";

export default function AdminChatScreen({ route, navigation }) {
    const { userId, userName } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);

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
        const chatRef = database().ref(`/chats/${userId}/messages`);

        // Mark as read when admin opens the chat
        database().ref(`/chats/${userId}/metadata`).update({ unreadByAdmin: false });

        chatRef.on("value", (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const msgList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => a.timestamp - b.timestamp);
                setMessages(msgList);
            }
            setLoading(false);
        });

        return () => {
            stopVoiceAudio();
            chatRef.off();
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        };
    }, [userId]);

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

    const sendMessage = async (type = "text", content = "", duration = 0) => {
        if (type === "text" && !content.trim()) return;

        const newMessage = {
            sender: "admin",
            timestamp: Date.now(),
            type: type,
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

            // Update metadata so user gets in-app notification
            const summary = type === "image" ? "📷 Image" : type === "audio" ? "🎤 Voice Message" : content.trim();
            await database().ref(`/chats/${userId}/metadata`).update({
                lastMessage: summary,
                lastTimestamp: Date.now(),
                unreadByAdmin: false,
                unreadByUser: true,
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

    const deleteMessage = (msgId) => {
        Alert.alert(
            "Delete Message?",
            "Are you sure you want to delete this message?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await database().ref(`/chats/${userId}/messages/${msgId}`).remove();
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete message");
                        }
                    }
                }
            ]
        );
    };

    const clearChat = () => {
        Alert.alert(
            "Clear Chat History?",
            "This will delete all messages for both you and the user. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Everything",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Delete messages and metadata
                            await database().ref(`/chats/${userId}`).remove();
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert("Error", "Failed to clear chat");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => {
        const isAdmin = item.sender === "admin";
        const isImage = item.type === "image" || Boolean(item.imageUrl);
        const isAudio = item.type === "audio" || Boolean(item.audioUrl);
        const isPlayingThis = playingMessageId === item.id;

        return (
            <TouchableOpacity
                onLongPress={() => deleteMessage(item.id)}
                activeOpacity={0.85}
                style={[
                    styles.messageContainer,
                    isAdmin ? styles.adminMessage : styles.userMessage
                ]}
            >
                <View style={[
                    styles.messageBubble,
                    isAdmin ? styles.adminBubble : styles.userBubble
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
                                <Text style={[isAdmin ? styles.adminText : styles.userText, { marginTop: 6 }]}>
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
                                <Text style={[isAdmin ? styles.adminText : styles.userText, styles.audioLabel]}>
                                    {isPlayingThis ? "Playing Voice Note..." : "Voice Note"}
                                </Text>
                                <Text style={styles.audioDuration}>
                                    {formatTime(item.duration || 0)}
                                </Text>
                            </View>
                            <MaterialCommunityIcons
                                name="waveform"
                                size={22}
                                color={isAdmin ? "#93c5fd" : "#94a3b8"}
                            />
                        </TouchableOpacity>
                    ) : (
                        <Text style={isAdmin ? styles.adminText : styles.userText}>
                            {item.text}
                        </Text>
                    )}
                    <Text style={styles.timeText}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{userName || "User Chat"}</Text>
                    <Text style={styles.headerSub}>Admin Response Mode</Text>
                </View>
                <TouchableOpacity onPress={clearChat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#2563eb" />
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
                        {/* 📷 IMAGE ATTACH BUTTON */}
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
                            placeholder="Reply to user..."
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
    headerSub: { color: "#38bdf8", fontSize: 12, fontWeight: "600" },

    listContent: { padding: 15, paddingBottom: 20 },
    messageContainer: { marginBottom: 15, width: '100%' },
    adminMessage: { alignItems: 'flex-end' },
    userMessage: { alignItems: 'flex-start' },

    messageBubble: {
        maxWidth: '82%',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
    },
    adminBubble: {
        backgroundColor: "#2563eb",
        borderBottomRightRadius: 4,
    },
    userBubble: {
        backgroundColor: "#334155",
        borderBottomLeftRadius: 4,
    },
    adminText: { color: "#fff", fontSize: 15 },
    userText: { color: "#f1f5f9", fontSize: 15 },
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
