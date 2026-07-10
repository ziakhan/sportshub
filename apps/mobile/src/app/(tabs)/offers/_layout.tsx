import { Stack } from "expo-router"
import { ui } from "@/lib/theme"

export default function OffersStack() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontWeight: "700", color: ui.text },
        headerTintColor: ui.primary,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Offers" }} />
      <Stack.Screen name="[offerId]" options={{ title: "Offer" }} />
    </Stack>
  )
}
