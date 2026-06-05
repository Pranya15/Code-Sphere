export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        aurora: "#7C3AED",
        violet: "#A855F7",
        cyan: "#06B6D4",
        neon: "#22D3EE",
        amber: "#F59E0B",
        gold: "#FBBF24",
        night: "#0B1020",
        carbon: "#111827",
        line: "rgba(148, 163, 184, 0.24)"
      },
      boxShadow: {
        panel: "0 24px 70px rgba(15, 23, 42, 0.12)",
        glow: "0 0 0 1px rgba(124, 58, 237, 0.16), 0 24px 80px rgba(6, 182, 212, 0.16)"
      }
    }
  },
  plugins: []
};
