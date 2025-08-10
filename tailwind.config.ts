import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: "#0b0e14",
          panel: "#12161f",
          border: "#232838",
          amber: "#f5a524",
          amberDim: "#7a5417",
          text: "#e6e9f0",
          dim: "#8b93a7",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
