/** Palette taken from the road: asphalt, sign-board amber, lane-marking white. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        asphalt: { DEFAULT: '#1F2A33', 700: '#2B3945', 500: '#4B5B68', 300: '#8A99A6' },
        sign: { DEFAULT: '#F2A900', dark: '#C98C00', soft: '#FFF4D6' },
        lane: '#F4F6F8',
        line: '#DDE2E7',
        gain: { DEFAULT: '#1E7F4F', soft: '#E6F4EC' },
        loss: { DEFAULT: '#C8372D', soft: '#FBEAE8' },
        hold: { DEFAULT: '#B26A00', soft: '#FFF1DC' },
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
