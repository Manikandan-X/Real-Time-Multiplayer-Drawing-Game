import { Box, CircularProgress, Typography } from '@mui/material';
import { displayFont, tokens } from '../theme';

interface TimerRingProps {
  remaining: number | null;
  duration: number;
  size?: number;
}

export function TimerRing({ remaining, duration, size = 84 }: TimerRingProps) {
  const value = remaining === null ? 0 : Math.max(0, Math.min(100, (remaining / Math.max(1, duration)) * 100));
  const urgent = remaining !== null && remaining <= 10;
  const warning = remaining !== null && remaining <= 30;
  const color = urgent ? tokens.coral : warning ? '#FF8A3D' : tokens.mint;

  return (
    <Box
      role="timer"
      aria-label={remaining === null ? 'Timer' : `${remaining} seconds left`}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: tokens.white,
        border: `3px solid ${tokens.ink}`,
        boxShadow: `3px 3px 0 ${tokens.ink}`,
        animation: urgent ? 'pulse-ring .8s ease-in-out infinite' : undefined,
      }}
    >
      <CircularProgress
        variant="determinate"
        value={100}
        size={size - 6}
        thickness={5}
        sx={{ color: `${tokens.ink}14`, position: 'absolute', inset: 0 }}
      />
      <CircularProgress
        variant="determinate"
        value={value}
        size={size - 6}
        thickness={5}
        sx={{
          color,
          position: 'absolute',
          inset: 0,
          transform: 'scaleX(-1) rotate(-90deg) !important',
          '& .MuiCircularProgress-circle': { transition: 'stroke-dashoffset .9s linear, stroke .3s', strokeLinecap: 'round' },
        }}
      />
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Typography
          sx={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: size * 0.36,
            lineHeight: 1,
            color: urgent ? tokens.coral : tokens.ink,
          }}
        >
          {remaining === null ? '–' : remaining}
        </Typography>
      </Box>
    </Box>
  );
}
