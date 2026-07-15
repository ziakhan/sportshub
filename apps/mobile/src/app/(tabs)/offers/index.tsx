import { useCallback, useEffect, useState } from "react"
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/**
 * Family offers — every roster offer for your players (?mine=true), open
 * ones first. Tap through to review packages and pay.
 */

export interface FamilyOffer {
  id: string
  status: string
  seasonFee: number
  expiresAt: string | null
  team: {
    id: string
    name: string
    ageGroup: string | null
    tenant: { name: string; currency: string }
  }
  player: { id: string; firstName: string; lastName: string }
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting response",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  RESCINDED: "Withdrawn",
}

export default function OffersListScreen() {
  const router = useRouter()
  const [offers, setOffers] = useState<FamilyOffer[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ offers: FamilyOffer[] }>("/api/offers?mine=true")
      const rank = (o: FamilyOffer) => (o.status === "PENDING" ? 0 : 1)
      setOffers([...data.offers].sort((a, b) => rank(a) - rank(b)))
    } catch {
      // pull-to-refresh retries
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <View style={styles.root}>
      <SubHeader title="Offers" />
      <FlatList
      style={styles.screen}
      contentContainerStyle={!offers || offers.length === 0 ? styles.emptyWrap : undefined}
      data={offers ?? []}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        offers ? (
          <Text style={styles.empty}>
            No offers yet — when a club offers your player a roster spot, it lands here.
          </Text>
        ) : null
      }
      renderItem={({ item }) => {
        const open = item.status === "PENDING"
        return (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({ pathname: "/offers/[offerId]", params: { offerId: item.id } })
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.team}>{item.team.name}</Text>
              <View style={[styles.status, open && styles.statusOpen]}>
                <Text style={[styles.statusText, open && styles.statusTextOpen]}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.sub}>
              {item.player.firstName} {item.player.lastName} · {item.team.tenant.name}
            </Text>
            <Text style={styles.fee}>
              {item.team.tenant.currency} {item.seasonFee.toFixed(2)} season fee
            </Text>
            {open && item.expiresAt ? (
              <Text style={styles.expires}>
                Respond by {new Date(item.expiresAt).toLocaleDateString()}
              </Text>
            ) : null}
          </Pressable>
        )
      }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
    backgroundColor: ui.surface,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 12,
    gap: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  team: { fontSize: 16, fontWeight: "700", color: ui.text, flex: 1 },
  status: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: ui.surface,
  },
  statusOpen: { backgroundColor: palette.court[100] },
  statusText: { fontSize: 12, fontWeight: "700", color: ui.textMuted },
  statusTextOpen: { color: palette.court[700] },
  sub: { fontSize: 13, color: ui.textMuted },
  fee: { fontSize: 15, fontWeight: "600", color: ui.text, marginTop: 2 },
  expires: { fontSize: 12, color: palette.hoop[600] },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { textAlign: "center", color: ui.textMuted, fontSize: 15, padding: 24 },
})
