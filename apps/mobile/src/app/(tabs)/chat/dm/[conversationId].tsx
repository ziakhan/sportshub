import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import { apiJson } from "@/lib/api"
import { useRealtime } from "@/lib/realtime"
import { useSession } from "@/lib/session"
import { palette, ui } from "@/lib/theme"

/** Direct-message thread — same protocol as team chat (delta poll + ping). */

interface DmMessage {
  id: string
  body: string
  createdAt: string
  editedAt: string | null
  sender: { id: string; name: string }
}

const POLL_MS = 5000
const SLOW_POLL_MS = 60_000
const HEADER_TOOLBAR = 56

export default function DmThreadScreen() {
  const { conversationId, title } = useLocalSearchParams<{
    conversationId: string
    title?: string
  }>()
  const { user } = useSession()
  const insets = useSafeAreaInsets()
  const meId = user?.id ?? null
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [otherName, setOtherName] = useState<string>((title as string) || "Chat")
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const newestFirst = useMemo(() => [...messages].reverse(), [messages])

  const mergeNewer = useCallback((incoming: DmMessage[]) => {
    if (!incoming || incoming.length === 0) return
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      return fresh.length ? [...current, ...fresh] : current
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiJson<{ messages: DmMessage[]; conversation: { otherName: string } }>(
          `/api/conversations/${conversationId}/messages`
        )
        if (!cancelled) {
          setMessages(data.messages)
          if (data.conversation?.otherName) setOtherName(data.conversation.otherName)
        }
      } catch {
        // poll retries
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conversationId])

  const fetchNewer = useCallback(async () => {
    const last = messages[messages.length - 1]
    const query = last ? `?after=${encodeURIComponent(last.createdAt)}` : ""
    try {
      const data = await apiJson<{ messages: DmMessage[] }>(
        `/api/conversations/${conversationId}/messages${query}`
      )
      mergeNewer(data.messages)
    } catch {
      // next tick retries
    }
  }, [conversationId, messages, mergeNewer])

  const { connected } = useRealtime({
    rooms: [],
    events: { "dm.message": () => void fetchNewer() },
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
      const data = await apiJson<{ message: DmMessage }>(
        `/api/conversations/${conversationId}/messages`,
        { method: "POST", body: JSON.stringify({ body }) }
      )
      mergeNewer([data.message])
      setInput("")
    } catch {
      // keep the draft
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.root}>
      <SubHeader title={otherName} />
      <KeyboardAvoidingView
        style={styles.screen}
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
              <Text style={styles.empty}>No messages yet — say hi.</Text>
            ) : (
              <ActivityIndicator style={{ marginTop: 40 }} />
            )
          }
          renderItem={({ item }) => {
            const mine = meId !== null && item.sender.id === meId
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
              </View>
            )
          }}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={`Message ${otherName}`}
            placeholderTextColor={ui.textFaint}
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
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: ui.surfaceSunken },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: palette.play[600] },
  body: { fontSize: 15, color: ui.text },
  bodyMine: { color: "#fff" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: ui.border,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: ui.text,
    maxHeight: 120,
    backgroundColor: ui.surfaceSunken,
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
