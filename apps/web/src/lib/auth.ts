import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import AppleProvider from "next-auth/providers/apple"
import GoogleProvider from "next-auth/providers/google"
import { appleClientSecret, appleWebEnabled } from "@/lib/apple-web-auth"
import { authorizeCredentials } from "@/lib/auth-credentials"
import { redeemLoginCode, redeemLoginLink } from "@/lib/auth-magic"
import { ensureAppleUser, ensureGoogleUser } from "@/lib/auth-social"

// Google is env-gated: the provider (and its sign-in button, via
// /api/auth/providers) appears only once real OAuth credentials exist.
const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
// Apple (web) gated the same way — apple-web-auth.ts lists the four vars.
const appleEnabled = appleWebEnabled()

// Apple's callback is a cross-site POST (response_mode=form_post is
// mandatory when requesting name/email), so the PKCE/state/callback cookies
// must ride SameSite=None or the callback can't see them. Only on https —
// browsers drop None without Secure, which would break local http dev.
const secureBase = (process.env.NEXTAUTH_URL ?? "").startsWith("https://")
const crossSiteAuthCookies: NextAuthOptions["cookies"] = secureBase
  ? {
      pkceCodeVerifier: {
        name: "__Secure-next-auth.pkce.code_verifier",
        options: { httpOnly: true, sameSite: "none", path: "/", secure: true, maxAge: 900 },
      },
      state: {
        name: "__Secure-next-auth.state",
        options: { httpOnly: true, sameSite: "none", path: "/", secure: true, maxAge: 900 },
      },
      callbackUrl: {
        name: "__Secure-next-auth.callback-url",
        options: { sameSite: "none", path: "/", secure: true },
      },
    }
  : {}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  cookies: crossSiteAuthCookies,
  pages: {
    signIn: "/sign-in",
    newUser: "/onboarding",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeCredentials(credentials)
      },
    }),
    // Magic sign-in (lib/auth-magic.ts): either the emailed link token or
    // email + typed 6-digit code redeems the same single-use grant.
    CredentialsProvider({
      id: "magic",
      name: "magic",
      credentials: {
        token: { label: "Token", type: "text" },
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (credentials?.token) return redeemLoginLink(credentials.token)
        if (credentials?.email && credentials?.code) {
          return redeemLoginCode(credentials.email, credentials.code)
        }
        return null
      },
    }),
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(appleEnabled
      ? [
          AppleProvider({
            clientId: process.env.APPLE_CLIENT_ID!,
            // Apple has no static secret — an ES256 JWT signed with the
            // portal .p8 key, minted per process (apple-web-auth.ts).
            clientSecret: appleClientSecret(),
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "apple") {
        // profile = Apple's id_token claims. Same rule as Google: only a
        // provider-verified email may attach to an existing account. Apple
        // sends the user's name only in the first-auth form body, which v4
        // doesn't surface — new accounts start nameless (fixable in profile).
        const p = profile as { email?: string; email_verified?: boolean | string }
        const verified = p?.email_verified === true || p?.email_verified === "true"
        if (!p?.email || !verified) return false
        const dbUser = await ensureAppleUser({ email: p.email })
        if (!dbUser) return false
        user.id = dbUser.id
        return true
      }
      if (account?.provider !== "google") return true
      // Only trust addresses Google has verified — linking by email is safe
      // exactly because the provider attests ownership.
      const p = profile as { email_verified?: boolean; given_name?: string; family_name?: string }
      if (p?.email_verified === false) return false
      if (!user.email) return false
      const dbUser = await ensureGoogleUser({
        email: user.email,
        firstName: p?.given_name,
        lastName: p?.family_name,
        avatarUrl: user.image,
      })
      if (!dbUser) return false // suspended/deleted accounts stay out
      // Replace the provider's subject id with our DB id before jwt() runs.
      user.id = dbUser.id
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
