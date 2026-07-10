import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { StatusBar } from "expo-status-bar"
import { ui, palette } from "@/lib/theme"
import { useSession } from "@/lib/session"

export default function SignInScreen() {
  const { signIn } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit() {
    if (!email.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      // Stack.Protected flips to the tabs on state change
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.logo}>
          Sports<Text style={{ color: ui.primary }}>Hub</Text>
        </Text>
        <Text style={styles.tagline}>Live scores, team chat and your family’s basketball life</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={ui.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={ui.textMuted}
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Text style={styles.footnote}>
          Accounts are created on the SportsHub website — sign in with the same email and
          password.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ui.background,
    justifyContent: "center",
    padding: 24,
  },
  card: { gap: 12 },
  logo: {
    fontSize: 36,
    fontWeight: "800",
    color: ui.text,
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: ui.text,
    backgroundColor: ui.surface,
  },
  error: {
    color: palette.hoop[600],
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    backgroundColor: ui.primary,
    borderRadius: ui.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footnote: {
    fontSize: 12,
    color: ui.textMuted,
    textAlign: "center",
    marginTop: 16,
  },
})
