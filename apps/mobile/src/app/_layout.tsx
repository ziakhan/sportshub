import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect } from "react"
import { SessionProvider, useSession } from "@/lib/session"

SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { isLoading, signedIn } = useSession()

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync()
  }, [isLoading])

  if (isLoading) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  )
}
