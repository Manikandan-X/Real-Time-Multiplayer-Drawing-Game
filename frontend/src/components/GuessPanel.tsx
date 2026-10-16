import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Box, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import { useGame } from '../game/GameContext';
import { avatarColor, displayFont, tokens } from '../theme';
import { useToast } from './ToastProvider';

export function GuessPanel() {
  const { state, isDrawer, hasSolved, actions } = useGame();
  const { notify } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.feed.length]);

  const disabled = isDrawer || hasSolved || state.roundId === null || sending;

  const placeholder = isDrawer
    ? "You're drawing — no guessing!"
    : hasSolved
      ? 'You got it! Wait for the round to end…'
      : 'Type your guess…';

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const guess = text.trim();
    if (!guess || disabled) return;

    setSending(true);
    const result = await actions.submitGuess(guess);
    setSending(false);

    if (result) {
      setText('');
      if (result.is_correct) notify(`You got it! +${result.points_awarded} points`, 'success');
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        <ForumRoundedIcon sx={{ color: tokens.sky }} />
        <Typography variant="h6">Guesses</Typography>
      </Stack>

      <Box
        ref={listRef}
        aria-live="polite"
        sx={{
          height: { xs: 170, lg: 'clamp(130px, calc(100vh - 640px), 300px)' },
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          p: 1,
          mb: 1.5,
          borderRadius: 3,
          border: `2.5px solid ${tokens.ink}`,
          bgcolor: tokens.paper,
        }}
      >
        {state.feed.length === 0 && (
          <Typography sx={{ m: 'auto', color: tokens.inkSoft, textAlign: 'center', fontWeight: 700 }}>
            {isDrawer ? 'Guesses will pop up here.' : 'No guesses yet — be the first!'}
          </Typography>
        )}

        {state.feed.map((item) => {
          if (item.kind === 'system') {
            return (
              <Typography
                key={item.id}
                variant="caption"
                sx={{ textAlign: 'center', color: tokens.inkSoft, fontWeight: 800, py: 0.25 }}
              >
                {item.text}
              </Typography>
            );
          }

          if (item.kind === 'correct') {
            return (
              <Box
                key={item.id}
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 2.5,
                  border: `2.5px solid ${tokens.ink}`,
                  bgcolor: tokens.mint,
                  fontWeight: 800,
                  animation: 'pop-in .3s ease both',
                }}
              >
                🎉 {item.name} {item.text}
              </Box>
            );
          }

          return (
            <Box
              key={item.id}
              sx={{
                px: 1.25,
                py: 0.6,
                borderRadius: 2.5,
                bgcolor: tokens.white,
                border: `2px solid ${tokens.ink}33`,
                wordBreak: 'break-word',
              }}
            >
              <Box
                component="span"
                sx={{ fontFamily: displayFont, fontWeight: 700, color: avatarColor(item.playerId ?? 0), filter: 'brightness(.75)' }}
              >
                {item.name}:{' '}
              </Box>
              {item.text}
            </Box>
          );
        })}
      </Box>

      <Box component="form" onSubmit={submit}>
        <TextField
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          slotProps={{
            htmlInput: { maxLength: 100, 'aria-label': 'Your guess' },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="submit"
                    size="small"
                    disabled={disabled || !text.trim()}
                    aria-label="Send guess"
                    sx={{ bgcolor: tokens.violet, color: '#fff', '&:hover': { bgcolor: tokens.violetDark } }}
                  >
                    <SendRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
    </Paper>
  );
}
