import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Picker,
} from "react-native";
import { AuthContext } from "../contexts/AuthContext";
import { api } from "../api";

export default function LoginScreen() {
  const { login, register } = useContext(AuthContext);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const data = await api.getColleges();
        if (data.success && data.colleges) {
          setColleges(data.colleges.filter((c: any) => c.status === "active"));
        }
      } catch (e) {
        console.error("Failed to fetch colleges", e);
      }
    };
    fetchColleges();
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (isRegister) {
      if (!name || !phone || !registerNumber || !selectedCollegeId) {
        Alert.alert("Error", "All fields are required for registration");
        return;
      }
      if (phone.length !== 10) {
        Alert.alert("Error", "Phone number must be 10 digits");
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password, phone, registerNumber, selectedCollegeId);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🍽️</Text>
          <Text style={styles.title}>Violet Bites</Text>
          <Text style={styles.subtitle}>
            {isRegister ? "Create your account" : "Welcome back!"}
          </Text>
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !isRegister && styles.toggleButtonActive]}
            onPress={() => setIsRegister(false)}
          >
            <Text style={[styles.toggleText, !isRegister && styles.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isRegister && styles.toggleButtonActive]}
            onPress={() => setIsRegister(true)}
          >
            <Text style={[styles.toggleText, isRegister && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {isRegister && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <TextInput
                style={styles.input}
                placeholder="Register Number (e.g. 21CS001)"
                placeholderTextColor="#9ca3af"
                value={registerNumber}
                onChangeText={setRegisterNumber}
                autoCapitalize="characters"
              />

              <TextInput
                style={styles.input}
                placeholder="Phone Number (10 digits)"
                placeholderTextColor="#9ca3af"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Select College</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedCollegeId}
                    onValueChange={(value) => setSelectedCollegeId(value)}
                    style={styles.picker}
                    dropdownIconColor="#7c3aed"
                  >
                    <Picker.Item label="-- Choose your college --" value="" color="#9ca3af" />
                    {colleges.map((c) => (
                      <Picker.Item key={c.id} label={c.name} value={c.id} color="#1f2937" />
                    ))}
                  </Picker>
                </View>
              </View>
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegister ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsRegister(!isRegister)}
          >
            <Text style={styles.switchText}>
              {isRegister
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f3fc",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#7c3aed",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f3e8ff",
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e9d5ff",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#7c3aed",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
  },
  toggleTextActive: {
    color: "#fff",
  },
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    color: "#1f2937",
  },
  pickerContainer: {
    gap: 6,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  picker: {
    height: 52,
    color: "#1f2937",
  },
  submitButton: {
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  switchButton: {
    alignItems: "center",
    padding: 12,
  },
  switchText: {
    color: "#7c3aed",
    fontSize: 14,
    fontWeight: "600",
  },
});
