/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Plenlife brand kit — exact hexes.
        paper: '#EEF5FA',   // page background (a light tint of the brand blue, not flat white,
                             // so white panels/cards still stand out on the page)
        panel: '#FFFFFF',   // card/surface background — brand white, exact
        line: '#D9E6EF',    // hairline dividers, tinted from the brand blue
        ink: '#0B2A45',     // body/heading text — a dark navy derived from the brand blues
                             // (pure black would clash with the blue palette; this reads as
                             // "brand navy" instead of generic black)
        brand: {
          DEFAULT: '#086eb6', // deep blue — primary brand color
          bright: '#009dde',  // sky blue — secondary brand color / interactive accent
        },
        rise: '#2F9E5C', // kept neutral (not brand blue) so it only ever means "up"
        fall: '#C0473A', // kept neutral (not brand blue) so it only ever means "down/error"
      },
      fontFamily: {
        display: ['var(--font-poppins)'],
        body: ['var(--font-poppins)'],
      },
    },
  },
  plugins: [],
};
