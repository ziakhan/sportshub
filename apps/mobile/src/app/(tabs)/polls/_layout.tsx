import { Stack } from "expo-router"

/** Polls stack — screens render their own SubHeader. */
export default function PollsStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
