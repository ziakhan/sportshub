import { Platform } from "react-native"

/**
 * Native Google sign-in — guarded require, same rule as the Apple button:
 * binaries built before this native module shipped (iOS build ≤6, Android
 * vc≤4) share this JS via OTA and must not crash on import.
 *
 * Client ids are public identifiers. The app configures the WEB client id so
 * the idToken's audience is the web id — the server verifies against it
 * (apps/web .../api/auth/token/google). The iOS/Android OAuth clients exist
 * in the same GCP project keyed to our bundle id / package + signing SHA-1.
 */

const WEB_CLIENT_ID = "1011644585799-2kdrfavpo2qvrqean14jslnr2dds3sjk.apps.googleusercontent.com"
const IOS_CLIENT_ID = "1011644585799-jgim78lhp8plp8pu3apv5eqtua8m66gh.apps.googleusercontent.com"

type GoogleModule = typeof import("@react-native-google-signin/google-signin")

// undefined = not attempted yet, null = binary without the native module
let googleModule: GoogleModule | null | undefined

function loadGoogle(): GoogleModule | null {
  if (googleModule !== undefined) return googleModule
  try {
    const mod = require("@react-native-google-signin/google-signin") as GoogleModule
    mod.GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID,
    })
    googleModule = mod
  } catch {
    googleModule = null
  }
  return googleModule
}

export function googleAvailable(): boolean {
  return loadGoogle() !== null
}

/**
 * Opens the native Google account sheet. Resolves with the idToken to send
 * to the server, or null when the user backed out (not an error).
 */
export async function googleIdToken(): Promise<string | null> {
  const mod = loadGoogle()
  if (!mod) throw new Error("Google sign-in isn't available in this build")
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = mod
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  }
  try {
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return null // user cancelled
    if (!response.data.idToken) throw new Error("Google didn't return a token")
    return response.data.idToken
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return null
    throw err
  }
}
