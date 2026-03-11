import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        signal: "rgb(var(--color-signal) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["'IBM Plex Sans JP'", "sans-serif"],
        display: ["'Fraunces'", "serif"]
      },
      boxShadow: {
        panel: "0 18px 80px rgba(15, 23, 42, 0.08)"
      },
      maxWidth: {
        prose: "72ch"
      }
    }
  },
  plugins: [typography]
};
