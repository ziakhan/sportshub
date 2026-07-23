import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useState, type ReactElement } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { StripeProvider } from "@stripe/stripe-react-native"
import { SessionProvider, useSession } from "@/lib/session"
import { ThemeProvider } from "@/lib/theme-context"
import { useMobileConfig } from "@/lib/config"
import { routePushResponses } from "@/lib/push"
import { ui } from "@/lib/theme"
import {
  useFonts,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit"
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
} from "@expo-google-fonts/work-sans"
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed"

SplashScreen.preventAutoHideAsync()

function ForcedUpgrade({ minVersion }: { minVersion: string }) {
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])
  return (
    <View style={styles.upgradeScreen}>
      <Text style={styles.upgradeTitle}>Update required</Text>
      <Text style={styles.upgradeBody}>
        This version of SportsHub is out of date (needs {minVersion}+). Update from the store to
        keep going.
      </Text>
      <Pressable
        style={styles.upgradeButton}
        onPress={() => Linking.openURL("market://details?id=com.sportshub.app").catch(() => {})}
      >
        <Text style={styles.upgradeButtonText}>Open store</Text>
      </Pressable>
    </View>
  )
}

/**
 * No login wall (audit v2 §1): the tabs render for everyone — anonymous
 * users browse the public layer; sign-in/sign-up are modals invoked from
 * the top bar or a gated action. Push taps deep-link once the navigator
 * is mounted.
 */
function RootNavigator() {
  const { isLoading } = useSession()
  // The same brand fonts the web loads via next/font (native-parity-v2 P0):
  // typography was the single biggest looks-different gap.
  const [fontsLoaded] = useFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  })
  // OTA safety: never hold the splash hostage to font loading — after 2.5s
  // we proceed on system fonts (release builds fall back silently).
  const [fontTimeout, setFontTimeout] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 2500)
    return () => clearTimeout(t)
  }, [])
  const fontsReady = fontsLoaded || fontTimeout

  useEffect(() => {
    if (!isLoading && fontsReady) SplashScreen.hideAsync()
  }, [isLoading, fontsReady])

  useEffect(() => {
    if (isLoading) return
    return routePushResponses()
  }, [isLoading])

  if (isLoading || !fontsReady) return null

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
        <Stack.Screen name="sign-up" options={{ presentation: "modal" }} />
      </Stack>
    </>
  )
}

/** Stripe only mounts once the publishable key arrives (test/prod chosen server-side). */
function MaybeStripe({ pk, children }: { pk: string | null; children: ReactElement }) {
  if (!pk) return children
  return (
    <StripeProvider publishableKey={pk} merchantIdentifier="merchant.com.sportshub.app">
      {children}
    </StripeProvider>
  )
}

export default function RootLayout() {
  const { config, mustUpgrade } = useMobileConfig()
  if (mustUpgrade && config) return <ForcedUpgrade minVersion={config.minVersion} />
  return (
    <ThemeProvider palette={config?.palette}>
      <MaybeStripe pk={config?.stripePublishableKey ?? null}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </MaybeStripe>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  upgradeScreen: {
    flex: 1,
    backgroundColor: ui.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  upgradeTitle: { fontSize: 22, fontWeight: "800", color: ui.text },
  upgradeBody: { fontSize: 15, color: ui.textMuted, textAlign: "center" },
  upgradeButton: {
    backgroundColor: ui.primary,
    borderRadius: ui.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  upgradeButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
})
