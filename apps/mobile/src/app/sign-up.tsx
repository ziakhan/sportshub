import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { apiBaseUrl } from "@/lib/api"
import { useSession } from "@/lib/session"
import { palette, ui } from "@/lib/theme"

/**
 * Native account creation (owner rule: nothing punts to the website).
 * POST /api/auth/signup, then straight into a bearer session. Role
 * onboarding (parent/coach/etc.) happens naturally the first time a
 * role-specific action needs it — same event-driven model as the web.
 */
export default function SignUpScreen() {
  const { signIn } = useSession()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function dismiss() {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  async function onSubmit() {
    if (busy) return
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("All fields are required")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${apiBaseUrl()}/api/auth/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `Sign-up failed (${res.status})`)
      await signIn(email.trim(), password)
      dismiss()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable style={styles.close} onPress={dismiss} hitSlop={8}>
        <Ionicons name="close" size={24} color={ui.textMuted} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.card} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          sports<Text style={{ color: ui.primary }}>hub</Text>
        </Text>
        <Text style={styles.tagline}>Create your free account</Text>

        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor={ui.textFaint}
          autoComplete="given-name"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor={ui.textFaint}
          autoComplete="family-name"
          value={lastName}
          onChangeText={setLastName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={ui.textFaint}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (8+ characters)"
          placeholderTextColor={ui.textFaint}
          secureTextEntry
          autoComplete="new-password"
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
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/sign-in")} hitSlop={6}>
          <Text style={styles.footnote}>
            Already have an account? <Text style={styles.footnoteLink}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  close: { position: "absolute", top: 20, right: 20, zIndex: 1, padding: 4 },
  card: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  logo: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: ui.text,
    textAlign: "center",
  },
  tagline: { fontSize: 14, color: ui.textMuted, textAlign: "center", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: ui.text,
    backgroundColor: "#fff",
  },
  error: { color: palette.hoop[600], fontSize: 14, textAlign: "center" },
  button: {
    backgroundColor: ui.primary,
    borderRadius: ui.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footnote: { fontSize: 13, color: ui.textMuted, textAlign: "center", marginTop: 16 },
  footnoteLink: { color: ui.primary, fontWeight: "700" },
})
