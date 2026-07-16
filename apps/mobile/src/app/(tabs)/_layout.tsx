import { Tabs } from "expo-router"
import { Text, View } from "react-native"
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

/** Energy Pass tab (owner-refined 2026-07-15): the WHOLE focused tab — icon
 *  and label — sits in one filled energy capsule (web BottomTabs twin).
 *  Labels render in here, so the navigator's own labels are switched off. */
function TabIcon({
  name,
  label,
  focused,
}: {
  name: IoniconName
  label: string
  focused: boolean
}) {
  return (
    <View
      style={{
        minWidth: 58,
        borderRadius: 17,
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: focused ? ui.energy : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={20} color={focused ? ui.energyOn : ui.textMuted} />
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: focused ? ui.energyOn : ui.textMuted,
          marginTop: 1,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

function operatorTitle(shape: NavShape): string {
  // "Dashboard" retired as a label (owner 2026-07-15) — name the thing.
  if (shape.isClubStaff && shape.isLeagueOwner) return "Manage"
  if (shape.isClubStaff) return "My Club"
  if (shape.isLeagueOwner) return "My League"
  return "Admin"
}

function contextTab(shape: NavShape | undefined): { title: string; icon: IoniconName } | null {
  if (!shape) return null
  if (shape.isOperator)
    return {
      title: operatorTitle(shape),
      icon: shape.isClubStaff ? "business-outline" : shape.isLeagueOwner ? "trophy-outline" : "grid-outline",
    }
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
        tabBarShowLabel: false, // labels live inside the TabIcon capsule
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: ui.border, height: 78 },
        tabBarItemStyle: { paddingTop: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name="home-outline" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ focused }) => <TabIcon name="search-outline" label="Browse" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          href: signedIn ? "/(tabs)/chat" : null,
          tabBarIcon: ({ focused }) => <TabIcon name="chatbubbles-outline" label="Chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          href: signedIn && shape?.hasCalendar ? "/(tabs)/calendar" : null,
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" label="Calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="context"
        options={{
          title: ctx?.title ?? "Mine",
          href: signedIn && ctx ? "/(tabs)/context" : null,
          tabBarIcon: ({ focused }) => <TabIcon name={ctx?.icon ?? "people-outline"} label={ctx?.title ?? "Mine"} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <TabIcon name="person-circle-outline" label="Account" focused={focused} />,
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
