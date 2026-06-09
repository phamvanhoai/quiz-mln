import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18202f",
        paper: "#f7f4ec",
        brand: "#2563eb"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(24,32,47,0.10)"
      }
    }
  },
  plugins: []
};

export default config;
