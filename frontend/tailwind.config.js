/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          light: '#dbeafe',
        },
        profit: {
          DEFAULT: '#22c55e',
          light: '#dcfce7',
        },
        loss: {
          DEFAULT: '#ef4444',
          light: '#fee2e2',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
        },
        info: {
          DEFAULT: '#3b82f6',
          light: '#dbeafe',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
        },
        border: {
          DEFAULT: '#e2e8f0',
        },
        'text-primary': '#0f172a',
        'text-secondary': '#475569',
        'text-muted': '#94a3b8',
        dark: {
          surface: {
            DEFAULT: '#0f172a',
            secondary: '#1e293b',
            tertiary: '#334155',
          },
          border: '#334155',
          'text-primary': '#f1f5f9',
          'text-secondary': '#94a3b8',
          'text-muted': '#64748b',
        },
        sidebar: {
          DEFAULT: '#1e293b',
          hover: '#334155',
          active: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};
