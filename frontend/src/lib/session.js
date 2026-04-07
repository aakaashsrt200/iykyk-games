// ─── Room code generation ─────────────────────────────────────────────────────

const ADJECTIVES = ['royal','golden','silver','crimson','lucky','bold','swift','iron','dark','noble'];
const NOUNS      = ['falcon','tiger','dragon','cobra','wolf','shark','viper','eagle','lion','fox'];

export function generateRoomCode() {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num  = Math.floor(Math.random() * 90) + 10;
  return `${adj}-${noun}-${num}`;
}

// ─── Session storage (survives page refresh) ──────────────────────────────────

const KEY = 'iykyk_session';

export function saveSession({ roomCode, playerToken, playerName, isHost }) {
  localStorage.setItem(KEY, JSON.stringify({ roomCode, playerToken, playerName, isHost }));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

// ─── UUID v4 ──────────────────────────────────────────────────────────────────

export function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}
