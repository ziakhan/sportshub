import { Stack } from "expo-router"

/** Coach team stack — screens render their own SubHeader. */
export default function TeamStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
