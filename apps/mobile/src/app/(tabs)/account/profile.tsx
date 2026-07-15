import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SubHeader } from "@/components/top-bar"
import { Card, Loading, PrimaryButton } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/** Edit profile — GET/PATCH /api/user/profile, native. */

interface Profile {
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  email: string
  city: string | null
  state: string | null
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [city, setCity] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<Profile>("/api/user/profile")
      .then((p) => {
        setProfile(p)
        setFirstName(p.firstName ?? "")
        setLastName(p.lastName ?? "")
        setPhoneNumber(p.phoneNumber ?? "")
        setCity(p.city ?? "")
      })
      .catch(() => setError("Couldn't load your profile"))
  }, [])

  async function save() {
    if (busy) return
    setBusy(true)
    setNote(null)
    setError(null)
    try {
      await apiJson("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phoneNumber.trim() || null,
          city: city.trim() || null,
        }),
      })
      setNote("Saved")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.root}>
      <SubHeader title="Edit profile" />
      {!profile && !error ? (
        <Loading />
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <Card>
            <Text style={styles.label}>First name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
            <Text style={styles.label}>Last name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="Optional"
              placeholderTextColor={ui.textFaint}
            />
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Optional"
              placeholderTextColor={ui.textFaint}
            />
            {profile?.email ? <Text style={styles.emailNote}>Signed in as {profile.email}</Text> : null}
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <PrimaryButton label="Save" onPress={save} busy={busy} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: ui.text,
    backgroundColor: ui.surfaceSunken,
    marginTop: 4,
  },
  emailNote: { fontSize: 12, color: ui.textFaint, marginTop: 10 },
  error: { color: palette.hoop[600], fontSize: 14, textAlign: "center" },
  note: { color: palette.court[700], fontSize: 14, textAlign: "center" },
})
