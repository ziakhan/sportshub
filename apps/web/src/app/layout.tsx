import type { Metadata } from "next"
import { Outfit, Work_Sans } from "next/font/google"
import AuthProvider from "./session-provider"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
})

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Youth Basketball Hub",
  description: "The complete platform for youth basketball clubs, leagues, and families",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${workSans.variable} font-body`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
