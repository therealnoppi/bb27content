import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-text)",
        muted: "var(--color-muted)",
        canvas: "var(--color-background)",
        forest: "var(--color-primary)",
        lime: "var(--color-secondary)",
        line: "var(--color-line)",
      },
      boxShadow: {
        card: "0 16px 48px rgba(27, 55, 45, 0.08)",
        float: "0 24px 80px rgba(22, 38, 32, 0.18)",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
