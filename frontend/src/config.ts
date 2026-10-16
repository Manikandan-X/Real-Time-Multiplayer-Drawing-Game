const rawApi = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

/** Base URL of the FastAPI backend (routes live at the root: /rooms, /health, ...). */
export const API_URL = rawApi.replace(/\/+$/, '');

const rawWs = (import.meta.env.VITE_WS_URL as string | undefined) ?? API_URL.replace(/^http/, 'ws');

/** Base URL of the WebSocket endpoint: ws://host:port (the path is /ws/rooms/{code}). */
export const WS_URL = rawWs.replace(/\/+$/, '');

/** Mirrors the backend's constants.py */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 10;
export const ROOM_CODE_LENGTH = 6;
export const DEFAULT_ROUND_SECONDS = 90;
