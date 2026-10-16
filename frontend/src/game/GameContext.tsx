import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { getErrorMessage } from '../api/client';
import { roomsApi } from '../api/rooms';
import type { GuessDto } from '../api/types';
import { useToast } from '../components/ToastProvider';
import { WS_URL } from '../config';
import type { Session } from '../session';
import type { CanvasEvent, ClientMessage, Point, ServerMessage } from './messages';
import { gameReducer, initialState, type GameState, type PlayerView } from './reducer';

type CanvasListener = (event: CanvasEvent) => void;

interface GameActions {
  setReady: (isReady: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  /** Resolves true when the server accepted the departure. */
  leaveRoom: () => Promise<boolean>;
  submitGuess: (text: string) => Promise<GuessDto | null>;
  finishRound: () => Promise<void>;
  dismissRoundResult: () => void;
}

interface GameContextValue {
  state: GameState;
  me: Session;
  meView: PlayerView | undefined;
  isDrawer: boolean;
  hasSolved: boolean;
  actions: GameActions;
  /** Subscribe to remote strokes. Replays what was already drawn this round. */
  subscribeCanvas: (listener: CanvasListener) => () => void;
  sendStroke: (points: Point[], color: string, lineWidth: number) => boolean;
  sendClear: () => boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

const STROKE_LOG_LIMIT = 8000;

interface GameProviderProps {
  roomCode: string;
  session: Session;
  /** Called when the server no longer recognises this player (room deleted, bad token). */
  onSessionInvalid: () => void;
  children: ReactNode;
}

export function GameProvider({ roomCode, session, onSessionInvalid, children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, roomCode, initialState);
  const { notify } = useToast();

  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef(new Set<CanvasListener>());
  const strokeLogRef = useRef<CanvasEvent[]>([]);

  // Keep the latest callbacks reachable from long-lived socket handlers.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const invalidRef = useRef(onSessionInvalid);
  invalidRef.current = onSessionInvalid;
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---------------------------------------------------------------- canvas bus

  const emit = useCallback((event: CanvasEvent) => {
    const log = strokeLogRef.current;

    if (event.kind === 'clear') {
      strokeLogRef.current = [];
    } else {
      log.push(event);
      if (log.length > STROKE_LOG_LIMIT) log.splice(0, log.length - STROKE_LOG_LIMIT);
    }

    listenersRef.current.forEach((listener) => listener(event));
  }, []);

  const subscribeCanvas = useCallback((listener: CanvasListener) => {
    listenersRef.current.add(listener);
    // The canvas may have been re-mounted: repaint everything from this round.
    strokeLogRef.current.forEach(listener);

    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const send = useCallback((message: ClientMessage): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const sendStroke = useCallback(
    (points: Point[], color: string, lineWidth: number): boolean => {
      const sent = send({ type: 'draw', points, color, line_width: lineWidth });

      // Our own strokes are painted locally; just remember them so a
      // re-mounted canvas can repaint the round.
      if (sent) {
        const log = strokeLogRef.current;
        log.push({ kind: 'draw', points, color, width: lineWidth });
        if (log.length > STROKE_LOG_LIMIT) log.splice(0, log.length - STROKE_LOG_LIMIT);
      }

      return sent;
    },
    [send],
  );

  const sendClear = useCallback((): boolean => {
    const sent = send({ type: 'clear_canvas' });
    if (sent) strokeLogRef.current = [];
    return sent;
  }, [send]);

  // ------------------------------------------------------------ server sync

  /** Pulls the authoritative state over REST. Returns false when it could not. */
  const sync = useCallback(async (): Promise<boolean> => {
    try {
      const dto = await roomsApi.gameState(roomCode);

      if (!dto.players.some((p) => p.id === session.playerId)) {
        invalidRef.current();
        return false;
      }

      dispatch({ type: 'hydrate', dto });

      const round = dto.current_round_state;

      if (dto.room_status === 'IN_PROGRESS' && round && round.status === 'IN_PROGRESS') {
        try {
          const history = await roomsApi.guessHistory(roomCode, round.id);
          dispatch({ type: 'restore_round', roundId: round.id, guesses: history.guesses });
        } catch {
          /* the feed is a nicety; the game works without it */
        }
      }

      return true;
    } catch (err) {
      const notFound = axios.isAxiosError(err) && err.response?.status === 404;

      dispatch({
        type: 'fatal',
        message: notFound ? 'This room does not exist any more.' : getErrorMessage(err),
      });

      return false;
    }
  }, [roomCode, session.playerId]);

  // ------------------------------------------------------------- websocket

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    let socket: WebSocket | null = null;

    const handleMessage = (raw: unknown) => {
      if (typeof raw !== 'string') return;

      let msg: ServerMessage;

      try {
        msg = JSON.parse(raw) as ServerMessage;
      } catch {
        return;
      }

      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'draw':
          // The server echoes strokes back to the drawer, who already painted them.
          if (msg.player_id !== session.playerId) {
            emit({ kind: 'draw', points: msg.points, color: msg.color, width: msg.line_width });
          }
          return;

        case 'clear_canvas':
          if (msg.player_id !== session.playerId) emit({ kind: 'clear' });
          return;

        case 'error':
          notifyRef.current(msg.detail, 'warning');
          return;

        case 'game_started':
        case 'round_started':
          emit({ kind: 'clear' });
          dispatch({ type: 'server', msg });
          return;

        default:
          dispatch({ type: 'server', msg });
      }
    };

    const connect = () => {
      if (stopped) return;

      dispatch({ type: 'connection', status: attempt === 0 ? 'connecting' : 'reconnecting' });

      const url = `${WS_URL}/ws/rooms/${encodeURIComponent(roomCode)}?session_token=${encodeURIComponent(
        session.token,
      )}`;

      const ws = new WebSocket(url);
      socket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        if (stopped) {
          ws.close();
          return;
        }

        const wasRetry = attempt > 0;
        attempt = 0;
        dispatch({ type: 'connection', status: 'open' });

        // We may have missed events while offline: resync from the database.
        if (wasRetry) void sync();
      };

      ws.onmessage = (event: MessageEvent) => handleMessage(event.data);

      ws.onclose = (event: CloseEvent) => {
        if (socketRef.current === ws) socketRef.current = null;
        if (stopped) return;

        // 1008 = the server rejected us (bad token, room gone, not a member).
        if (event.code === 1008) {
          dispatch({ type: 'connection', status: 'closed' });
          invalidRef.current();
          return;
        }

        attempt += 1;
        dispatch({ type: 'connection', status: 'reconnecting' });

        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    void (async () => {
      const ok = await sync();
      if (ok && !stopped) connect();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      socketRef.current = null;
      socket?.close();
    };
  }, [roomCode, session.token, session.playerId, emit, sync]);

  // The final leaderboard comes from the persisted results.
  useEffect(() => {
    if (state.phase !== 'finished' || state.finalBoard) return;

    let cancelled = false;

    void (async () => {
      try {
        const results = await roomsApi.results(roomCode);
        if (!cancelled) dispatch({ type: 'final_board', board: results.leaderboard });
      } catch {
        try {
          const board = await roomsApi.leaderboard(roomCode);
          if (!cancelled) dispatch({ type: 'final_board', board: board.leaderboard });
        } catch (err) {
          if (!cancelled) notifyRef.current(getErrorMessage(err), 'error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.phase, state.finalBoard, roomCode]);

  // --------------------------------------------------------------- actions

  const actions = useMemo<GameActions>(
    () => ({
      setReady: async (isReady) => {
        try {
          const player = await roomsApi.setReady(roomCode, session.token, isReady);

          dispatch({
            type: 'server',
            msg: {
              type: 'player_ready',
              player_id: player.id,
              display_name: player.display_name,
              is_ready: player.is_ready,
            },
          });
        } catch (err) {
          notifyRef.current(getErrorMessage(err), 'error');
        }
      },

      startGame: async () => {
        try {
          await roomsApi.start(roomCode, session.token);
          // game_started arrives over the socket; fall back to REST if it is down.
          if (!socketRef.current) await sync();
        } catch (err) {
          notifyRef.current(getErrorMessage(err), 'error');
        }
      },

      leaveRoom: async () => {
        try {
          await roomsApi.leave(roomCode, session.token);
          return true;
        } catch (err) {
          notifyRef.current(getErrorMessage(err), 'warning');
          return false;
        }
      },

      submitGuess: async (text) => {
        const roundId = stateRef.current.roundId;
        if (roundId === null) return null;

        try {
          const guess = await roomsApi.submitGuess(roomCode, roundId, session.token, text);
          if (guess.is_correct) dispatch({ type: 'guess_correct', playerId: session.playerId });
          return guess;
        } catch (err) {
          notifyRef.current(getErrorMessage(err), 'warning');
          return null;
        }
      },

      finishRound: async () => {
        const roundId = stateRef.current.roundId;
        if (roundId === null) return;

        try {
          await roomsApi.finishRound(roomCode, roundId, session.token);
        } catch (err) {
          notifyRef.current(getErrorMessage(err), 'warning');
        }
      },

      dismissRoundResult: () => dispatch({ type: 'dismiss_round_result' }),
    }),
    [roomCode, session.token, session.playerId, sync],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      me: session,
      meView: state.players.find((p) => p.id === session.playerId),
      isDrawer: state.drawerId === session.playerId,
      hasSolved: state.solved.includes(session.playerId),
      actions,
      subscribeCanvas,
      sendStroke,
      sendClear,
    }),
    [state, session, actions, subscribeCanvas, sendStroke, sendClear],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
