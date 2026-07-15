import { Stack } from "expo-router"

/** My Kids stack — screens render their own SubHeader. */
export default function KidsStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
