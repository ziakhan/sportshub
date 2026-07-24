import { Stack } from "expo-router"

/** Event-detail stack — screens render their own SubHeader. */
export default function EventStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
