import axios from 'axios';
import { API_URL } from '../config';

export const http = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

/** Turns any thrown value into a message that is safe to show to a player. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;

    if (typeof detail === 'string') return detail;

    // FastAPI validation errors: [{ loc, msg, type }, ...]
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          item && typeof item === 'object' && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .join(' · ');
    }

    if (detail && typeof detail === 'object' && 'message' in detail) {
      return String((detail as { message: unknown }).message);
    }

    if (err.code === 'ERR_NETWORK' || !err.response) {
      return 'Cannot reach the game server. Is the backend running?';
    }

    return err.message;
  }

  return err instanceof Error ? err.message : 'Something went wrong.';
}

/** The backend authenticates players with this header on every protected route. */
export const authHeaders = (token: string) => ({ 'X-Session-Token': token });
