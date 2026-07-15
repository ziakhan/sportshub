import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
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
import { useRealtime } from "@/lib/realtime"
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
  poll?: { id: string; question?: string } | null
  sender: { id: string; name: string; isStaff: boolean }
}

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
        const data = await apiJson<{ messages: ChatMessage[] }>(`/api/teams/${teamId}/messages`)
        if (!cancelled) setMessages(data.messages)
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
    events: { "chat.message": () => void fetchNewer() },
  })

  useEffect(() => {
    if (!loaded) return
    const timer = setInterval(fetchNewer, connected ? SLOW_POLL_MS : POLL_MS)
    return () => clearInterval(timer)
  }, [loaded, connected, fetchNewer])

  async function send() {
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
      <SubHeader title={(title as string) || "Chat"} />
      <KeyboardAvoidingView
        style={styles.screen}
        // Edge-to-edge Android (SDK 57 default) no longer resizes the window for
        // the keyboard, so "padding" is required on BOTH platforms.
        behavior="padding"
        keyboardVerticalOffset={insets.top + HEADER_TOOLBAR}
      >
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
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {!mine ? (
                <Text style={styles.sender}>
                  {item.sender.name}
                  {item.sender.isStaff ? "  ·  Staff" : ""}
                </Text>
              ) : null}
              <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
              {item.poll ? (
                <Text
                  style={styles.pollNote}
                  onPress={() => router.push(`/team/${teamId}`)}
                >
                  📊 Poll — tap to vote
                </Text>
              ) : null}
            </View>
          )
        }}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message the team"
          placeholderTextColor={ui.textMuted}
          value={input}
          onChangeText={setInput}
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
  pollNote: { fontSize: 12, color: ui.textMuted, marginTop: 4 },
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
