import { useEffect, useState } from "react"
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
import { googleAvailable, googleIdToken } from "@/lib/google-auth"
import { palette, ui } from "@/lib/theme"

/**
 * Native account creation (owner rule: nothing punts to the website).
 * POST /api/auth/signup, then straight into a bearer session. Role
 * onboarding (parent/coach/etc.) happens naturally the first time a
 * role-specific action needs it — same event-driven model as the web.
 */
export default function SignUpScreen() {
  const { signIn, signInApple, signInGoogle } = useSession()
  // Sign UP with Apple (owner 2026-07-16: Apple sign-in IS account creation)
  // — guarded require: binaries without the native module must not crash.
  const [appleReady, setAppleReady] = useState(false)
  useEffect(() => {
    if (Platform.OS !== "ios") return
    try {
      const apple = require("expo-apple-authentication")
      apple
        .isAvailableAsync()
        .then((ok: boolean) => setAppleReady(ok))
        .catch(() => {})
    } catch {
      // binary without the module
    }
  }, [])
  const [googleReady] = useState(googleAvailable)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onGoogle() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const idToken = await googleIdToken()
      if (!idToken) return // user backed out of the sheet
      await signInGoogle(idToken)
      dismiss()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-up failed")
    } finally {
      setBusy(false)
    }
  }

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

        {appleReady ? (
          <Pressable
            style={({ pressed }) => [styles.appleButton, (pressed || busy) && { opacity: 0.75 }]}
            onPress={async () => {
              if (busy) return
              setBusy(true)
              setError(null)
              try {
                const apple = require("expo-apple-authentication")
                const cred = await apple.signInAsync({
                  requestedScopes: [
                    apple.AppleAuthenticationScope.FULL_NAME,
                    apple.AppleAuthenticationScope.EMAIL,
                  ],
                })
                if (!cred.identityToken) throw new Error("Apple didn't return a token")
                await signInApple(cred.identityToken, cred.fullName)
                dismiss()
              } catch (err) {
                const code = (err as { code?: string })?.code
                if (code !== "ERR_REQUEST_CANCELED") {
                  setError(err instanceof Error ? err.message : "Apple sign-up failed")
                }
              } finally {
                setBusy(false)
              }
            }}
            disabled={busy}
          >
            <Ionicons name="logo-apple" size={18} color="#fff" />
            <Text style={styles.appleButtonText}>Sign up with Apple</Text>
          </Pressable>
        ) : null}

        {googleReady ? (
          <Pressable
            style={({ pressed }) => [styles.googleButton, (pressed || busy) && { opacity: 0.75 }]}
            onPress={onGoogle}
            disabled={busy}
          >
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text style={styles.googleButtonText}>Sign up with Google</Text>
          </Pressable>
        ) : null}

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
  appleButton: {
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  appleButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  googleButton: {
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: ui.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  googleButtonText: { color: ui.text, fontSize: 15, fontWeight: "700" },
  footnote: { fontSize: 13, color: ui.textMuted, textAlign: "center", marginTop: 16 },
  footnoteLink: { color: ui.primary, fontWeight: "700" },
})
