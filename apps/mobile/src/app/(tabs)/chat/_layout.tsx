import { Stack } from "expo-router"

/** Chat stack — list renders the TopBar, the thread renders a SubHeader. */
export default function ChatStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
