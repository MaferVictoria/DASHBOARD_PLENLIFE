/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F6F4EF',
        ink: '#16241E',
        panel: '#FFFFFF',
        line: '#E2DED2',
        forest: {
          DEFAULT: '#173C32',
          light: '#245645',
        },
        gold: {
          DEFAULT: '#C98A2C',
          light: '#E3AE5C',
        },
        rise: '#3E8F62',
        fall: '#B54B3B',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, #16241E12 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '16px 16px',
      },
    },
  },
  plugins: [],
};
