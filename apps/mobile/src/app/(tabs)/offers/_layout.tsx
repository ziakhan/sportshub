import { Stack } from "expo-router"

/** Offers stack — screens render their own SubHeader. */
export default function OffersStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}
