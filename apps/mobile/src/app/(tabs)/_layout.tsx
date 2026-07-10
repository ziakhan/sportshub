import { Tabs } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { ui } from "@/lib/theme"

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ui.primary,
        tabBarInactiveTintColor: ui.textMuted,
        headerTitleStyle: { fontWeight: "700", color: ui.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Scores",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basketball-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
