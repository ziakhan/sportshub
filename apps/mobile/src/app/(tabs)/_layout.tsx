import { Tabs } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { useHome, type NavShape } from "@/lib/home"
import { useSession } from "@/lib/session"
import { ui } from "@/lib/theme"

/**
 * Tab bar (N3-v2 §5.6.6 + audit v2): Home and Browse exist for EVERYONE —
 * anonymous users browse like the public web. Signed-in users additionally
 * get Chat · Calendar (role-gated) · the role context slot (operator >
 * coach > parent > referee) · Account. Scores/Offers/Alerts and the native
 * detail stacks (kids, team, referee, operator) are hidden routes reachable
 * from Home, the top bar and deep links.
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
  const { signedIn } = useSession()
  const { home } = useHome()
  const shape = home?.shape
  const ctx = contextTab(shape)

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // screens render the branded TopBar themselves
        tabBarActiveTintColor: ui.primary,
        tabBarInactiveTintColor: ui.textMuted,
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: ui.border },
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
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          href: signedIn ? "/(tabs)/chat" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          href: signedIn && shape?.hasCalendar ? "/(tabs)/calendar" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="context"
        options={{
          title: ctx?.title ?? "Mine",
          href: signedIn && ctx ? "/(tabs)/context" : null,
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
      {/* Hidden routes — reachable from Home, the top bar and deep links. */}
      <Tabs.Screen name="scores" options={{ href: null, title: "Live scores" }} />
      <Tabs.Screen name="offers" options={{ href: null }} />
      <Tabs.Screen name="alerts" options={{ href: null, title: "Alerts" }} />
      <Tabs.Screen name="kids" options={{ href: null }} />
      <Tabs.Screen name="team" options={{ href: null }} />
      <Tabs.Screen name="referee" options={{ href: null, title: "Refereeing" }} />
      <Tabs.Screen name="operator" options={{ href: null, title: "Operations" }} />
    </Tabs>
  )
}
