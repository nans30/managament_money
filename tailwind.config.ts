import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: {
          DEFAULT: '#111211',
          soft: '#1c1e1c',
          muted: '#2a2d2a',
        },
        limecard: {
          DEFAULT: '#c8f169',
          bright: '#d4f77a',
          deep: '#a6d642',
        },
        coral: {
          DEFAULT: '#ff7e5f',
          soft: '#ff967c',
        },
        brand: {
          50: '#f4f9e8',
          100: '#e6f5c6',
          500: '#2d6a4f',
          600: '#1b4332',
          700: '#081c15',
        },
        warm: {
          50: '#fff5f0',
          100: '#ffe4d6',
          500: '#f97316',
          600: '#ea580c',
          700: '#9a3412',
        },
      },
    },
  },
  plugins: [],
};

export default config;
