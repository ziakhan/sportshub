import type { ReactNode } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { cardShadow, tones, ui, type Tone } from "@/lib/theme"

/**
 * Shared native primitives — the web design language (cards on a #fafafa
 * page, eyebrow section headers, status tone pills) as React Native
 * components. Every screen builds from these so the app reads as ONE
 * surface with the web (site-ia-plan §5.6.9).
 */

type IoniconName = keyof typeof Ionicons.glyphMap

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}) {
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    )
  }
  return <View style={[styles.card, style]}>{children}</View>
}

/** Web SectionHeader twin: colored uppercase eyebrow over a bold title. */
export function SectionHeader({
  eyebrow,
  title,
  accent = "play",
  action,
  onAction,
}: {
  eyebrow?: string
  title: string
  accent?: "play" | "court" | "hoop" | "gold" | "ink"
  action?: string
  onAction?: () => void
}) {
  const accentColor = {
    play: ui.primary,
    court: tones.positive.fg,
    hoop: ui.danger,
    gold: tones.gold.fg,
    ink: ui.textMuted,
  }[accent]
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: accentColor }]}>{eyebrow}</Text>
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** Tappable list row: icon · text (+sub) · chevron. */
export function ListRow({
  icon,
  text,
  sub,
  right,
  onPress,
}: {
  icon?: IoniconName
  text: string
  sub?: string | null
  right?: ReactNode
  onPress?: () => void
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.listRow, pressed && onPress && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      {icon ? <Ionicons name={icon} size={18} color={ui.primary} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listRowText} numberOfLines={1}>
          {text}
        </Text>
        {sub ? (
          <Text style={styles.listRowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={ui.textFaint} /> : null}
    </Pressable>
  )
}

/** Status pill in a tone family (web toneForStatus twin). */
export function TonePill({ tone, label }: { tone: Tone; label: string }) {
  const t = tones[tone]
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
  style,
}: {
  label: string
  onPress: () => void
  busy?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        (pressed || busy || disabled) && { opacity: 0.7 },
        style,
      ]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  )
}

export function OutlineButton({
  label,
  onPress,
  style,
}: {
  label: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.outlineButton, pressed && { opacity: 0.7 }, style]}
      onPress={onPress}
    >
      <Text style={styles.outlineButtonText}>{label}</Text>
    </Pressable>
  )
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: IoniconName
  title: string
  body?: string
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={ui.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  )
}

export function Avatar({ name, size = 32 }: { name: string | null | undefined; size?: number }) {
  const initials =
    (name ?? "")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  )
}

export function Loading() {
  return <ActivityIndicator style={{ marginTop: 40 }} color={ui.primary} />
}

/** Standard scrolling screen body on the gray page background. */
export function ScreenScroll({
  children,
  refreshControl,
}: {
  children: ReactNode
  refreshControl?: React.ReactElement<RefreshControlProps>
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  screenContent: { padding: 16, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: ui.surface,
    borderRadius: ui.radius.lg,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 14,
    gap: 4,
    ...cardShadow,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: ui.text },
  sectionAction: { fontSize: 13, fontWeight: "700", color: ui.primary, paddingBottom: 2 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  listRowText: { fontSize: 14, color: ui.text, fontWeight: "500" },
  listRowSub: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 11, fontWeight: "700" },
  primaryButton: {
    backgroundColor: ui.primary,
    borderRadius: ui.radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  outlineButton: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    backgroundColor: ui.surface,
    borderRadius: ui.radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  outlineButtonText: { color: ui.text, fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", padding: 28, gap: 6 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: ui.text, textAlign: "center" },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: "center", lineHeight: 19 },
  avatar: {
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800" },
})
