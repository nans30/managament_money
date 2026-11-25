import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warna hangat dan netral, tanpa merah agresif untuk uang tipis
        brand: {
          50: '#f4f7f5',
          100: '#e3ebe6',
          500: '#2d6a4f',
          600: '#1b4332',
          700: '#081c15',
        },
        warm: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
        }
      }
    },
  },
  plugins: [],
};

export default config;
