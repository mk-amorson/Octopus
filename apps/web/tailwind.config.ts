import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        // Our stylised pixel font — proportional letters with a fixed
        // 1-pixel gap, monospace digits. Load order in layout.tsx exposes
        // it as the --font-octopus-pixel CSS var.
        pixel: ["var(--font-octopus-pixel)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
