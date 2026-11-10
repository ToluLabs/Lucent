import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#080A0E",
        surface: { DEFAULT: "#0C0F14", 2: "#11151C" },
        card: { DEFAULT: "#11151C", hover: "#191E27" },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          hover: "rgba(255,255,255,0.18)",
        },
        text: { primary: "#FFFFFF", secondary: "#B8BEC8", muted: "#9AA3B1" },
        accent: {
          DEFAULT: "#EFD28D",
          hover: "#F9E6B8",
          glow: "rgba(239,210,141,0.12)",
          bg: "rgba(239,210,141,0.07)",
        },
        encrypted: {
          DEFAULT: "#A78BFA",
          bg: "rgba(167,139,250,0.10)",
          glow: "rgba(167,139,250,0.15)",
        },
        success: "#34D399",
        error: "#FF9292",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Manrope", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out",
        grain: "grain 8s steps(10) infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "blur-in": "blurIn 0.7s cubic-bezier(0.4,0,0.2,1)",
        shimmer: "shimmer 2.5s linear infinite",
        "encrypted-pulse": "encryptedPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        grain: {
          "0%,100%": { transform: "translate(0,0)" },
          "10%": { transform: "translate(-2%,-3%)" },
          "30%": { transform: "translate(3%,-1%)" },
          "50%": { transform: "translate(-1%,2%)" },
          "70%": { transform: "translate(2%,1%)" },
          "90%": { transform: "translate(-3%,3%)" },
        },
        glowPulse: {
          "0%,100%": { boxShadow: "0 0 20px rgba(251,187,36,0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(251,187,36,0.25)" },
        },
        blurIn: {
          "0%": { filter: "blur(8px)", opacity: "0" },
          "100%": { filter: "blur(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        encryptedPulse: {
          "0%,100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      backdropBlur: { "2xl": "40px", "3xl": "64px" },
    },
  },
  plugins: [],
} satisfies Config;
