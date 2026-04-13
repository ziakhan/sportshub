import type { Config } from "tailwindcss"

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
        ink: {
          50: "#f7f7f8",
          100: "#eeeef1",
          200: "#d9d9df",
          300: "#b8b8c3",
          400: "#9191a1",
          500: "#747486",
          600: "#5e5e6e",
          700: "#4d4d5a",
          800: "#42424c",
          900: "#3a3a42",
          950: "#18181b",
        },
        court: {
          50: "#f0fdf0",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        hoop: {
          50: "#fef3ee",
          100: "#fee5d6",
          200: "#fcc7ac",
          300: "#f9a178",
          400: "#f57041",
          500: "#f24e1e",
          600: "#e33612",
          700: "#bc2711",
          800: "#962216",
          900: "#792015",
        },
        play: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
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
