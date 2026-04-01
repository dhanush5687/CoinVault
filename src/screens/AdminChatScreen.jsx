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
import { launchImageLibrary } from "react-native-image-picker";
import database from "@react-native-firebase/database";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

export default function AdminChatScreen({ route, navigation }) {
    const { userId, userName } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
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

        return () => chatRef.off();
    }, [userId]);

    const sendMessage = async (type = "text", content = "") => {
        if (type === "text" && !content.trim()) return;

        const newMessage = {
            sender: "admin",
            timestamp: Date.now(),
            type: type
        };

        if (type === "text") {
            newMessage.text = content.trim();
        } else if (type === "image") {
            newMessage.imageUrl = content;
            newMessage.text = "📷 Image";
        }

        try {
            await database().ref(`/chats/${userId}/messages`).push(newMessage);

            // Update metadata
            await database().ref(`/chats/${userId}/metadata`).update({
                lastMessage: type === "image" ? "📷 Image" : content.trim(),
                lastTimestamp: Date.now(),
                unreadByAdmin: false,
                unreadByUser: true,
            });

            if (type === "text") setInputText("");
        } catch (error) {
            alert("Failed to send message");
        }
    };

    const pickImage = () => {
        launchImageLibrary(
            { mediaType: "photo", includeBase64: true, quality: 0.5 },
            (response) => {
                if (response.didCancel) return;
                if (response.errorCode) {
                    Alert.alert("Error", "Image selection failed");
                    return;
                }
                if (response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    const base64Image = `data:${asset.type};base64,${asset.base64}`;
                    sendMessage("image", base64Image);
                }
            }
        );
    };

    const openImage = (url) => {
        setSelectedImage(url);
        setModalVisible(true);
    };

    const closeImage = () => {
        setModalVisible(false);
        setSelectedImage(null);
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
                            alert("Failed to delete message");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => {
        const isAdmin = item.sender === "admin";
        return (
            <TouchableOpacity
                onLongPress={() => deleteMessage(item.id)}
                activeOpacity={0.8}
                style={[
                    styles.messageContainer,
                    isAdmin ? styles.adminMessage : styles.userMessage
                ]}
            >
                <View style={[
                    styles.messageBubble,
                    isAdmin ? styles.adminBubble : styles.userBubble
                ]}>
                    <Text style={isAdmin ? styles.adminText : styles.userText}>
                        {item.type === "image" ? (
                            <TouchableOpacity onPress={() => openImage(item.imageUrl)}>
                                <Image
                                    source={{ uri: item.imageUrl }}
                                    style={{ width: 200, height: 200, borderRadius: 10 }}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ) : (
                            item.text
                        )}
                    </Text>
                    <Text style={styles.timeText}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </TouchableOpacity>
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
                            alert("Failed to clear chat");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{userName || "User Chat"}</Text>
                    <Text style={styles.headerSub}>Admin Response Mode</Text>
                </View>
                <TouchableOpacity onPress={clearChat}>
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
                <View style={styles.inputArea}>
                    <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                        <MaterialCommunityIcons name="image-plus" size={24} color="#94a3b8" />
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
                        <MaterialCommunityIcons name="send" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
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
                        <MaterialCommunityIcons name="close" size={30} color="#fff" />
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
    headerSub: { color: "#38bdf8", fontSize: 12, fontWeight: "600" },

    listContent: { padding: 15, paddingBottom: 20 },
    messageContainer: { marginBottom: 15, width: '100%' },
    adminMessage: { alignItems: 'flex-end' },
    userMessage: { alignItems: 'flex-start' },

    messageBubble: {
        maxWidth: '80%',
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
    attachBtn: {
        padding: 10,
        marginRight: 5,
    },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
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
        width: "100%",
        height: "80%",
    },
});
