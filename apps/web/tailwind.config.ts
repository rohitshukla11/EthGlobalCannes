import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--bg-0)",
        raised: "var(--bg-1)",
        overlay: "var(--bg-2)",
        subtle: "var(--bg-3)",
        selected: "var(--bg-4)",
        accent: "var(--accent)",
        dim: "var(--border-0)",
        mid: "var(--border-1)",
        strong: "var(--border-2)",
        primary: "var(--text-0)",
        secondary: "var(--text-1)",
        tertiary: "var(--text-2)",
        quaternary: "var(--text-3)",
        success: "var(--success)",
        error: "var(--error)",
        pending: "var(--pending)",
      },
      fontFamily: {
        display: ["var(--font-syne)", "ui-sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      maxWidth: {
        subtitle: "560px",
        shell: "1200px",
      },
      spacing: {
        sidebar: "var(--sidebar-w)",
      },
      borderRadius: {
        ui: "var(--radius-md)",
        control: "var(--radius-sm)",
        lg: "var(--radius-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
