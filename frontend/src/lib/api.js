const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Request failed: ${res.status}`);
  return body;
}

export function createRoom(name, gameType = 'blackjack') {
  return request('/api/rooms/', {
    method: 'POST',
    body: JSON.stringify({ name, game_type: gameType }),
  });
}

export function joinRoom(code, name) {
  return request(`/api/rooms/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
