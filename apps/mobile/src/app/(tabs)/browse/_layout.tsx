import { Stack } from "expo-router"

/** Browse stack — every screen renders its own TopBar/SubHeader. */
export default function BrowseStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
