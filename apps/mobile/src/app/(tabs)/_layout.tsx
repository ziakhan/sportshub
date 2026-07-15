import { Tabs } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { useHome, type NavShape } from "@/lib/home"
import { ui } from "@/lib/theme"

/**
 * N3-v2 tab bar parity with the web's mobile bottom tabs (site-ia-plan
 * §5.6.6): Home · Chat · Calendar (role-gated) · context slot (operator >
 * coach > parent > referee) · Account. Scores/Offers/Alerts stay as hidden
 * routes reachable from Home. Tab set derives from /api/mobile/home's nav
 * shape; until it loads, only the base tabs show.
 */

type IoniconName = keyof typeof Ionicons.glyphMap

function contextTab(shape: NavShape | undefined): { title: string; icon: IoniconName } | null {
  if (!shape) return null
  if (shape.isOperator) return { title: "Dashboard", icon: "grid-outline" }
  if (shape.coachTeams.length === 1) return { title: "My Team", icon: "people-outline" }
  if (shape.coachTeams.length > 1) return { title: "My Teams", icon: "people-outline" }
  if (shape.hasKids) return { title: "My Kids", icon: "people-outline" }
  if (shape.isRefereeing) return { title: "My Games", icon: "flag-outline" }
  return null
}

export default function TabsLayout() {
  const { home } = useHome()
  const shape = home?.shape
  const ctx = contextTab(shape)

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
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          href: shape?.hasCalendar ? "/(tabs)/calendar" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="context"
        options={{
          title: ctx?.title ?? "Mine",
          href: ctx ? "/(tabs)/context" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ctx?.icon ?? "people-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Reachable from Home, not tabs (web parity: these aren't top-level). */}
      <Tabs.Screen name="scores" options={{ href: null, title: "Live scores" }} />
      <Tabs.Screen name="offers" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="alerts" options={{ href: null, title: "Alerts" }} />
    </Tabs>
  )
}
