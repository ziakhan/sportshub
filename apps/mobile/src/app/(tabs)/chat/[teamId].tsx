import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import { apiJson } from "@/lib/api"
import { PollBubble, type ChatPollData } from "@/components/poll-bubble"
import { emitTyping, useRealtime } from "@/lib/realtime"
import { useSession } from "@/lib/session"
import { palette, ui } from "@/lib/theme"

/**
 * Team chat conversation — same REST protocol as the web (?after= delta
 * polls, dedupe-by-id merge); a chat.message socket ping fetches the delta
 * immediately, and the poll stretches while the socket is live. Text only
 * in v1 (photos wait on object storage); polls render read-only.
 */

interface ChatMessage {
  id: string
  body: string
  createdAt: string
  editedAt?: string | null
  pinned?: boolean
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>
  poll?: ChatPollData | null
  sender: { id: string; name: string; isStaff: boolean; context?: string | null }
}

const REACTION_SET = ["👍", "❤️", "😂", "🎉", "🔥", "🏀"]

const POLL_MS = 5000
const SLOW_POLL_MS = 60_000
// SubHeader bar height; safe-area top is added at use site.
const HEADER_TOOLBAR = 56

export default function ConversationScreen() {
  const { teamId, title } = useLocalSearchParams<{ teamId: string; title?: string }>()
  const { user } = useSession()
  const insets = useSafeAreaInsets()
  const meId = user?.id ?? null
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [pinnedMsgs, setPinnedMsgs] = useState<ChatMessage[]>([])
  const [muted, setMuted] = useState(false)
  const [isStaffViewer, setIsStaffViewer] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [typingName, setTypingName] = useState<string | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef(0)
  // State stays chronological (append-only merge, ?after= cursor); the list
  // renders inverted, so newest-first is derived here.
  const newestFirst = useMemo(() => [...messages].reverse(), [messages])

  const mergeNewer = useCallback((incoming: ChatMessage[]) => {
    if (!incoming || incoming.length === 0) return
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      return fresh.length ? [...current, ...fresh] : current
    })
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiJson<{
          messages: ChatMessage[]
          pinned?: ChatMessage[]
          muted?: boolean
          membership?: { role: string }
        }>(`/api/teams/${teamId}/messages`)
        if (!cancelled) {
          setMessages(data.messages)
          setPinnedMsgs(data.pinned ?? [])
          setMuted(!!data.muted)
          setIsStaffViewer(data.membership?.role === "staff" || data.membership?.role === "admin")
        }
      } catch {
        // pull down to retry via poll
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [teamId])

  const fetchNewer = useCallback(async () => {
    const last = messages[messages.length - 1]
    const query = last ? `?after=${encodeURIComponent(last.createdAt)}` : ""
    try {
      const data = await apiJson<{ messages: ChatMessage[] }>(
        `/api/teams/${teamId}/messages${query}`
      )
      mergeNewer(data.messages)
    } catch {
      // next tick retries
    }
  }, [teamId, messages, mergeNewer])

  const { connected } = useRealtime({
    rooms: [`team:${teamId}`],
    events: {
      "chat.message": () => void fetchNewer(),
      typing: (payload: unknown) => {
        const p = payload as { userId?: string }
        if (!p?.userId || p.userId === meId) return
        setTypingName("Someone")
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setTypingName(null), 3000)
      },
    },
  })

  useEffect(() => {
    if (!loaded) return
    const timer = setInterval(fetchNewer, connected ? SLOW_POLL_MS : POLL_MS)
    return () => clearInterval(timer)
  }, [loaded, connected, fetchNewer])

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const data = await apiJson<{ reactions: ChatMessage["reactions"] }>(
        `/api/teams/${teamId}/messages/${messageId}/reactions`,
        { method: "POST", body: JSON.stringify({ emoji }) }
      )
      setMessages((cur) =>
        cur.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
      )
    } catch {
      // best-effort
    }
  }

  const onLongPress = (message: ChatMessage) => {
    const mine = meId !== null && message.sender.id === meId
    const buttons: any[] = REACTION_SET.slice(0, 3).map((e) => ({
      text: e,
      onPress: () => void toggleReaction(message.id, e),
    }))
    if (mine && !message.poll) {
      buttons.push({
        text: "Edit",
        onPress: () => {
          setEditingId(message.id)
          setInput(message.body)
        },
      })
    }
    if (mine || isStaffViewer) {
      buttons.push({
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiJson(`/api/teams/${teamId}/messages/${message.id}`, { method: "DELETE" })
            setMessages((cur) => cur.filter((m) => m.id !== message.id))
          } catch {
            Alert.alert("Couldn't delete")
          }
        },
      })
    }
    if (isStaffViewer) {
      buttons.push({
        text: message.pinned ? "Unpin" : "Pin",
        onPress: async () => {
          try {
            await apiJson(`/api/teams/${teamId}/messages/${message.id}`, {
              method: "PATCH",
              body: JSON.stringify({ pinned: !message.pinned }),
            })
            setMessages((cur) =>
              cur.map((m) => (m.id === message.id ? { ...m, pinned: !message.pinned } : m))
            )
            setPinnedMsgs((cur) =>
              message.pinned
                ? cur.filter((p) => p.id !== message.id)
                : [{ ...message, pinned: true }, ...cur].slice(0, 3)
            )
          } catch {
            Alert.alert("Couldn't update pin")
          }
        },
      })
    }
    buttons.push({ text: "Cancel", style: "cancel" })
    Alert.alert("Message", message.body.slice(0, 80), buttons)
  }

  const toggleMute = async () => {
    const next = !muted
    setMuted(next)
    try {
      await apiJson(`/api/teams/${teamId}/mute`, {
        method: "POST",
        body: JSON.stringify({ muted: next }),
      })
    } catch {
      setMuted(!next)
    }
  }

  const onComposerChange = (value: string) => {
    setInput(value)
    const now = Date.now()
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now
      emitTyping(`team:${teamId}`)
    }
  }

  async function send() {
    if (editingId) {
      const body = input.trim()
      if (!body || sending) return
      setSending(true)
      try {
        const data = await apiJson<{ message: { id: string; body: string; editedAt?: string } }>(
          `/api/teams/${teamId}/messages/${editingId}`,
          { method: "PATCH", body: JSON.stringify({ body }) }
        )
        setMessages((cur) =>
          cur.map((m) =>
            m.id === editingId ? { ...m, body: data.message.body, editedAt: data.message.editedAt ?? new Date().toISOString() } : m
          )
        )
        setEditingId(null)
        setInput("")
      } catch (err) {
        Alert.alert("Couldn't edit", err instanceof Error ? err.message : "Try again.")
      } finally {
        setSending(false)
      }
      return
    }
    return realSend()
  }

  async function realSend() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const data = await apiJson<{ message: ChatMessage }>(`/api/teams/${teamId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      })
      mergeNewer([data.message])
      setInput("")
    } catch {
      // keep the draft; the user can retry
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.root}>
      {/* Owner ruling 2026-07-17: the team NAME is the link to the team —
          entities are clickable; no redundant pills (Calendar lives in the
          tab bar). Polls rides as the single pill beside the mute bell. */}
      <SubHeader
        title={(title as string) || "Chat"}
        onTitlePress={() => router.push(`/team/${teamId}`)}
        right={
          <View style={styles.headerRight}>
            <Pressable
              style={({ pressed }) => [styles.quickPill, pressed && { backgroundColor: ui.surfaceSunken }]}
              onPress={() => router.push(`/team/${teamId}`)}
            >
              <Text style={styles.quickPillText}>Polls</Text>
            </Pressable>
            <Pressable onPress={() => void toggleMute()} hitSlop={8}>
              <Text style={{ fontSize: 16 }}>{muted ? "🔕" : "🔔"}</Text>
            </Pressable>
          </View>
        }
      />
      <KeyboardAvoidingView
        style={styles.screen}
        // Edge-to-edge Android (SDK 57 default) no longer resizes the window for
        // the keyboard, so "padding" is required on BOTH platforms.
        behavior="padding"
        keyboardVerticalOffset={insets.top + HEADER_TOOLBAR}
      >
      {pinnedMsgs.length > 0 ? (
        <View style={styles.pinnedBanner}>
          {pinnedMsgs.map((p) => (
            <Text key={p.id} style={styles.pinnedLine} numberOfLines={1}>
              📌 {p.sender?.name}: {p.body}
            </Text>
          ))}
        </View>
      ) : null}
      <FlatList
        style={styles.list}
        data={newestFirst}
        inverted={messages.length > 0}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.empty}>No messages yet — say hi to the team.</Text>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} />
          )
        }
        renderItem={({ item }) => {
          const mine = meId !== null && item.sender.id === meId
          return (
            <Pressable onLongPress={() => onLongPress(item)} delayLongPress={300}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {item.pinned ? <Text style={styles.pinTag}>📌 pinned</Text> : null}
                {!mine ? (
                  <Text style={styles.sender}>
                    {item.sender.name}
                    {item.sender.isStaff ? "  ·  Staff" : item.sender.context ? `  ·  ${item.sender.context}` : ""}
                  </Text>
                ) : null}
                <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
                {item.editedAt ? (
                  <Text style={[styles.editedTag, mine && { color: palette.play[200] }]}>(edited)</Text>
                ) : null}
                {item.poll?.options ? (
                  <PollBubble
                    teamId={teamId}
                    poll={item.poll}
                    onUpdate={(p) =>
                      setMessages((cur) =>
                        cur.map((m) => (m.id === item.id ? { ...m, poll: p } : m))
                      )
                    }
                  />
                ) : null}
              </View>
              {(item.reactions?.length ?? 0) > 0 ? (
                <View style={[styles.reactionRow, mine ? { alignSelf: "flex-end" } : null]}>
                  {item.reactions!.map((r) => (
                    <Pressable
                      key={r.emoji}
                      style={[styles.reactionChip, r.mine && styles.reactionChipMine]}
                      onPress={() => void toggleReaction(item.id, r.emoji)}
                    >
                      <Text style={styles.reactionText}>
                        {r.emoji} {r.count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Pressable>
          )
        }}
      />
      {typingName ? <Text style={styles.typing}>{typingName} is typing…</Text> : null}
      {editingId ? (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>Editing message</Text>
          <Pressable
            onPress={() => {
              setEditingId(null)
              setInput("")
            }}
            hitSlop={8}
          >
            <Text style={styles.editCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message the team"
          placeholderTextColor={ui.textMuted}
          value={input}
          onChangeText={onComposerChange}
          multiline
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={() => void send()}
        />
        <Pressable
          style={({ pressed }) => [styles.sendButton, (pressed || sending) && { opacity: 0.7 }]}
          onPress={send}
          disabled={sending || !input.trim()}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  list: { flex: 1, paddingHorizontal: 12 },
  listContent: { paddingVertical: 8 },
  empty: { textAlign: "center", color: ui.textMuted, marginTop: 40, fontSize: 15 },
  bubble: {
    maxWidth: "82%",
    borderRadius: ui.radius.md,
    padding: 10,
    marginVertical: 4,
  },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: ui.surface },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: palette.play[600] },
  sender: { fontSize: 12, fontWeight: "700", color: palette.play[700], marginBottom: 2 },
  body: { fontSize: 15, color: ui.text },
  bodyMine: { color: "#fff" },
  pinTag: { fontSize: 10, color: palette.gold[600], marginBottom: 2, fontWeight: "700" },
  editedTag: { fontSize: 10, color: ui.textFaint, marginTop: 2, fontStyle: "italic" },
  reactionRow: { flexDirection: "row", gap: 4, marginTop: -2, marginBottom: 4, marginHorizontal: 4 },
  reactionChip: {
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  reactionChipMine: { borderColor: palette.play[300], backgroundColor: palette.play[50] },
  reactionText: { fontSize: 11, color: ui.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  quickPill: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickPillText: { fontSize: 12, fontWeight: "600", color: ui.text },
  pinnedBanner: {
    backgroundColor: palette.gold[50],
    borderBottomWidth: 1,
    borderBottomColor: palette.gold[100],
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 2,
  },
  pinnedLine: { fontSize: 12, color: ui.text },
  typing: { fontSize: 11, color: ui.textFaint, fontStyle: "italic", paddingHorizontal: 14, paddingBottom: 2 },
  editBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: palette.play[50],
  },
  editBannerText: { fontSize: 12, color: palette.play[700], fontWeight: "700" },
  editCancel: { fontSize: 12, color: ui.danger, fontWeight: "700" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: ui.border,
    backgroundColor: ui.background,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: ui.text,
    maxHeight: 120,
    backgroundColor: ui.surface,
  },
  sendButton: {
    backgroundColor: ui.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
})
