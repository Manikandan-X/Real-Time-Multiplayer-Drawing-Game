/**
 * A player's identity inside one room. The backend issues the token when
 * the player joins; it is the only credential for every protected call.
 *
 * sessionStorage (not localStorage) is used on purpose: every browser tab
 * is its own player, so you can test a multiplayer game with several
 * tabs side by side, and a page refresh still reconnects you.
 */
export interface Session {
  playerId: number;
  token: string;
  displayName: string;
}

const PREFIX = 'doodle.session.';
const key = (roomCode: string) => `${PREFIX}${roomCode.trim().toUpperCase()}`;

export function loadSession(roomCode: string): Session | null {
  try {
    const raw = sessionStorage.getItem(key(roomCode));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Session>;

    if (
      typeof parsed.playerId === 'number' &&
      typeof parsed.token === 'string' &&
      typeof parsed.displayName === 'string'
    ) {
      return parsed as Session;
    }
  } catch {
    /* corrupted entry: fall through */
  }

  return null;
}

export function saveSession(roomCode: string, session: Session): void {
  try {
    sessionStorage.setItem(key(roomCode), JSON.stringify(session));
  } catch {
    /* storage unavailable (private mode): the game still works until refresh */
  }
}

export function clearSession(roomCode: string): void {
  try {
    sessionStorage.removeItem(key(roomCode));
  } catch {
    /* ignore */
  }
}

/** Every room this tab can still return to. */
export function listSessions(): { roomCode: string; session: Session }[] {
  const found: { roomCode: string; session: Session }[] = [];

  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const storageKey = sessionStorage.key(i);
      if (!storageKey || !storageKey.startsWith(PREFIX)) continue;

      const roomCode = storageKey.slice(PREFIX.length);
      const session = loadSession(roomCode);
      if (session) found.push({ roomCode, session });
    }
  } catch {
    /* ignore */
  }

  return found;
}
