import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#132a2b',
        pine: '#126e5b',
        mint: '#d9f2e8',
        canvas: '#f5f8f6',
      },
      boxShadow: {
        card: '0 18px 55px rgba(16, 52, 45, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
