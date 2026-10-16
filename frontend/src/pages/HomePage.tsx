import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { roomsApi } from '../api/rooms';
import type { RoomListItem } from '../api/types';
import { Layout } from '../components/Layout';
import { Logo } from '../components/Logo';
import { useToast } from '../components/ToastProvider';
import { MAX_PLAYERS, MAX_ROUNDS, MIN_PLAYERS, MIN_ROUNDS, ROOM_CODE_LENGTH } from '../config';
import { listSessions, saveSession } from '../session';
import { displayFont, hardShadow, tokens } from '../theme';

const NAME_KEY = 'doodle.lastName';

const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};

const rememberName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
};

const cleanCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);

function HowItWorks() {
  const steps = [
    { icon: <BrushRoundedIcon />, color: tokens.coral, title: 'Draw', text: 'One player gets a secret word and sketches it live.' },
    { icon: <SearchRoundedIcon />, color: tokens.sky, title: 'Guess', text: 'Everyone else races to type the word before time runs out.' },
    { icon: <EmojiEventsRoundedIcon />, color: tokens.sun, title: 'Win', text: 'Quick, correct guesses score points. Highest total wins!' },
  ];

  return (
    <Stack spacing={1.75} sx={{ mt: 4 }}>
      {steps.map((step, i) => (
        <Box key={step.title} sx={{ display: 'flex', alignItems: 'center', gap: 2, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              bgcolor: step.color,
              color: tokens.ink,
              border: `3px solid ${tokens.ink}`,
              borderRadius: 3,
              boxShadow: hardShadow(3),
            }}
          >
            {step.icon}
          </Box>
          <Box>
            <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', lineHeight: 1.1 }}>{step.title}</Typography>
            <Typography sx={{ color: tokens.inkSoft, fontWeight: 700 }}>{step.text}</Typography>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params] = useSearchParams();

  const [tab, setTab] = useState<'create' | 'join'>(params.get('new') ? 'create' : 'create');
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [rounds, setRounds] = useState(3);
  const [busy, setBusy] = useState(false);

  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [roomsError, setRoomsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const resumable = listSessions();

  const trimmedName = name.trim();
  const nameOk = trimmedName.length >= 2 && trimmedName.length <= 50;

  const loadRooms = useCallback(async () => {
    setRefreshing(true);

    try {
      const list = await roomsApi.list();
      setRooms(list.rooms);
      setRoomsError(false);
    } catch {
      setRoomsError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    const timer = window.setInterval(loadRooms, 6000);
    return () => window.clearInterval(timer);
  }, [loadRooms]);

  const joinAndEnter = async (roomCode: string) => {
    const player = await roomsApi.join(roomCode, trimmedName);
    rememberName(trimmedName);
    saveSession(roomCode, { playerId: player.id, token: player.session_token, displayName: player.display_name });
    navigate(`/room/${roomCode}`);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameOk) return notify('Pick a display name between 2 and 50 characters.', 'warning');

    setBusy(true);

    try {
      const room = await roomsApi.create(maxPlayers, rounds);
      await joinAndEnter(room.room_code);
    } catch (err) {
      notify(getErrorMessage(err), 'error');
      setBusy(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== ROOM_CODE_LENGTH) return notify(`Room codes have ${ROOM_CODE_LENGTH} characters.`, 'warning');
    if (!nameOk) return notify('Pick a display name between 2 and 50 characters.', 'warning');

    setBusy(true);

    try {
      await joinAndEnter(code);
    } catch (err) {
      notify(getErrorMessage(err), 'error');
      setBusy(false);
    }
  };

  const openRooms = (rooms ?? []).filter((r) => r.status === 'WAITING' && r.current_players < r.max_players);

  return (
    <Layout maxWidth="lg">
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 4, md: 6 },
          gridTemplateColumns: { xs: '1fr', md: '1fr minmax(380px, 480px)' },
          alignItems: 'start',
          pt: { xs: 1, md: 4 },
        }}
      >
        {/* -------------------------------------------------------------- hero */}
        <Box>
          <Logo size="lg" linkHome={false} />

          <Typography
            variant="h2"
            sx={{ mt: 4, fontSize: { xs: '2.1rem', sm: '2.9rem' }, lineHeight: 1.08 }}
          >
            Sketch fast.{' '}
            <Box component="span" sx={{ background: `linear-gradient(transparent 62%, ${tokens.sun} 62%)` }}>
              Guess faster.
            </Box>
          </Typography>

          <Typography sx={{ mt: 2, maxWidth: 520, fontSize: '1.15rem', color: tokens.inkSoft, fontWeight: 700 }}>
            A real-time drawing &amp; guessing game for 2–8 friends. Make a room, share the code, and start doodling.
          </Typography>

          <HowItWorks />
        </Box>

        {/* ------------------------------------------------------- action card */}
        <Stack spacing={3}>
          {resumable.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: tokens.sunSoft }}>
              <Typography variant="overline" sx={{ lineHeight: 1.5 }}>
                Pick up where you left off
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {resumable.map(({ roomCode, session }) => (
                  <Button
                    key={roomCode}
                    variant="contained"
                    color="warning"
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => navigate(`/room/${roomCode}`)}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    Room {roomCode} · {session.displayName}
                  </Button>
                ))}
              </Stack>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Tabs
              value={tab}
              onChange={(_, v: 'create' | 'join') => setTab(v)}
              variant="fullWidth"
              sx={{
                mb: 2.5,
                minHeight: 48,
                border: `3px solid ${tokens.ink}`,
                borderRadius: 99,
                bgcolor: tokens.paper,
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTab-root': { minHeight: 42, borderRadius: 99, m: '2px' },
                '& .Mui-selected': { bgcolor: tokens.violet, color: '#fff !important' },
              }}
            >
              <Tab value="create" label="Create room" icon={<AddRoundedIcon />} iconPosition="start" />
              <Tab value="join" label="Join room" icon={<LoginRoundedIcon />} iconPosition="start" />
            </Tabs>

            <Box component="form" onSubmit={tab === 'create' ? handleCreate : handleJoin} noValidate>
              <Stack spacing={2.5}>
                <TextField
                  label="Your display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  autoComplete="nickname"
                  placeholder="e.g. Picasso Pete"
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                  helperText={name && !nameOk ? 'At least 2 characters' : ' '}
                  error={Boolean(name) && !nameOk}
                />

                {tab === 'join' && (
                  <TextField
                    label="Room code"
                    value={code}
                    onChange={(e) => setCode(cleanCode(e.target.value))}
                    fullWidth
                    autoComplete="off"
                    placeholder="ABC123"
                    slotProps={{
                      htmlInput: {
                        maxLength: ROOM_CODE_LENGTH,
                        style: { fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', letterSpacing: '.3em', textAlign: 'center' },
                      },
                    }}
                  />
                )}

                {tab === 'create' && (
                  <>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontWeight: 800 }}>Players (max)</Typography>
                        <Chip label={maxPlayers} sx={{ bgcolor: tokens.skySoft }} />
                      </Stack>
                      <Slider min={MIN_PLAYERS} max={MAX_PLAYERS} step={1} marks value={maxPlayers} onChange={(_, v) => setMaxPlayers(v as number)} aria-label="Maximum players" />
                    </Box>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontWeight: 800 }}>Rounds</Typography>
                        <Chip label={rounds} sx={{ bgcolor: tokens.pinkSoft }} />
                      </Stack>
                      <Slider min={MIN_ROUNDS} max={MAX_ROUNDS} step={1} marks value={rounds} onChange={(_, v) => setRounds(v as number)} aria-label="Number of rounds" />
                    </Box>
                  </>
                )}

                <Button
                  type="submit"
                  size="large"
                  variant="contained"
                  color={tab === 'create' ? 'secondary' : 'primary'}
                  disabled={busy}
                  startIcon={busy ? <CircularProgress size={20} color="inherit" /> : tab === 'create' ? <AddRoundedIcon /> : <LoginRoundedIcon />}
                >
                  {busy ? 'One moment…' : tab === 'create' ? 'Create & enter' : 'Join the game'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          {/* ------------------------------------------------- open rooms list */}
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
              <Typography variant="h6">Open rooms</Typography>
              <Button size="small" variant="outlined" color="inherit" onClick={loadRooms} disabled={refreshing} startIcon={<RefreshRoundedIcon />}>
                Refresh
              </Button>
            </Stack>

            {roomsError && (
              <Typography sx={{ color: tokens.coral, fontWeight: 800 }}>
                Can't reach the game server. Is the backend running?
              </Typography>
            )}

            {!roomsError && rooms === null && <CircularProgress size={26} />}

            {!roomsError && rooms !== null && openRooms.length === 0 && (
              <Typography sx={{ color: tokens.inkSoft, fontWeight: 700 }}>
                No open rooms right now — create one!
              </Typography>
            )}

            <Stack spacing={1}>
              {openRooms.slice(0, 6).map((room) => (
                <Box
                  key={room.room_code}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1,
                    pl: 1.75,
                    borderRadius: 3.5,
                    border: `2.5px solid ${tokens.ink}`,
                    bgcolor: tokens.paper,
                  }}
                >
                  <Typography sx={{ fontFamily: displayFont, fontWeight: 700, letterSpacing: '.12em', fontSize: '1.15rem' }}>
                    {room.room_code}
                  </Typography>
                  <Typography sx={{ flex: 1, color: tokens.inkSoft, fontWeight: 800, fontSize: '.9rem' }}>
                    {room.current_players}/{room.max_players} players · {room.total_rounds} rounds
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      setCode(room.room_code);
                      setTab('join');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Join
                  </Button>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Layout>
  );
}
