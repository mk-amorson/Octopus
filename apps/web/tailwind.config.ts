import type { Config } from "tailwindcss";

// Single source of truth for the typeface: every Tailwind font-family
// alias resolves to the same octopus-pixel stack. `var(--font-
// octopus-pixel)` is exposed by next/font/local in layout.tsx;
// `ui-monospace` is the fallback while that variable hasn't
// hydrated yet.
const PIXEL_STACK = ["var(--font-octopus-pixel)", "ui-monospace", "monospace"];

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: PIXEL_STACK,
        mono: PIXEL_STACK,
        pixel: PIXEL_STACK,
      },
    },
  },
  plugins: [],
};

export default config;
