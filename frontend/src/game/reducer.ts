import type { GameStateDto, GuessDto, LeaderboardEntry, PlayerDto } from '../api/types';
import { DEFAULT_ROUND_SECONDS } from '../config';
import type { RoundScore, ServerMessage } from './messages';

export type Phase = 'loading' | 'lobby' | 'playing' | 'finished';
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface PlayerView {
  id: number;
  display_name: string;
  is_ready: boolean;
  is_connected: boolean;
  score: number;
}

export interface FeedItem {
  id: number;
  kind: 'guess' | 'correct' | 'system';
  text: string;
  playerId?: number;
  name?: string;
}

export interface RoundResult {
  roundId: number;
  roundNumber: number;
  word: string;
  drawerId: number | null;
  scores: RoundScore[];
  isFinal: boolean;
}

export interface GameState {
  phase: Phase;
  roomCode: string;
  totalRounds: number;
  currentRound: number;
  maxPlayers: number;
  players: PlayerView[];
  drawerId: number | null;
  roundId: number | null;
  /** The word is private to the drawer and is tagged with its round so a stale one is never shown. */
  secret: { roundId: number; word: string } | null;
  remaining: number | null;
  duration: number;
  /** Player ids that already guessed the word this round. */
  solved: number[];
  feed: FeedItem[];
  feedSeq: number;
  roundResult: RoundResult | null;
  finalBoard: LeaderboardEntry[] | null;
  connection: ConnectionStatus;
  fatal: string | null;
}

export type Action =
  | { type: 'hydrate'; dto: GameStateDto }
  | { type: 'server'; msg: ServerMessage }
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'guess_correct'; playerId: number }
  | { type: 'restore_round'; roundId: number; guesses: GuessDto[] }
  | { type: 'dismiss_round_result' }
  | { type: 'final_board'; board: LeaderboardEntry[] }
  | { type: 'fatal'; message: string };

const FEED_LIMIT = 80;

export function initialState(roomCode: string): GameState {
  return {
    phase: 'loading',
    roomCode,
    totalRounds: 0,
    currentRound: 0,
    maxPlayers: 0,
    players: [],
    drawerId: null,
    roundId: null,
    secret: null,
    remaining: null,
    duration: DEFAULT_ROUND_SECONDS,
    solved: [],
    feed: [],
    feedSeq: 0,
    roundResult: null,
    finalBoard: null,
    connection: 'connecting',
    fatal: null,
  };
}

const toView = (p: PlayerDto): PlayerView => ({
  id: p.id,
  display_name: p.display_name,
  is_ready: p.is_ready,
  is_connected: p.is_connected,
  score: p.score,
});

function pushFeed(state: GameState, item: Omit<FeedItem, 'id'>): Pick<GameState, 'feed' | 'feedSeq'> {
  const feedSeq = state.feedSeq + 1;
  const feed = [...state.feed, { ...item, id: feedSeq }];

  return { feed: feed.length > FEED_LIMIT ? feed.slice(-FEED_LIMIT) : feed, feedSeq };
}

const patchPlayer = (
  players: PlayerView[],
  id: number,
  patch: (p: PlayerView) => PlayerView,
): PlayerView[] => players.map((p) => (p.id === id ? patch(p) : p));

function applyServerMessage(state: GameState, msg: ServerMessage): GameState {
  switch (msg.type) {
    case 'player_joined': {
      if (state.players.some((p) => p.id === msg.player.id)) return state;

      return {
        ...state,
        players: [
          ...state.players,
          {
            id: msg.player.id,
            display_name: msg.player.display_name,
            is_ready: msg.player.is_ready,
            is_connected: false,
            score: 0,
          },
        ],
        ...pushFeed(state, { kind: 'system', text: `${msg.player.display_name} joined` }),
      };
    }

    case 'player_connected':
      return {
        ...state,
        players: patchPlayer(state.players, msg.player_id, (p) => ({ ...p, is_connected: true })),
      };

    case 'player_disconnected':
      return {
        ...state,
        players: patchPlayer(state.players, msg.player_id, (p) => ({ ...p, is_connected: false })),
      };

    case 'player_ready':
      return {
        ...state,
        players: patchPlayer(state.players, msg.player_id, (p) => ({ ...p, is_ready: msg.is_ready })),
      };

    case 'player_left':
      return { ...state, players: state.players.filter((p) => p.id !== msg.player_id) };

    case 'game_started':
      return {
        ...state,
        phase: 'playing',
        currentRound: msg.current_round,
        totalRounds: msg.total_rounds,
        roundId: msg.round_id,
        drawerId: msg.drawer_id,
        duration: msg.duration_seconds,
        remaining: msg.duration_seconds,
        solved: [],
        feed: [],
        roundResult: null,
        finalBoard: null,
        // The drawer's secret_word message is sent *before* game_started,
        // so keep it if it belongs to this round.
        secret: state.secret && state.secret.roundId === msg.round_id ? state.secret : null,
      };

    case 'round_started': {
      const roundNumber = msg.current_round ?? msg.round_number ?? state.currentRound + 1;
      const drawer = state.players.find((p) => p.id === msg.drawer_id);

      const next: GameState = {
        ...state,
        phase: 'playing',
        currentRound: roundNumber,
        totalRounds: msg.total_rounds ?? state.totalRounds,
        roundId: msg.round_id,
        drawerId: msg.drawer_id,
        duration: msg.duration_seconds,
        remaining: msg.duration_seconds,
        solved: [],
        feed: [],
        secret: state.secret && state.secret.roundId === msg.round_id ? state.secret : null,
      };

      return {
        ...next,
        ...pushFeed(next, {
          kind: 'system',
          text: `Round ${roundNumber} — ${drawer ? drawer.display_name : 'someone'} is drawing`,
        }),
      };
    }

    case 'secret_word':
      return { ...state, secret: { roundId: msg.round_id, word: msg.word } };

    case 'round_timer':
      return {
        ...state,
        remaining: msg.remaining_seconds,
        roundId: msg.round_id,
        currentRound: state.phase === 'playing' ? msg.round_number : state.currentRound,
      };

    case 'round_ended': {
      const scoreById = new Map(msg.scores.map((s) => [s.player_id, s.score]));

      return {
        ...state,
        players: state.players.map((p) => (scoreById.has(p.id) ? { ...p, score: scoreById.get(p.id)! } : p)),
        roundResult: {
          roundId: msg.round_id,
          roundNumber: msg.round_number,
          word: msg.word,
          drawerId: msg.drawer_id,
          scores: msg.scores,
          isFinal: msg.round_number >= state.totalRounds,
        },
      };
    }

    case 'game_completed':
      return { ...state, phase: 'finished', remaining: null, drawerId: null, roundId: null };

    case 'guess_submitted': {
      if (msg.round_id !== state.roundId) return state;

      return {
        ...state,
        ...pushFeed(state, {
          kind: 'guess',
          text: msg.guess_text,
          playerId: msg.player_id,
          name: msg.display_name,
        }),
      };
    }

    case 'correct_guess': {
      // A repeat correct guess is broadcast with 0 points: nothing to announce.
      if (msg.round_id !== state.roundId || msg.points_awarded <= 0) return state;
      if (state.solved.includes(msg.player_id)) return state;

      return {
        ...state,
        solved: [...state.solved, msg.player_id],
        players: patchPlayer(state.players, msg.player_id, (p) => ({
          ...p,
          score: p.score + msg.points_awarded,
        })),
        ...pushFeed(state, {
          kind: 'correct',
          text: `guessed the word! +${msg.points_awarded}`,
          playerId: msg.player_id,
          name: msg.display_name,
        }),
      };
    }

    // draw / clear_canvas go straight to the canvas; error is shown as a toast.
    default:
      return state;
  }
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'hydrate': {
      const { dto } = action;

      const phase: Phase =
        dto.room_status === 'IN_PROGRESS' ? 'playing' : dto.room_status === 'COMPLETED' ? 'finished' : 'lobby';

      const round =
        dto.current_round_state && dto.current_round_state.status === 'IN_PROGRESS'
          ? dto.current_round_state
          : null;

      const roundId = round ? round.id : null;
      const roundChanged = roundId !== state.roundId;

      return {
        ...state,
        phase,
        totalRounds: dto.total_rounds,
        currentRound: dto.current_round,
        maxPlayers: dto.max_players,
        players: dto.players.map(toView),
        drawerId: round ? round.drawer_id : null,
        roundId,
        solved: roundChanged ? [] : state.solved,
        feed: roundChanged ? [] : state.feed,
        secret: state.secret && state.secret.roundId === roundId ? state.secret : null,
        remaining: phase === 'playing' ? state.remaining : null,
        fatal: null,
      };
    }

    case 'server':
      return applyServerMessage(state, action.msg);

    case 'connection':
      return { ...state, connection: action.status };

    case 'guess_correct':
      return state.solved.includes(action.playerId)
        ? state
        : { ...state, solved: [...state.solved, action.playerId] };

    case 'restore_round': {
      if (action.roundId !== state.roundId) return state;

      const names = new Map(state.players.map((p) => [p.id, p.display_name]));
      let next: GameState = { ...state, feed: [], feedSeq: state.feedSeq };
      const solved = new Set<number>();

      for (const guess of action.guesses) {
        const name = names.get(guess.player_id) ?? 'Player';

        if (guess.is_correct) {
          if (guess.points_awarded > 0 || !solved.has(guess.player_id)) {
            solved.add(guess.player_id);
            next = {
              ...next,
              ...pushFeed(next, {
                kind: 'correct',
                text: 'guessed the word!',
                playerId: guess.player_id,
                name,
              }),
            };
          }
        } else {
          next = {
            ...next,
            ...pushFeed(next, {
              kind: 'guess',
              text: guess.guess_text,
              playerId: guess.player_id,
              name,
            }),
          };
        }
      }

      return { ...next, solved: Array.from(solved) };
    }

    case 'dismiss_round_result':
      return { ...state, roundResult: null };

    case 'final_board':
      return { ...state, finalBoard: action.board };

    case 'fatal':
      return { ...state, fatal: action.message };

    default:
      return state;
  }
}
