import { createTheme } from '@mui/material/styles';

/** Named design tokens for "Doodle Dash": sketchbook paper, thick ink outlines, candy colours. */
export const tokens = {
  paper: '#FFF4DC',
  paperDeep: '#FFE9B8',
  white: '#FFFFFF',
  ink: '#241B4B',
  inkSoft: '#5B5280',
  violet: '#6C4DFF',
  violetDark: '#4B34C9',
  violetSoft: '#E6E0FF',
  coral: '#FF5A5F',
  coralSoft: '#FFE0E1',
  sun: '#FFC933',
  sunSoft: '#FFF0BD',
  mint: '#18C29C',
  mintSoft: '#CFF5EA',
  sky: '#2DB6F5',
  skySoft: '#D6F1FD',
  pink: '#FF7AB8',
  pinkSoft: '#FFE0EE',
  gold: '#FFC933',
  silver: '#C9D1DC',
  bronze: '#F0A15C',
} as const;

/** Friendly, high-contrast avatar colours, picked by player id. */
export const avatarColors = [
  tokens.violet,
  tokens.coral,
  tokens.mint,
  tokens.sky,
  tokens.pink,
  tokens.sun,
  '#8BC34A',
  '#FF8A3D',
] as const;

export const avatarColor = (id: number): string => avatarColors[Math.abs(id) % avatarColors.length];

export const hardShadow = (size = 5, color: string = tokens.ink) => `${size}px ${size}px 0 ${color}`;

export const displayFont = '"Fredoka", "Nunito", system-ui, sans-serif';
export const bodyFont = '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.violet, dark: tokens.violetDark, contrastText: '#fff' },
    secondary: { main: tokens.coral, contrastText: '#fff' },
    success: { main: tokens.mint, contrastText: tokens.ink },
    warning: { main: tokens.sun, contrastText: tokens.ink },
    error: { main: tokens.coral, contrastText: '#fff' },
    info: { main: tokens.sky, contrastText: tokens.ink },
    background: { default: tokens.paper, paper: tokens.white },
    text: { primary: tokens.ink, secondary: tokens.inkSoft },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: bodyFont,
    fontWeightRegular: 600,
    fontWeightMedium: 700,
    fontWeightBold: 800,
    h1: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: displayFont, fontWeight: 700 },
    h4: { fontFamily: displayFont, fontWeight: 700 },
    h5: { fontFamily: displayFont, fontWeight: 600 },
    h6: { fontFamily: displayFont, fontWeight: 600 },
    button: { fontFamily: displayFont, fontWeight: 600, textTransform: 'none', fontSize: '1.02rem' },
    overline: { fontFamily: displayFont, fontWeight: 600, letterSpacing: '0.12em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { color: tokens.ink },
      },
    },
    MuiPaper: {
      variants: [
        {
          props: { variant: 'outlined' },
          style: {
            border: `3px solid ${tokens.ink}`,
            borderRadius: 22,
            boxShadow: hardShadow(6),
            backgroundColor: tokens.white,
          },
        },
      ],
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          borderRadius: 999,
          padding: '9px 22px',
          border: `3px solid ${tokens.ink}`,
          boxShadow: hardShadow(4),
          transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease',
          '&:hover': { transform: 'translate(-1px,-1px)', boxShadow: hardShadow(5) },
          '&:active': { transform: 'translate(3px,3px)', boxShadow: hardShadow(1) },
          '&.Mui-disabled': {
            border: `3px solid ${tokens.inkSoft}55`,
            boxShadow: 'none',
            backgroundColor: '#0000000d',
          },
        },
        sizeLarge: { padding: '12px 30px', fontSize: '1.15rem' },
        sizeSmall: { padding: '4px 14px', boxShadow: hardShadow(3) },
        containedPrimary: { '&:hover': { backgroundColor: tokens.violetDark } },
        containedSecondary: { '&:hover': { backgroundColor: '#f0474c' } },
        outlined: { backgroundColor: tokens.white, '&:hover': { backgroundColor: tokens.sunSoft } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { border: `3px solid ${tokens.ink}`, backgroundColor: tokens.white } },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: displayFont,
          fontWeight: 600,
          border: `2.5px solid ${tokens.ink}`,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: tokens.white,
          fontWeight: 700,
          '& .MuiOutlinedInput-notchedOutline': { border: `3px solid ${tokens.ink}` },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.violet },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.violet,
            borderWidth: 3,
          },
          '&.Mui-focused': { boxShadow: hardShadow(4, tokens.violet) },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: `3px solid ${tokens.ink}`,
          borderRadius: 28,
          boxShadow: hardShadow(8),
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.ink,
          fontFamily: bodyFont,
          fontWeight: 700,
          fontSize: '.85rem',
        },
        arrow: { color: tokens.ink },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontFamily: displayFont,
          fontWeight: 600,
          textTransform: 'none',
          border: `3px solid ${tokens.ink}`,
          color: tokens.ink,
          '&.Mui-selected': {
            backgroundColor: tokens.violet,
            color: '#fff',
            '&:hover': { backgroundColor: tokens.violetDark },
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { height: 10 },
        rail: { opacity: 1, backgroundColor: tokens.violetSoft, border: `2px solid ${tokens.ink}` },
        track: { border: `2px solid ${tokens.ink}` },
        thumb: {
          width: 24,
          height: 24,
          border: `3px solid ${tokens.ink}`,
          backgroundColor: tokens.sun,
          boxShadow: 'none',
          '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${tokens.sun}55` },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 10, borderRadius: 999, border: `2px solid ${tokens.ink}`, backgroundColor: tokens.white },
        bar: { borderRadius: 999 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { fontFamily: displayFont, fontWeight: 600, textTransform: 'none', fontSize: '1.05rem' },
      },
    },
  },
});
