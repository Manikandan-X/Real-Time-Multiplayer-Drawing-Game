import type { ReactNode } from 'react';
import { Box, Container } from '@mui/material';
import { tokens } from '../theme';
import { Logo } from './Logo';

interface LayoutProps {
  children: ReactNode;
  /** Right side of the top bar (room code, connection state, ...). */
  topRight?: ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl';
}

/** Floating decorative doodles behind the content. */
function Doodles() {
  const shapes = [
    { top: '12%', left: '4%', size: 54, color: tokens.sun, r: '-12deg', delay: '0s', shape: 'star' },
    { top: '68%', left: '2%', size: 40, color: tokens.mint, r: '10deg', delay: '1.2s', shape: 'circle' },
    { top: '20%', right: '3%', size: 44, color: tokens.pink, r: '14deg', delay: '.6s', shape: 'square' },
    { top: '78%', right: '5%', size: 58, color: tokens.sky, r: '-8deg', delay: '1.8s', shape: 'star' },
  ] as const;

  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {shapes.map((s, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: s.top,
            left: 'left' in s ? s.left : undefined,
            right: 'right' in s ? s.right : undefined,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            border: `3px solid ${tokens.ink}`,
            boxShadow: `4px 4px 0 ${tokens.ink}`,
            borderRadius: s.shape === 'circle' ? '50%' : s.shape === 'square' ? '14px' : '30% 70% 60% 40% / 40% 40% 60% 60%',
            '--r': s.r,
            animation: `floaty 6s ease-in-out ${s.delay} infinite`,
            display: { xs: 'none', md: 'block' },
          }}
        />
      ))}
    </Box>
  );
}

export function Layout({ children, topRight, maxWidth = 'xl' }: LayoutProps) {
  return (
    <Box sx={{ position: 'relative', minHeight: '100vh' }}>
      <Doodles />
      <Container
        maxWidth={maxWidth}
        sx={{
          position: 'relative',
          zIndex: 1,
          py: { xs: 1.5, md: 2 },
          px: { xs: 1.5, sm: 3 },
        }}
      >
        <Box
          component="header"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: { xs: 1.5, md: 2 } }}
        >
          <Logo />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>{topRight}</Box>
        </Box>
        {children}
      </Container>
    </Box>
  );
}
