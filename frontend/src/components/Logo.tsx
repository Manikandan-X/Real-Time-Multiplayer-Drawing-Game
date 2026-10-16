import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { displayFont, tokens } from '../theme';

interface LogoProps {
  size?: 'sm' | 'lg';
  linkHome?: boolean;
}

function Mark({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 64 64" aria-hidden>
      <rect x="4" y="4" width="56" height="56" rx="16" fill={tokens.violet} stroke={tokens.ink} strokeWidth="4" />
      <path
        d="M16 44c8-4 10-20 18-20s4 14 14 8"
        fill="none"
        stroke={tokens.sun}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="18" r="5" fill={tokens.coral} />
    </svg>
  );
}

export function Logo({ size = 'sm', linkHome = true }: LogoProps) {
  const big = size === 'lg';

  const content = (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: big ? 2 : 1.25 }}>
      <Box sx={{ transform: 'rotate(-6deg)', filter: `drop-shadow(3px 3px 0 ${tokens.ink})` }}>
        <Mark px={big ? 64 : 38} />
      </Box>
      <Typography
        component="span"
        sx={{
          fontFamily: displayFont,
          fontWeight: 700,
          lineHeight: 1,
          fontSize: big ? { xs: '2.6rem', md: '3.6rem' } : '1.6rem',
          color: tokens.ink,
          letterSpacing: '-0.02em',
        }}
      >
        Doodle
        <Box component="span" sx={{ color: tokens.coral }}>
          Dash
        </Box>
      </Typography>
    </Box>
  );

  if (!linkHome) return content;

  return (
    <Box component={RouterLink} to="/" sx={{ textDecoration: 'none', color: 'inherit' }}>
      {content}
    </Box>
  );
}
