import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getErrorMessage } from '../api/client';
import { roomsApi } from '../api/rooms';
import type { Room } from '../api/types';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { FinalLeaderboard } from '../components/FinalLeaderboard';
import { GameRoom } from '../components/GameRoom';
import { Layout } from '../components/Layout';
import { Lobby } from '../components/Lobby';
import { RoundResultDialog } from '../components/RoundResultDialog';
import { useToast } from '../components/ToastProvider';
import { GameProvider, useGame } from '../game/GameContext';
import { clearSession, loadSession, saveSession, type Session } from '../session';
import { displayFont, tokens } from '../theme';

/** Shown when this tab has no session for the room (e.g. someone opened an invite link). */
function JoinPrompt({ roomCode, onJoined }: { roomCode: string; onJoined: (session: Session) => void }) {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('doodle.lastName') ?? '';
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const found = await roomsApi.get(roomCode);
        if (!cancelled) setRoom(found);
      } catch (err) {
        if (cancelled) return;
        setProblem(
          axios.isAxiosError(err) && err.response?.status === 404
            ? `There is no room with the code ${roomCode}.`
            : getErrorMessage(err),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const trimmed = name.trim();
  const nameOk = trimmed.length >= 2 && trimmed.length <= 50;

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameOk) return notify('Pick a display name between 2 and 50 characters.', 'warning');

    setBusy(true);

    try {
      const player = await roomsApi.join(roomCode, trimmed);

      try {
        localStorage.setItem('doodle.lastName', trimmed);
      } catch {
        /* ignore */
      }

      const session: Session = { playerId: player.id, token: player.session_token, displayName: player.display_name };
      saveSession(roomCode, session);
      onJoined(session);
    } catch (err) {
      notify(getErrorMessage(err), 'error');
      setBusy(false);
    }
  };

  const blocked =
    problem ??
    (room && room.status !== 'WAITING'
      ? room.status === 'IN_PROGRESS'
        ? 'This game has already started, so new players can’t join.'
        : 'This game has already finished.'
      : room && room.max_players <= 0
        ? 'This room is not available.'
        : null);

  return (
    <Layout maxWidth="md">
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, maxWidth: 520, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="overline" sx={{ color: tokens.violet }}>
          You're invited
        </Typography>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '2.6rem', letterSpacing: '.18em', pl: '.18em' }}>
          {roomCode}
        </Typography>

        {loading && <CircularProgress sx={{ mt: 2 }} />}

        {!loading && blocked && (
          <Stack spacing={2.5} sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 800, color: tokens.coral }}>{blocked}</Typography>
            <Button variant="contained" onClick={() => navigate('/')}>
              Back to home
            </Button>
          </Stack>
        )}

        {!loading && !blocked && (
          <Box component="form" onSubmit={join} noValidate sx={{ mt: 2 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Your display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                fullWidth
                slotProps={{ htmlInput: { maxLength: 50 } }}
              />
              <Button type="submit" size="large" variant="contained" disabled={busy}>
                {busy ? 'Joining…' : 'Join the game'}
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Layout>
  );
}

/** What to show for each phase of the game once the session is valid. */
function RoomScreens({ roomCode }: { roomCode: string }) {
  const { state } = useGame();

  if (state.fatal) {
    return (
      <Paper variant="outlined" sx={{ p: 4, maxWidth: 520, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Can’t open this room
        </Typography>
        <Typography sx={{ color: tokens.inkSoft, fontWeight: 700, mb: 3 }}>{state.fatal}</Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              clearSession(roomCode);
              window.location.assign('/');
            }}
          >
            Home
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (state.phase === 'loading') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={54} thickness={5} />
          <Typography sx={{ fontFamily: displayFont, fontWeight: 600 }}>Sharpening pencils…</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <>
      {state.phase === 'lobby' && <Lobby />}
      {state.phase === 'playing' && <GameRoom />}
      {state.phase === 'finished' && <FinalLeaderboard />}
      <RoundResultDialog />
    </>
  );
}

function RoomChrome({ roomCode }: { roomCode: string }) {
  return (
    <>
      <Box
        sx={{
          display: { xs: 'none', sm: 'block' },
          px: 1.75,
          py: 0.5,
          borderRadius: 99,
          border: `3px solid ${tokens.ink}`,
          bgcolor: tokens.white,
          fontFamily: displayFont,
          fontWeight: 700,
          letterSpacing: '.14em',
        }}
      >
        {roomCode}
      </Box>
      <ConnectionBadge />
    </>
  );
}

export default function RoomPage() {
  const { code = '' } = useParams();
  const roomCode = code.trim().toUpperCase();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [session, setSession] = useState<Session | null>(() => loadSession(roomCode));

  // Switching between rooms in the same tab.
  useEffect(() => {
    setSession(loadSession(roomCode));
  }, [roomCode]);

  const handleInvalidSession = useCallback(() => {
    clearSession(roomCode);
    setSession(null);
    notify('Your seat in this room is gone — you can join again if the game is still open.', 'info');
  }, [roomCode, notify]);

  if (!session) {
    return <JoinPrompt roomCode={roomCode} onJoined={setSession} />;
  }

  return (
    <GameProvider key={`${roomCode}:${session.token}`} roomCode={roomCode} session={session} onSessionInvalid={handleInvalidSession}>
      <Layout topRight={<RoomChrome roomCode={roomCode} />}>
        <RoomScreens roomCode={roomCode} />
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button size="small" variant="text" color="inherit" onClick={() => navigate('/')} sx={{ border: 'none', boxShadow: 'none', '&:hover': { boxShadow: 'none', transform: 'none', bgcolor: '#0000000d' } }}>
            ← Back to home (your seat is kept)
          </Button>
        </Box>
      </Layout>
    </GameProvider>
  );
}
