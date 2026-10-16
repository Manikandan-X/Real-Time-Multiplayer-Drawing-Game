import { useMemo } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useNavigate } from 'react-router-dom';
import type { LeaderboardEntry } from '../api/types';
import { useGame } from '../game/GameContext';
import { clearSession } from '../session';
import { displayFont, tokens } from '../theme';
import { PlayerAvatar } from './PlayerAvatar';

const CONFETTI = [tokens.coral, tokens.sun, tokens.mint, tokens.sky, tokens.pink, tokens.violet];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${((i * 37) % 30) / 10}s`,
        duration: `${3.5 + ((i * 13) % 25) / 10}s`,
        color: CONFETTI[i % CONFETTI.length],
        size: 8 + ((i * 5) % 8),
      })),
    [],
  );

  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: 0,
            left: p.left,
            width: p.size,
            height: p.size * 1.4,
            bgcolor: p.color,
            border: `2px solid ${tokens.ink}`,
            borderRadius: '2px',
            animation: `confetti-fall ${p.duration} linear ${p.delay} infinite`,
          }}
        />
      ))}
    </Box>
  );
}

function PodiumColumn({ entry, place }: { entry: LeaderboardEntry | undefined; place: 1 | 2 | 3 }) {
  const heights = { 1: 190, 2: 140, 3: 105 } as const;
  const colors = { 1: tokens.gold, 2: tokens.silver, 3: tokens.bronze } as const;

  if (!entry) return <Box sx={{ flex: 1 }} />;

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ position: 'relative', mb: 1, animation: 'pop-in .5s ease both', animationDelay: `${(4 - place) * 160}ms` }}>
        {place === 1 && (
          <EmojiEventsRoundedIcon
            sx={{ position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)', fontSize: 44, color: tokens.gold, filter: `drop-shadow(2px 2px 0 ${tokens.ink})`, animation: 'wiggle 1.6s ease-in-out infinite' }}
          />
        )}
        <PlayerAvatar id={entry.player_id} name={entry.display_name} size={place === 1 ? 72 : 58} />
      </Box>

      <Typography noWrap sx={{ maxWidth: '100%', fontFamily: displayFont, fontWeight: 600, fontSize: place === 1 ? '1.25rem' : '1.05rem', px: 0.5 }}>
        {entry.display_name}
      </Typography>

      <Box
        sx={{
          mt: 0.75,
          width: '100%',
          height: heights[place],
          bgcolor: colors[place],
          border: `3px solid ${tokens.ink}`,
          borderBottom: 'none',
          borderRadius: '18px 18px 0 0',
          boxShadow: `4px 0 0 ${tokens.ink}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 1,
        }}
      >
        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '2.4rem', lineHeight: 1 }}>{entry.rank}</Typography>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.05rem' }}>{entry.score} pts</Typography>
      </Box>
    </Box>
  );
}

export function FinalLeaderboard() {
  const { state, me } = useGame();
  const navigate = useNavigate();

  // Prefer the persisted results; fall back to the live scores while they load.
  const board: LeaderboardEntry[] = useMemo(() => {
    if (state.finalBoard) return state.finalBoard;

    const sorted = [...state.players].sort((a, b) => b.score - a.score || a.id - b.id);
    const entries: LeaderboardEntry[] = [];

    sorted.forEach((p, i) => {
      // Competition ranking (100, 80, 80, 50 -> 1, 2, 2, 4), same as the backend.
      const rank = i > 0 && p.score === sorted[i - 1].score ? entries[i - 1].rank : i + 1;
      entries.push({ rank, player_id: p.id, display_name: p.display_name, score: p.score });
    });

    return entries;
  }, [state.finalBoard, state.players]);

  const myEntry = board.find((e) => e.player_id === me.playerId);
  const iWon = myEntry?.rank === 1;
  const rest = board.slice(3);

  const leave = (to: string) => {
    clearSession(state.roomCode);
    navigate(to);
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      {iWon && <Confetti />}

      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, textAlign: 'center', bgcolor: tokens.paper }}>
        <Typography variant="overline" sx={{ color: tokens.violet }}>
          Game over
        </Typography>
        <Typography variant="h3" sx={{ fontSize: { xs: '2rem', sm: '2.8rem' }, mb: 0.5 }}>
          {iWon ? 'You won! 🎉' : 'Final leaderboard'}
        </Typography>
        {myEntry && !iWon && (
          <Typography sx={{ fontWeight: 800, color: tokens.inkSoft }}>
            You finished with {myEntry.score} points
          </Typography>
        )}

        <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="flex-end" sx={{ mt: 5, px: { xs: 0, sm: 4 } }}>
          <PodiumColumn entry={board[1]} place={2} />
          <PodiumColumn entry={board[0]} place={1} />
          <PodiumColumn entry={board[2]} place={3} />
        </Stack>
        <Box sx={{ height: 10, bgcolor: tokens.ink, borderRadius: 99, mx: { xs: 0, sm: 4 } }} />

        {rest.length > 0 && (
          <Stack spacing={1} sx={{ mt: 3, textAlign: 'left' }}>
            {rest.map((entry) => (
              <Box
                key={entry.player_id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1,
                  pr: 2,
                  borderRadius: 3.5,
                  border: `2.5px solid ${tokens.ink}`,
                  bgcolor: entry.player_id === me.playerId ? tokens.violetSoft : tokens.white,
                }}
              >
                <Typography sx={{ width: 28, textAlign: 'center', fontFamily: displayFont, fontWeight: 700 }}>{entry.rank}</Typography>
                <PlayerAvatar id={entry.player_id} name={entry.display_name} size={34} />
                <Typography noWrap sx={{ flex: 1, fontWeight: 800 }}>
                  {entry.display_name}
                </Typography>
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700 }}>{entry.score}</Typography>
              </Box>
            ))}
          </Stack>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 4 }}>
          <Button size="large" variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={() => leave('/?new=1')}>
            Play again
          </Button>
          <Button size="large" variant="outlined" color="inherit" startIcon={<HomeRoundedIcon />} onClick={() => leave('/')}>
            Home
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
