import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useGame } from '../game/GameContext';
import { displayFont, tokens } from '../theme';
import { PlayerAvatar } from './PlayerAvatar';

const MEDALS = [tokens.gold, tokens.silver, tokens.bronze];

export function Scoreboard() {
  const { state, me } = useGame();

  const sorted = [...state.players].sort((a, b) => b.score - a.score || a.id - b.id);

  // Competition ranking: 100, 80, 80, 50 -> 1, 2, 2, 4 (same as the backend).
  const ranks: number[] = [];
  sorted.forEach((player, index) => {
    ranks.push(index > 0 && player.score === sorted[index - 1].score ? ranks[index - 1] : index + 1);
  });

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <EmojiEventsRoundedIcon sx={{ color: tokens.coral }} />
        <Typography variant="h6">Scoreboard</Typography>
      </Stack>

      <Stack spacing={0.75} sx={{ maxHeight: { lg: 'calc(100vh - 520px)' }, minHeight: { lg: 110 }, overflowY: 'auto', pr: 0.5, py: 0.25 }}>
        {sorted.map((player, index) => {
          const isDrawer = player.id === state.drawerId;
          const solved = state.solved.includes(player.id);
          const isMe = player.id === me.playerId;
          const rank = ranks[index];

          return (
            <Box
              key={player.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 0.6,
                pr: 1.25,
                borderRadius: 3.5,
                border: `2.5px solid ${tokens.ink}`,
                bgcolor: solved ? tokens.mintSoft : isDrawer ? tokens.violetSoft : tokens.white,
                opacity: player.is_connected ? 1 : 0.55,
                transition: 'background-color .3s',
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  border: `2.5px solid ${tokens.ink}`,
                  bgcolor: rank <= 3 ? MEDALS[rank - 1] : tokens.white,
                  fontFamily: displayFont,
                  fontWeight: 700,
                  fontSize: '.85rem',
                }}
              >
                {rank}
              </Box>

              <PlayerAvatar id={player.id} name={player.display_name} size={34} />

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                  {player.display_name}
                  {isMe && (
                    <Box component="span" sx={{ color: tokens.violet, ml: 0.5 }}>
                      (you)
                    </Box>
                  )}
                </Typography>
                {!player.is_connected && (
                  <Typography variant="caption" sx={{ color: tokens.inkSoft, fontWeight: 700 }}>
                    disconnected
                  </Typography>
                )}
              </Box>

              {isDrawer && (
                <Chip size="small" icon={<BrushRoundedIcon />} label="Drawing" sx={{ bgcolor: tokens.violet, color: '#fff', height: 24, '& .MuiChip-icon': { color: '#fff' } }} />
              )}
              {solved && !isDrawer && (
                <Chip size="small" icon={<CheckRoundedIcon />} label="Got it" sx={{ bgcolor: tokens.mint, height: 24, '& .MuiChip-icon': { color: tokens.ink } }} />
              )}

              <Typography
                sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.2rem', minWidth: 42, textAlign: 'right' }}
              >
                {player.score}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
