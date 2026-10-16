import { useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { useNavigate } from 'react-router-dom';
import { MIN_PLAYERS } from '../config';
import { useGame } from '../game/GameContext';
import { clearSession } from '../session';
import { displayFont, hardShadow, tokens } from '../theme';
import { PlayerList } from './PlayerList';
import { useToast } from './ToastProvider';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function Lobby() {
  const { state, me, meView, actions } = useGame();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'start' | 'ready' | 'leave' | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const players = state.players;
  const readyCount = players.filter((p) => p.is_ready).length;
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const everyoneReady = players.length > 0 && readyCount === players.length;
  const canStart = enoughPlayers && everyoneReady;
  const imReady = meView?.is_ready ?? false;

  const hint = !enoughPlayers
    ? `Waiting for ${MIN_PLAYERS - players.length} more player${MIN_PLAYERS - players.length === 1 ? '' : 's'} — share the code!`
    : !everyoneReady
      ? `${players.length - readyCount} player${players.length - readyCount === 1 ? ' is' : 's are'} not ready yet`
      : 'Everyone is ready. Let the doodling begin!';

  const handleCopy = async (kind: 'code' | 'link') => {
    const text = kind === 'code' ? state.roomCode : `${window.location.origin}/room/${state.roomCode}`;
    const ok = await copyText(text);

    if (!ok) {
      notify('Could not copy — select it manually.', 'warning');
      return;
    }

    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const toggleReady = async () => {
    setBusy('ready');
    await actions.setReady(!imReady);
    setBusy(null);
  };

  const start = async () => {
    setBusy('start');
    await actions.startGame();
    setBusy(null);
  };

  const leave = async () => {
    setBusy('leave');
    const left = await actions.leaveRoom();
    setBusy(null);

    if (left) {
      clearSession(state.roomCode);
      navigate('/');
    }
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2.5, md: 3 },
        gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 380px) 1fr' },
        alignItems: 'start',
      }}
    >
      {/* ------------------------------------------------------ room code card */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          bgcolor: tokens.violet,
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Typography variant="overline" sx={{ opacity: 0.85 }}>
          Room code
        </Typography>

        <Box
          sx={{
            my: 1,
            px: 2,
            py: 1.5,
            textAlign: 'center',
            bgcolor: tokens.white,
            color: tokens.ink,
            border: `3px solid ${tokens.ink}`,
            borderRadius: 4,
            boxShadow: hardShadow(4),
            transform: 'rotate(-1.5deg)',
          }}
        >
          <Typography
            sx={{
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: { xs: '2.6rem', sm: '3.2rem' },
              letterSpacing: '0.18em',
              lineHeight: 1.1,
              pl: '0.18em',
            }}
            aria-label={`Room code ${state.roomCode.split('').join(' ')}`}
          >
            {state.roomCode}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.25} sx={{ mt: 2.5 }}>
          <Button
            fullWidth
            variant="contained"
            color="warning"
            startIcon={copied === 'code' ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
            onClick={() => handleCopy('code')}
          >
            {copied === 'code' ? 'Copied!' : 'Code'}
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="warning"
            startIcon={copied === 'link' ? <CheckRoundedIcon /> : <LinkRoundedIcon />}
            onClick={() => handleCopy('link')}
          >
            {copied === 'link' ? 'Copied!' : 'Invite link'}
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<GroupsRoundedIcon />}
            label={`${players.length}/${state.maxPlayers} players`}
            sx={{ bgcolor: tokens.white, '& .MuiChip-icon': { color: tokens.ink } }}
          />
          <Chip
            icon={<ReplayRoundedIcon />}
            label={`${state.totalRounds} round${state.totalRounds === 1 ? '' : 's'}`}
            sx={{ bgcolor: tokens.white, '& .MuiChip-icon': { color: tokens.ink } }}
          />
        </Stack>
      </Paper>

      {/* -------------------------------------------------- players + controls */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
          flexWrap="wrap"
          useFlexGap
          spacing={1}
        >
          <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', sm: '2rem' } }}>
            The lobby
          </Typography>
          <Chip
            label={`${readyCount}/${players.length} ready`}
            sx={{ bgcolor: everyoneReady && enoughPlayers ? tokens.mint : tokens.paperDeep }}
          />
        </Stack>

        <PlayerList players={players} meId={me.playerId} maxPlayers={state.maxPlayers} />

        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 4,
            border: `3px dashed ${tokens.ink}55`,
            bgcolor: canStart ? tokens.mintSoft : tokens.sunSoft,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontWeight: 800 }}>{hint}</Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.75} sx={{ mt: 2.5 }}>
          <Button
            size="large"
            fullWidth
            variant={imReady ? 'outlined' : 'contained'}
            color={imReady ? 'primary' : 'success'}
            onClick={toggleReady}
            disabled={busy !== null || !meView}
            startIcon={imReady ? <CheckRoundedIcon /> : undefined}
          >
            {imReady ? "I'm ready!" : 'Ready up'}
          </Button>

          <Button
            size="large"
            fullWidth
            variant="contained"
            color="secondary"
            startIcon={<PlayArrowRoundedIcon />}
            onClick={start}
            disabled={!canStart || busy !== null}
          >
            {busy === 'start' ? 'Starting…' : 'Start game'}
          </Button>
        </Stack>

        <Box sx={{ mt: 2.5, textAlign: 'center' }}>
          <Button
            variant="text"
            size="small"
            color="inherit"
            startIcon={<LogoutRoundedIcon />}
            onClick={leave}
            disabled={busy !== null}
            sx={{ border: 'none', boxShadow: 'none', '&:hover': { boxShadow: 'none', transform: 'none', bgcolor: tokens.coralSoft } }}
          >
            Leave room
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
