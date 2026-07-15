import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { authorizeCredentials } from "@/lib/auth-credentials"
import { redeemLoginCode, redeemLoginLink } from "@/lib/auth-magic"
import { ensureGoogleUser } from "@/lib/auth-social"

// Google is env-gated: the provider (and its sign-in button, via
// /api/auth/providers) appears only once real OAuth credentials exist.
const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
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
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
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
