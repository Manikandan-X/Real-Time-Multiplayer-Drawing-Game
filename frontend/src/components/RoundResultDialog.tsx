import { Box, Chip, Dialog, DialogContent, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useGame } from '../game/GameContext';
import { displayFont, tokens } from '../theme';
import { PlayerAvatar } from './PlayerAvatar';

const AUTO_CLOSE_MS = 6000;

export function RoundResultDialog() {
  const { state, me, actions } = useGame();
  const result = state.roundResult;

  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(actions.dismissRoundResult, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [result, actions.dismissRoundResult]);

  const drawerName = result ? state.players.find((p) => p.id === result.drawerId)?.display_name : undefined;
  const gotPoints = result ? result.scores.filter((s) => s.round_points > 0).length : 0;

  return (
    <Dialog
      open={Boolean(result)}
      onClose={actions.dismissRoundResult}
      maxWidth="xs"
      fullWidth
      aria-labelledby="round-result-title"
    >
      {result && (
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, textAlign: 'center', bgcolor: tokens.paper }}>
          <Typography id="round-result-title" variant="overline" sx={{ color: tokens.violet }}>
            Round {result.roundNumber} complete
          </Typography>

          <Typography sx={{ fontWeight: 800, color: tokens.inkSoft, mt: 0.5 }}>The word was</Typography>

          <Box
            sx={{
              display: 'inline-block',
              my: 1.25,
              px: 3,
              py: 1,
              bgcolor: tokens.sun,
              border: `3px solid ${tokens.ink}`,
              borderRadius: 4,
              boxShadow: `5px 5px 0 ${tokens.ink}`,
              transform: 'rotate(-2deg)',
              animation: 'pop-in .45s ease both',
            }}
          >
            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '2rem', sm: '2.6rem' }, letterSpacing: '.06em' }}>
              {result.word}
            </Typography>
          </Box>

          {drawerName && (
            <Typography sx={{ fontWeight: 700, color: tokens.inkSoft }}>
              drawn by <b style={{ color: tokens.ink }}>{drawerName}</b>
              {gotPoints === 0 ? ' — nobody guessed it!' : ''}
            </Typography>
          )}

          <Stack spacing={1} sx={{ mt: 2.5, textAlign: 'left' }}>
            {result.scores.map((row, index) => (
              <Box
                key={row.player_id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  p: 0.9,
                  pr: 1.5,
                  borderRadius: 3.5,
                  border: `2.5px solid ${tokens.ink}`,
                  bgcolor: row.round_points > 0 ? tokens.mintSoft : tokens.white,
                  outline: row.player_id === me.playerId ? `3px solid ${tokens.violet}` : 'none',
                  animation: 'pop-in .35s ease both',
                  animationDelay: `${index * 70}ms`,
                }}
              >
                <PlayerAvatar id={row.player_id} name={row.display_name} size={32} />
                <Typography noWrap sx={{ flex: 1, fontWeight: 800 }}>
                  {row.display_name}
                </Typography>
                {row.round_points > 0 && (
                  <Chip size="small" label={`+${row.round_points}`} sx={{ bgcolor: tokens.mint, height: 24 }} />
                )}
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                  {row.score}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Typography variant="caption" sx={{ display: 'block', mt: 2, fontWeight: 800, color: tokens.inkSoft }}>
            {result.isFinal ? 'That was the last round — final results coming up!' : 'The next round is already under way…'}
          </Typography>

          <Box sx={{ mt: 1.25, height: 8, borderRadius: 99, border: `2px solid ${tokens.ink}`, bgcolor: tokens.white, overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                bgcolor: tokens.violet,
                animation: `shrink ${AUTO_CLOSE_MS}ms linear forwards`,
                '@keyframes shrink': { from: { width: '100%' }, to: { width: '0%' } },
              }}
            />
          </Box>
        </DialogContent>
      )}
    </Dialog>
  );
}
