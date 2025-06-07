import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Geist Variable",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "Geist Mono Variable",
          "monaco",
          "Consolas",
          "Lucida Console",
          "monospace",
        ],
      },
    },
  },
  plugins: [
    require("@tailwindcss/container-queries"),
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("tailwindcss-animate"),
    require("tailwind-scrollbar"),
    require("tailwind-scrollbar-hide"),
    require("tailwindcss-textshadow"),
  ],
} satisfies Config;
