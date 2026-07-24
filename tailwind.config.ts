import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FPEL-ish palette
        brand: {
          DEFAULT: "#0F766E",
          dark: "#0B5A54",
          light: "#14B8A6",
        },
        ink: "#1F2937",
      },
    },
  },
  plugins: [],
};

export default config;
