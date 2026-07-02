import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0a0a0a",
          2: "#1f2937",
          3: "#4b5563",
          4: "#9ca3af",
          5: "#e5e7eb",
          6: "#f3f4f6",
        },
        brand: {
          DEFAULT: "#1e3a8a",
          dark: "#1e293b",
          accent: "#3b82f6",
        },
        accent: {
          gold: "#a8862d",
        },
      },
      fontFamily: {
        serif: ['"Source Han Serif SC"', '"Noto Serif SC"', '"Songti SC"', "STSong", "SimSun", "serif"],
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite both",
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 80%, 100%": { transform: "scale(0)", opacity: "0" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;