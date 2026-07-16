import { useEffect, useState } from "react"
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
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { ui, palette } from "@/lib/theme"
import { useSession } from "@/lib/session"

/** Sign-in modal — the app browses fine without it (no login wall). */
export default function SignInScreen() {
  const { signIn, signInApple } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Sign in with Apple — guarded require: binaries built before the native
  // module shipped share this JS via OTA and must not crash on import.
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
      // binary without the native module — no Apple button
    }
  }, [])

  async function onApple() {
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
        setError(err instanceof Error ? err.message : "Apple sign-in failed")
      }
    } finally {
      setBusy(false)
    }
  }

  function dismiss() {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  async function onSubmit() {
    if (!email.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      dismiss()
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
      <Pressable style={styles.close} onPress={dismiss} hitSlop={8}>
        <Ionicons name="close" size={24} color={ui.textMuted} />
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.logo}>
          sports<Text style={{ color: ui.primary }}>hub</Text>
        </Text>
        <Text style={styles.tagline}>Live scores, team chat and your family’s basketball life</Text>

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
          placeholder="Password"
          placeholderTextColor={ui.textFaint}
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

        {appleReady ? (
          <Pressable
            style={({ pressed }) => [styles.appleButton, (pressed || busy) && { opacity: 0.75 }]}
            onPress={onApple}
            disabled={busy}
          >
            <Ionicons name="logo-apple" size={18} color="#fff" />
            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.replace("/sign-up")} hitSlop={6}>
          <Text style={styles.footnote}>
            New to SportsHub? <Text style={styles.footnoteLink}>Create an account</Text>
          </Text>
        </Pressable>
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
  close: { position: "absolute", top: 20, right: 20, zIndex: 1, padding: 4 },
  card: { gap: 12 },
  logo: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
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
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: ui.text,
    backgroundColor: "#fff",
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
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footnote: {
    fontSize: 13,
    color: ui.textMuted,
    textAlign: "center",
    marginTop: 16,
  },
  footnoteLink: { color: ui.primary, fontWeight: "700" },
})
