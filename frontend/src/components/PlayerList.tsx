import { Box, Chip, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import type { PlayerView } from '../game/reducer';
import { displayFont, tokens } from '../theme';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerListProps {
  players: PlayerView[];
  meId: number;
  maxPlayers: number;
}

export function PlayerList({ players, meId, maxPlayers }: PlayerListProps) {
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        gap: 1.5,
      }}
    >
      {players.map((player) => {
        const isMe = player.id === meId;

        return (
          <Box
            key={player.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.25,
              borderRadius: 4,
              border: `3px solid ${tokens.ink}`,
              backgroundColor: isMe ? tokens.violetSoft : tokens.white,
              boxShadow: `3px 3px 0 ${tokens.ink}`,
              animation: 'pop-in .35s ease both',
            }}
          >
            <Box sx={{ position: 'relative' }}>
              <PlayerAvatar id={player.id} name={player.display_name} />
              <Box
                title={player.is_connected ? 'Online' : 'Offline'}
                sx={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `3px solid ${tokens.ink}`,
                  bgcolor: player.is_connected ? tokens.mint : '#B9B3CF',
                }}
              />
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.2 }}>
                {player.display_name}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
                {isMe && <Chip size="small" label="You" sx={{ bgcolor: tokens.sun, height: 22 }} />}
              </Stack>
            </Box>

            {player.is_ready ? (
              <Chip
                size="small"
                icon={<CheckCircleRoundedIcon />}
                label="Ready"
                sx={{ bgcolor: tokens.mint, '& .MuiChip-icon': { color: tokens.ink } }}
              />
            ) : (
              <Chip
                size="small"
                icon={<HourglassEmptyRoundedIcon />}
                label="Not ready"
                sx={{ bgcolor: tokens.paperDeep, '& .MuiChip-icon': { color: tokens.ink } }}
              />
            )}
          </Box>
        );
      })}

      {Array.from({ length: emptySlots }).map((_, i) => (
        <Box
          key={`empty-${i}`}
          sx={{
            display: { xs: i < 1 ? 'flex' : 'none', sm: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 68,
            borderRadius: 4,
            border: `3px dashed ${tokens.inkSoft}66`,
            color: tokens.inkSoft,
            fontFamily: displayFont,
            fontWeight: 500,
          }}
        >
          Waiting for a player…
        </Box>
      ))}
    </Box>
  );
}
