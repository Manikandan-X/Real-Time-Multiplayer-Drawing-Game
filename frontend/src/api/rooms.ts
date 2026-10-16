import { authHeaders, http } from './client';
import type {
  GameResultsDto,
  GameStartDto,
  GameStateDto,
  GuessDto,
  GuessHistoryDto,
  LeaderboardDto,
  PlayerDto,
  PlayerJoinResponse,
  Room,
  RoomList,
} from './types';

const code = (roomCode: string) => encodeURIComponent(roomCode.trim().toUpperCase());

export const roomsApi = {
  list: async () => (await http.get<RoomList>('/rooms')).data,

  create: async (maxPlayers: number, totalRounds: number) =>
    (await http.post<Room>('/rooms', { max_players: maxPlayers, total_rounds: totalRounds })).data,

  get: async (roomCode: string) => (await http.get<Room>(`/rooms/${code(roomCode)}`)).data,

  join: async (roomCode: string, displayName: string) =>
    (await http.post<PlayerJoinResponse>(`/rooms/${code(roomCode)}/join`, { display_name: displayName }))
      .data,

  gameState: async (roomCode: string) =>
    (await http.get<GameStateDto>(`/rooms/${code(roomCode)}/game-state`)).data,

  setReady: async (roomCode: string, token: string, isReady: boolean) =>
    (
      await http.patch<PlayerDto>(
        `/rooms/${code(roomCode)}/ready`,
        { is_ready: isReady },
        { headers: authHeaders(token) },
      )
    ).data,

  leave: async (roomCode: string, token: string) =>
    (await http.delete(`/rooms/${code(roomCode)}/players/me`, { headers: authHeaders(token) })).data,

  start: async (roomCode: string, token: string) =>
    (
      await http.post<GameStartDto>(`/rooms/${code(roomCode)}/start`, null, {
        headers: authHeaders(token),
      })
    ).data,

  submitGuess: async (roomCode: string, roundId: number, token: string, guessText: string) =>
    (
      await http.post<GuessDto>(
        `/rooms/${code(roomCode)}/rounds/${roundId}/guesses`,
        { guess_text: guessText },
        { headers: authHeaders(token) },
      )
    ).data,

  finishRound: async (roomCode: string, roundId: number, token: string) =>
    (
      await http.post(`/rooms/${code(roomCode)}/rounds/${roundId}/finish`, null, {
        headers: authHeaders(token),
      })
    ).data,

  guessHistory: async (roomCode: string, roundId: number) =>
    (await http.get<GuessHistoryDto>(`/rooms/${code(roomCode)}/rounds/${roundId}/guesses`)).data,

  leaderboard: async (roomCode: string) =>
    (await http.get<LeaderboardDto>(`/rooms/${code(roomCode)}/leaderboard`)).data,

  results: async (roomCode: string) =>
    (await http.get<GameResultsDto>(`/rooms/${code(roomCode)}/results`)).data,
};
