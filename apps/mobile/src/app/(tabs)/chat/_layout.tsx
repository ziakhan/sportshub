import { Stack } from "expo-router"
import { ui } from "@/lib/theme"

export default function ChatStack() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontWeight: "700", color: ui.text },
        headerTintColor: ui.primary,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Team chat" }} />
      <Stack.Screen name="[teamId]" options={{ title: "Chat" }} />
    </Stack>
  )
}
