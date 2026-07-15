import { Stack } from "expo-router"

/** Account stack — screens render their own TopBar/SubHeader. */
export default function AccountStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
