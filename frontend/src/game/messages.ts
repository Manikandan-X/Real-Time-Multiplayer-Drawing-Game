// WebSocket protocol, copied from what the backend actually sends
// (routers/websocket.py, routers/room.py, services/round_timer_service.py,
// services/round_event_service.py).

export interface Point {
  /** Normalised 0..1 so every screen size reconstructs the same picture. */
  x: number;
  y: number;
}

export interface RoundScore {
  player_id: number;
  display_name: string;
  score: number;
  round_points: number;
}

export type ServerMessage =
  | { type: 'player_connected'; player_id: number; display_name: string; connected_players: number }
  | { type: 'player_disconnected'; player_id: number; display_name: string; connected_players: number }
  | {
      type: 'player_joined';
      player: { id: number; display_name: string; is_ready: boolean };
      total_players: number;
    }
  | { type: 'player_ready'; player_id: number; display_name: string; is_ready: boolean }
  | { type: 'player_left'; player_id: number; display_name: string; total_players: number }
  | {
      type: 'game_started';
      room_code: string;
      current_round: number;
      total_rounds: number;
      round_id: number;
      drawer_id: number;
      duration_seconds: number;
    }
  | {
      type: 'round_started';
      room_code: string;
      round_id: number;
      drawer_id: number;
      duration_seconds: number;
      // The drawer-finish path sends current_round, the timer path sends round_number.
      current_round?: number;
      round_number?: number;
      total_rounds?: number;
    }
  | { type: 'secret_word'; round_id: number; round_number?: number; word: string }
  | { type: 'round_timer'; round_id: number; round_number: number; remaining_seconds: number }
  | {
      type: 'round_ended';
      round_id: number;
      round_number: number;
      drawer_id: number | null;
      word: string;
      scores: RoundScore[];
    }
  | { type: 'game_completed'; room_code: string }
  | {
      type: 'guess_submitted';
      round_id: number;
      player_id: number;
      display_name: string;
      guess_text: string;
      is_correct: boolean;
      points_awarded: number;
    }
  | {
      type: 'correct_guess';
      round_id: number;
      player_id: number;
      display_name: string;
      points_awarded: number;
    }
  | {
      type: 'draw';
      points: Point[];
      color: string;
      line_width: number;
      player_id: number;
      display_name: string;
      round_number: number;
    }
  | { type: 'clear_canvas'; player_id?: number; display_name?: string; round_number?: number }
  | { type: 'error'; detail: string };

/** What a client may send. Everything else is rejected by the server. */
export type ClientMessage =
  | { type: 'draw'; points: Point[]; color: string; line_width: number }
  | { type: 'clear_canvas' };

/** Events the canvas component paints. Kept out of React state on purpose. */
export type CanvasEvent =
  | { kind: 'draw'; points: Point[]; color: string; width: number }
  | { kind: 'clear' };
