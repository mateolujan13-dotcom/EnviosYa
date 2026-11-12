/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F6F2E9",
        "ink-950": "#08111F",
        "ink-900": "#0B1220",
        "ink-700": "#1E2A3B",
        "ink-500": "#4B5563",
        "signal-600": "#D93A00",
        "signal-500": "#FF5A1F",
        "route-600": "#1D4ED8",
        "route-100": "#DBEAFE",
        "sand-200": "#E7DFD1",
        "sand-300": "#D8D0C0",
        "mint-100": "#ECFCCB",
        "mint-300": "#B9F27C",
        "danger-100": "#FEE4E2",
        "danger-600": "#B42318",
        "warning-500": "#F59E0B",
      },
      fontFamily: {
        display: ["Archivo", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
      },
    },
  },
  plugins: [],
}
