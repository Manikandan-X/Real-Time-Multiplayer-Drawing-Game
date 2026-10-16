// Response shapes copied from the backend's Pydantic schemas (app/schemas/*.py).

export type RoomStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';

export interface Room {
  id: number;
  room_code: string;
  status: RoomStatus;
  max_players: number;
  total_rounds: number;
  current_round: number;
  created_at: string;
  updated_at: string;
}

export interface RoomListItem {
  room_code: string;
  status: RoomStatus;
  current_players: number;
  max_players: number;
  total_rounds: number;
}

export interface RoomList {
  total_rooms: number;
  rooms: RoomListItem[];
}

export interface PlayerDto {
  id: number;
  room_id: number;
  display_name: string;
  is_ready: boolean;
  is_connected: boolean;
  score: number;
  joined_at: string;
}

export interface PlayerJoinResponse extends PlayerDto {
  session_token: string;
}

export interface RoundStateDto {
  id: number;
  round_number: number;
  drawer_id: number | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface GameStateDto {
  room_code: string;
  room_status: RoomStatus;
  current_round: number;
  total_rounds: number;
  max_players: number;
  total_players: number;
  players: PlayerDto[];
  current_round_state: RoundStateDto | null;
}

export interface GameStartDto {
  room_code: string;
  status: RoomStatus;
  current_round: number;
  total_rounds: number;
  round_id: number;
  drawer_id: number;
}

export interface GuessDto {
  id: number;
  round_id: number;
  player_id: number;
  guess_text: string;
  is_correct: boolean;
  points_awarded: number;
  guessed_at: string;
}

export interface GuessHistoryDto {
  room_code: string;
  round_id: number;
  total_guesses: number;
  guesses: GuessDto[];
}

export interface LeaderboardEntry {
  rank: number;
  player_id: number;
  display_name: string;
  score: number;
}

export interface LeaderboardDto {
  room_code: string;
  total_players: number;
  leaderboard: LeaderboardEntry[];
}

export interface GameResultsDto {
  room_code: string;
  game_status: RoomStatus;
  total_rounds: number;
  completed_rounds: number;
  total_players: number;
  leaderboard: LeaderboardEntry[];
}
