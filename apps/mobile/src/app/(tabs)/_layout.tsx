import { Tabs } from "expo-router"
import { Pressable, Text, View } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { useHome, type NavShape } from "@/lib/home"
import { useSession } from "@/lib/session"
import { ui } from "@/lib/theme"
import { useTheme } from "@/lib/theme-context"

/**
 * Tab bar (N3-v2 §5.6.6 + audit v2): Home and Browse exist for EVERYONE —
 * anonymous users browse like the public web. Signed-in users additionally
 * get Chat · Calendar (role-gated) · the role context slot (operator >
 * coach > parent > referee) · Account. Scores/Offers/Alerts and the native
 * detail stacks (kids, team, referee, operator) are hidden routes reachable
 * from Home, the top bar and deep links.
 */

type IoniconName = keyof typeof Ionicons.glyphMap

/** ⚠️ expo-router Tabs THROWS if a screen sets both `href` and
 *  `tabBarButton` (TabsClient.js "Cannot use href and tabBarButton
 *  together") — this crashed the first TestFlight OTA at launch. Signed-out
 *  gating therefore lives INSIDE tabBarButton (return null), never via
 *  href, on any screen with a custom button. */

/** Energy Pass tab (owner-refined): the WHOLE focused tab — icon and label —
 *  sits in one filled energy capsule. Rendered via tabBarButton (not the
 *  tabBarIcon slot): iOS constrains the icon slot and ellipsized our labels
 *  + misaligned the capsule (owner screenshot, first TestFlight build). */
function TabButton({
  name,
  label,
  accessibilityState,
  ...props
}: {
  name: IoniconName
  label: string
  accessibilityState?: { selected?: boolean }
} & React.ComponentProps<typeof Pressable>) {
  // expo-router's vendored bottom-tabs passes `aria-selected`, NOT
  // accessibilityState.selected (BottomTabItem.js:109) — reading only the
  // latter left every tab unfocused/gray in build 6 (owner report).
  const focused =
    ((props as Record<string, unknown>)["aria-selected"] as boolean | undefined) ??
    accessibilityState?.selected ??
    false
  const t = useTheme()
  return (
    <Pressable
      {...props}
      accessibilityState={accessibilityState}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 17,
          paddingHorizontal: 13,
          paddingVertical: 4,
          minWidth: 62,
          backgroundColor: focused ? t.energy : "transparent",
        }}
      >
        <Ionicons name={name} size={20} color={focused ? t.energyOn : ui.textMuted} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 10,
            fontWeight: "700",
            marginTop: 1,
            color: focused ? t.energyOn : ui.textMuted,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
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
        tabBarShowLabel: false, // labels live inside the TabButton capsule
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: ui.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarButton: (props) => <TabButton {...(props as object)} name="home-outline" label="Home" />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarButton: (props) => <TabButton {...(props as object)} name="search-outline" label="Browse" />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarItemStyle: signedIn ? undefined : { display: "none" },
          tabBarButton: (props) =>
            signedIn ? (
              <TabButton {...(props as object)} name="chatbubbles-outline" label="Chat" />
            ) : null,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarItemStyle: signedIn && shape?.hasCalendar ? undefined : { display: "none" },
          tabBarButton: (props) =>
            signedIn && shape?.hasCalendar ? (
              <TabButton {...(props as object)} name="calendar-outline" label="Calendar" />
            ) : null,
        }}
      />
      <Tabs.Screen
        name="context"
        options={{
          title: ctx?.title ?? "Mine",
          tabBarItemStyle: signedIn && ctx ? undefined : { display: "none" },
          tabBarButton: (props) =>
            signedIn && ctx ? (
              <TabButton
                {...(props as object)}
                name={ctx?.icon ?? "people-outline"}
                label={ctx?.title ?? "Mine"}
              />
            ) : null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarButton: (props) => <TabButton {...(props as object)} name="person-circle-outline" label="Account" />,
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
