import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

/**
 * App-Level Error Boundary (Phase 3 Production Readiness)
 * Catches unhandled JavaScript render crashes and prevents sudden app termination.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🔥 Uncaught ErrorBoundary Exception:", error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#0a0f1f" />
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={64} color="#ef4444" />
            </View>

            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred. Don't worry, your wallet balance and data are completely safe.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={this.handleRestart}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="reload" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Restart Application</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1f",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 28,
    alignItems: "center",
    maxWidth: 400,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
