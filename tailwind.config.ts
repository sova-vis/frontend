import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: {
          DEFAULT: "#990000", // Dark Red/Burgundy from top-left semi-circle
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#F48FB1", // Pink from large semi-circle
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#FFD54F", // Yellow from bottom-right quarter-circle
          foreground: "#1a1a1a",
        },
        sky: {
          DEFAULT: "#B2EBF2", // Light Blue from circle/triangle
          foreground: "#1a1a1a",
        },
        brand: {
          red: "#D32F2F", // Red diamond
          pink: "#F48FB1",
          burgundy: "#880E4F",
          yellow: "#FBC02D",
          blue: "#81D4FA",
          light: "#E1F5FE", // Very light blue for circle
        },
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        input: "hsl(var(--input))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
