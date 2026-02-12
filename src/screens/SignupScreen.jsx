import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from "react-native";
import { signUpWithEmail, signInWithEmail } from "../services/supabaseService";

export default function SignupScreen({ navigation }) {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async () => {
        if (!email || !password) {
            alert("Please enter email and password");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters long");
            return;
        }

        if (!isLogin && !name) {
            alert("Please enter your name");
            return;
        }

        setLoading(true);

        try {
            let result;
            if (isLogin) {
                // Log In
                result = await signInWithEmail(email, password);
            } else {
                // Sign Up
                result = await signUpWithEmail(email, password, name);
            }

            if (result.success) {
                console.log("✅ Auth Success:", result.user?.email);
                navigation.replace("MainTabs"); // Go to App
            } else {
                const err = result.error || "";
                // Smart Error Handling
                if (err.includes("rate limit")) {
                    alert("⚠️ Rate Limit Hit\n\nDisable 'Confirm Email' in Supabase Dashboard to test freely.");
                } else if (err.includes("Error sending confirmation email")) {
                    alert("📧 Email Sending Failed\n\nSupabase is having trouble sending the confirmation email.\n\n✅ FIX: Go to Supabase Dashboard > Authentication > Settings > Auth Providers > Email and Turn OFF 'Confirm email'.");
                } else if (err.includes("Invalid login credentials")) {
                    alert("❌ Invalid Login Credentials\n\n- Wrong Password?\n- Or Account doesn't exist (Try Sign Up).");
                } else if (err.includes("Email not confirmed")) {
                    alert("📧 Email Not Confirmed\n\nPlease check your inbox and verify your email before logging in.\n\n(Tip: Disable 'Confirm Email' in Supabase Auth settings to skip this step).");
                } else if (err.includes("User already registered")) {
                    alert("⚠️ Account Exists\n\nPlease switch to 'Log In'.");
                } else {
                    alert("Authentication Failed: " + err);
                }
            }
        } catch (error) {
            alert("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#0a0f1f" barStyle="light-content" />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <Text style={styles.title}>
                    {isLogin ? "Welcome Back! 👋" : "Create Account 🚀"}
                </Text>
                <Text style={styles.subtitle}>
                    {isLogin
                        ? "Log in to access your wallet & earnings"
                        : "Sign up to start earning real money"}
                </Text>

                <View style={styles.form}>
                    {/* Name Input (Only for Signup) */}
                    {!isLogin && (
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            placeholderTextColor="#888"
                            value={name}
                            onChangeText={setName}
                        />
                    )}

                    <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        placeholderTextColor="#888"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />

                    {/* Password Input with Show/Hide */}
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Password (min 6 chars)"
                            placeholderTextColor="#888"
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeIcon}
                        >
                            <Text style={{ fontSize: 18 }}>
                                {showPassword ? "👁️" : "🙈"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.btn}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnText}>
                                {isLogin ? "Log In" : "Sign Up"}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleText}>
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                        </Text>
                        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                            <Text style={styles.toggleLink}>
                                {isLogin ? "Sign Up" : "Log In"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0f1f",
        justifyContent: "center",
        padding: 20,
    },
    keyboardView: {
        flex: 1,
        justifyContent: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#fff",
        textAlign: "center",
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 14,
        color: "#9ca3af",
        textAlign: "center",
        marginBottom: 40,
    },
    form: {
        width: "100%",
    },
    input: {
        backgroundColor: "#111827",
        padding: 15,
        borderRadius: 12,
        color: "#fff",
        marginBottom: 15,
        borderWidth: 1,
        borderColor: "#374151",
    },
    passwordContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111827",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#374151",
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    passwordInput: {
        flex: 1,
        color: "#fff",
        paddingVertical: 15,
    },
    eyeIcon: {
        padding: 5,
    },
    btn: {
        backgroundColor: "#2563eb",
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 10,
    },
    btnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    toggleRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 20,
    },
    toggleText: {
        color: "#9ca3af",
    },
    toggleLink: {
        color: "#38bdf8",
        fontWeight: "700",
    },
    orRow: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: "#374151",
    },
    orText: {
        marginHorizontal: 10,
        color: "#9ca3af",
        fontSize: 12,
        fontWeight: "600",
    },
    googleBtn: {
        backgroundColor: "#f43f5e",
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#f43f5e",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
});
