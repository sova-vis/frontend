import type { Config } from "tailwindcss";

/**
 * Editorial design system ("Propel paper")
 * -----------------------------------------
 * Semantic tokens are driven by CSS variables defined in globals.css.
 * Each token is exposed as `rgb(var(--token) / <alpha-value>)` so that
 * exact colors AND Tailwind opacity utilities (e.g. `bg-paper/60`) both work,
 * and every color automatically adapts between light and dark themes.
 */
const ed = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ---- Editorial semantic palette (theme-aware) ---- */
        paper: { DEFAULT: ed("--paper"), soft: ed("--paper-soft") },
        surface: { DEFAULT: ed("--surface"), soft: ed("--surface-soft") },
        ink: {
          DEFAULT: ed("--ink"),
          muted: ed("--ink-muted"),
          faint: ed("--ink-faint"),
        },
        line: ed("--line"),
        crimson: {
          DEFAULT: ed("--crimson"),
          deep: ed("--crimson-deep"),
          soft: ed("--crimson-soft"),
          ink: ed("--crimson-ink"),
        },
        mint: { DEFAULT: ed("--mint"), soft: ed("--mint-soft"), ink: ed("--mint-ink") },
        gold: {
          DEFAULT: ed("--gold"),
          deep: ed("--gold-deep"),
          soft: ed("--gold-soft"),
          ink: ed("--gold-ink"),
        },
        clay: { DEFAULT: ed("--clay"), soft: ed("--clay-soft"), ink: ed("--clay-ink") },

        /* ---- Legacy shadcn-style tokens (kept for backward compat) ---- */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: {
          DEFAULT: ed("--crimson"),
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#F48FB1",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#FFD54F",
          foreground: "#1a1a1a",
        },
        sky: {
          DEFAULT: "#B2EBF2",
          foreground: "#1a1a1a",
        },
        brand: {
          red: ed("--crimson"),
          pink: "#F48FB1",
          burgundy: ed("--crimson"),
          yellow: "#FBC02D",
          blue: "#81D4FA",
          light: "#E1F5FE",
        },
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        input: "hsl(var(--input))",
        border: ed("--line"),
        ring: ed("--crimson"),
      },
      fontFamily: {
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 3px rgb(28 23 20 / 0.05), 0 1px 2px rgb(28 23 20 / 0.04)",
        "card-hover": "0 18px 40px -18px rgb(28 23 20 / 0.22)",
        crimson: "0 14px 30px -12px rgb(168 18 60 / 0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-22px) rotate(2deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        "spin-slow": "spin-slow 22s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
