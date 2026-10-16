import { useEffect, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import { useGame } from '../game/GameContext';
import { displayFont, tokens } from '../theme';
import { DrawingCanvas } from './DrawingCanvas';
import { GuessPanel } from './GuessPanel';
import { PlayerAvatar } from './PlayerAvatar';
import { Scoreboard } from './Scoreboard';
import { TimerRing } from './TimerRing';

function WordTiles({ word }: { word: string }) {
  return (
    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap justifyContent="center">
      {word.split('').map((letter, i) => (
        <Box
          key={`${letter}-${i}`}
          sx={{
            width: { xs: 30, sm: 34 },
            height: { xs: 38, sm: 42 },
            display: 'grid',
            placeItems: 'center',
            bgcolor: tokens.sun,
            color: tokens.ink,
            border: `3px solid ${tokens.ink}`,
            borderRadius: 2.5,
            boxShadow: `3px 3px 0 ${tokens.ink}`,
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: { xs: '1.2rem', sm: '1.4rem' },
            transform: `rotate(${((i * 7) % 5) - 2}deg)`,
            animation: 'pop-in .35s ease both',
            animationDelay: `${i * 40}ms`,
          }}
        >
          {letter}
        </Box>
      ))}
    </Stack>
  );
}

function RoundHeader() {
  const { state, isDrawer, actions } = useGame();
  const [armed, setArmed] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const drawer = state.players.find((p) => p.id === state.drawerId);
  const guessers = state.players.filter((p) => p.id !== state.drawerId);
  const solvedCount = guessers.filter((p) => state.solved.includes(p.id)).length;
  const allSolved = guessers.length > 0 && solvedCount === guessers.length;
  const word = state.secret && state.secret.roundId === state.roundId ? state.secret.word : null;

  // "Are you sure?" confirmation resets itself.
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const finish = async () => {
    if (!allSolved && !armed) {
      setArmed(true);
      return;
    }

    setFinishing(true);
    setArmed(false);
    await actions.finishRound();
    setFinishing(false);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.25, sm: 1.5 },
        bgcolor: isDrawer ? tokens.violet : tokens.skySoft,
        color: isDrawer ? '#fff' : tokens.ink,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, sm: 2.5 }}>
        <TimerRing remaining={state.remaining} duration={state.duration} size={66} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
            <Chip
              size="small"
              icon={<FlagRoundedIcon />}
              label={`Round ${state.currentRound} / ${state.totalRounds}`}
              sx={{ bgcolor: tokens.white, color: tokens.ink, '& .MuiChip-icon': { color: tokens.ink } }}
            />
            <Chip
              size="small"
              icon={isDrawer ? <BrushRoundedIcon /> : <SearchRoundedIcon />}
              label={isDrawer ? 'You are drawing' : 'You are guessing'}
              sx={{ bgcolor: isDrawer ? tokens.sun : tokens.violet, color: isDrawer ? tokens.ink : '#fff', '& .MuiChip-icon': { color: 'inherit' } }}
            />
            {!isDrawer && guessers.length > 0 && (
              <Chip size="small" label={`${solvedCount}/${guessers.length} guessed`} sx={{ bgcolor: tokens.mint, color: tokens.ink }} />
            )}
          </Stack>

          {isDrawer ? (
            <Box>
              <Typography variant="overline" sx={{ opacity: 0.9, lineHeight: 1.2, display: 'block', mb: 0.25 }}>
                Draw this word — don't write it!
              </Typography>
              {word ? (
                <WordTiles word={word} />
              ) : (
                <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.3rem' }}>Getting your word…</Typography>
              )}
            </Box>
          ) : (
            <Stack direction="row" alignItems="center" spacing={1.25}>
              {drawer && <PlayerAvatar id={drawer.id} name={drawer.display_name} size={36} />}
              <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: { xs: '1.1rem', sm: '1.4rem' }, lineHeight: 1.2 }}>
                {drawer ? `${drawer.display_name} is drawing — can you guess it?` : 'Get ready to guess!'}
              </Typography>
            </Stack>
          )}
        </Box>

        {isDrawer && (
          <Box sx={{ alignSelf: 'flex-start', flexShrink: 0 }}>
            <Button
              size="small"
              variant={allSolved ? 'contained' : 'outlined'}
              color={allSolved ? 'warning' : 'primary'}
              onClick={finish}
              disabled={finishing}
              sx={{
                color: tokens.ink,
                animation: allSolved ? 'pulse-ring 1s ease-in-out infinite' : undefined,
              }}
            >
              {allSolved ? 'Everyone got it!' : armed ? 'Sure? Tap again' : 'End round'}
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export function GameRoom() {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 2.5 },
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1fr) 340px' },
        alignItems: 'start',
      }}
    >
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        <RoundHeader />
        <DrawingCanvas />
      </Stack>

      {/* On phones the guess box comes first, right under the canvas. */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', lg: 'column' }, gap: 2, minWidth: 0 }}>
        <Scoreboard />
        <GuessPanel />
      </Box>
    </Box>
  );
}
