/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app_src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-main)",
        surface: "var(--bg-surface)",
        border: "var(--border-main)",
        "border-subtle": "var(--border-subtle)",
        "border-accent": "var(--border-accent)",
        subtle: "var(--bg-subtle)",
        primary: {
          DEFAULT: "var(--primary-main)",
          hover: "var(--primary-hover)",
          light: "var(--bg-highlight)",
          accent: "var(--primary-accent)",
        },
        gov: {
          blue: "var(--gov-blue)",
          emblem: "var(--emblem-black)",
        },
        water: {
          DEFAULT: "var(--data-observed-well)",
          light: "#eef6fa",
        },
        data: {
          rainfall: "var(--data-rainfall-precip)",
        },
        earth: {
          DEFAULT: "#8c6239",
          light: "#f7f3ee",
        },
        text: {
          main: "var(--text-main)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
          inverted: "var(--text-inverted)",
        },
        status: {
          success: "var(--status-success)",
          successBg: "var(--status-success-bg)",
          successText: "var(--status-success-text)",
          warning: "var(--status-warning)",
          warningBg: "var(--status-warning-bg)",
          warningText: "var(--status-warning-text)",
          error: "var(--status-error)",
          errorBg: "var(--status-error-bg)",
          errorText: "var(--status-error-text)",
          info: "var(--status-info)",
          infoBg: "var(--status-info-bg)",
          infoText: "var(--status-info-text)",
          gap: "var(--status-gap)",
          gapBg: "var(--status-gap-bg)",
          demoBg: "var(--status-demo-bg)",
          demoText: "var(--status-demo-text)",
          demoBorder: "var(--status-demo-border)",
          researchBg: "var(--status-research-bg)",
          researchText: "var(--status-research-text)",
          researchBorder: "var(--status-research-border)",
        },
        risk: {
          normal: "var(--status-success)",
          normalBg: "var(--status-success-bg)",
          watch: "var(--status-warning-text)",
          watchBg: "var(--status-warning-bg)",
          severe: "var(--status-error)",
          severeBg: "var(--status-error-bg)",
          gap: "var(--status-gap)",
          gapBg: "var(--status-gap-bg)",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans"',
          '"Noto Sans Devanagari"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      fontSize: {
        'dbim-h1': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }], // 36px
        'dbim-h2': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],  // 24px
        'dbim-h3': ['1.25rem', { lineHeight: '1.35', fontWeight: '600' }],                           // 20px
        'dbim-p1': ['1rem', { lineHeight: '1.5' }],                                                  // 16px
        'dbim-p2': ['0.875rem', { lineHeight: '1.5' }],                                              // 14px
        'dbim-small': ['0.75rem', { lineHeight: '1.4' }],                                            // 12px
        'dbim-micro': ['0.6875rem', { lineHeight: '1.3' }],                                          // 11px
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        panel: "0 4px 12px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};
