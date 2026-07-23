import type { Config } from "tailwindcss"
// Single token source (native-parity-v2 P0): the same package the RN app
// reads — the hand-synced hex copies below are gone.
import { tailwindTokens } from "@youthbasketballhub/design-tokens"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        navy: {
          50: "#f0f3f9",
          100: "#dae1ef",
          200: "#b8c6df",
          300: "#8ea4ca",
          400: "#6580b0",
          500: "#4a6596",
          600: "#3a507d",
          700: "#2f4066",
          800: "#1e2d4d",
          900: "#0f1b33",
          950: "#0b1628",
        },
        ink: tailwindTokens.colors.ink,
        court: tailwindTokens.colors.court,
        hoop: tailwindTokens.colors.hoop,
        play: tailwindTokens.colors.play,
        // Reserved strictly for live/in-progress states (live score dot, "LIVE"
        // badge). Scarcity keeps it meaningful — do not use as a general red.
        live: tailwindTokens.colors.live,
        // Highlight / featured / standings-leader accent. Used sparingly.
        gold: tailwindTokens.colors.gold,
        // Energy Pass semantic tokens — CSS-var backed so the admin-chosen
        // palette (PlatformSettings.themePalette → <html> style stamp) reskins
        // the site with zero rebuild. NOTE: plain var() colors don't support
        // Tailwind opacity modifiers (energy/50) — use the *-soft shades.
        energy: {
          DEFAULT: "var(--energy)",
          ink: "var(--energy-ink)",
          soft: "var(--energy-soft)",
          on: "var(--energy-on)",
        },
        stage: {
          DEFAULT: "var(--stage)",
          2: "var(--stage-2)",
        },
        highlight: {
          DEFAULT: "var(--highlight)",
          soft: "var(--highlight-soft)",
          on: "var(--highlight-on)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        // Athletic pair — scoped to the club/league public pages.
        condensed: ["var(--font-condensed)", "ui-sans-serif", "sans-serif"],
        barlow: ["var(--font-barlow)", "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      backgroundImage: {
        "mesh-light":
          "radial-gradient(ellipse 80% 50% at 20% 40%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 80% 20%, rgba(242,78,30,0.06) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 50% 80%, rgba(34,197,94,0.05) 0%, transparent 50%)",
      },
      boxShadow: {
        soft: "0 10px 40px rgba(24, 24, 27, 0.08)",
        panel: "0 18px 60px rgba(24, 24, 27, 0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
