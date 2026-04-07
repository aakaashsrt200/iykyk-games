const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export class RoomSocket {
  constructor(code, playerToken, onMessage, onClose) {
    this._code = code;
    this._token = playerToken;
    this._onMessage = onMessage;
    this._onClose = onClose;
    this._ws = null;
    this._retries = 0;
    this._intentionalClose = false;
  }

  connect() {
    this._intentionalClose = false;
    this._open();
  }

  _open() {
    const url = `${WS_URL}/ws/${this._code}/${this._token}`;
    this._ws = new WebSocket(url);

    this._ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._onMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    this._ws.onclose = (e) => {
      if (this._intentionalClose) return;
      // 4003 = room closed, 4004 = not found/unauthorized — don't retry
      if (e.code === 4003 || e.code === 4004) {
        this._onClose(e.code);
        return;
      }
      if (this._retries < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, this._retries);
        this._retries++;
        setTimeout(() => this._open(), delay);
      } else {
        this._onClose(e.code);
      }
    };

    this._ws.onopen = () => {
      this._retries = 0;
    };
  }

  send(action) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(action));
    }
  }

  disconnect() {
    this._intentionalClose = true;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}
