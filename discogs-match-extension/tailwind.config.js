const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'dashboard.html'),
    path.join(__dirname, 'dashboard.js')
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-highest": "#e4e2dd",
        "tertiary": "#5f5e5e",
        "background": "#fbf9f4",
        "surface-tint": "#835500",
        "surface-container": "#f0eee9",
        "on-tertiary-container": "#484747",
        "on-secondary-container": "#fefcff",
        "primary-fixed": "#ffddb4",
        "on-background": "#1b1c19",
        "on-tertiary": "#ffffff",
        "secondary-container": "#0070eb",
        "primary-fixed-dim": "#ffb955",
        "on-primary-fixed-variant": "#633f00",
        "surface": "#fbf9f4",
        "on-primary-container": "#644000",
        "on-secondary-fixed-variant": "#004493",
        "on-tertiary-fixed": "#1c1b1b",
        "on-primary": "#ffffff",
        "on-surface": "#1b1c19",
        "surface-container-low": "#f5f3ee",
        "surface-variant": "#e4e2dd",
        "tertiary-container": "#b8b6b5",
        "on-tertiary-fixed-variant": "#474646",
        "secondary": "#0058bc",
        "on-secondary-fixed": "#001a41",
        "surface-bright": "#fbf9f4",
        "surface-container-lowest": "#ffffff",
        "inverse-primary": "#ffb955",
        "surface-container-high": "#eae8e3",
        "on-surface-variant": "#524534",
        "primary-container": "#f5a623",
        "error": "#ba1a1a",
        "inverse-surface": "#30312e",
        "inverse-on-surface": "#f2f1ec",
        "tertiary-fixed": "#e5e2e1",
        "secondary-fixed-dim": "#adc6ff",
        "on-error-container": "#93000a",
        "on-secondary": "#ffffff",
        "surface-dim": "#dbdad5",
        "error-container": "#ffdad6",
        "tertiary-fixed-dim": "#c8c6c5",
        "on-error": "#ffffff",
        "on-primary-fixed": "#291800",
        "secondary-fixed": "#d8e2ff",
        "primary": "#835500",
        "outline": "#857462",
        "outline-variant": "#d7c3ae"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        unit: "4px",
        "margin-sm": "8px",
        "margin-lg": "32px",
        "margin-md": "16px",
        "container-padding": "24px",
        "gutter": "16px",
        "sidebar-width": "280px"
      },
      fontFamily: {
        "body-md": ["Inter", "sans-serif"],
        "headline-md": ["Montserrat", "sans-serif"],
        "display-lg": ["Montserrat", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "headline-lg": ["Montserrat", "sans-serif"],
        "headline-lg-mobile": ["Montserrat", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "label-md": ["Inter", "sans-serif"],
        "headline-sm": ["Montserrat", "sans-serif"]
      },
      fontSize: {
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "headline-md": ["24px", { lineHeight: "1.4", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "headline-lg": ["32px", { lineHeight: "1.3", fontWeight: "700" }],
        "headline-lg-mobile": ["28px", { lineHeight: "1.3", fontWeight: "700" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "1.4", fontWeight: "600" }]
      }
    }
  },
  plugins: []
}
