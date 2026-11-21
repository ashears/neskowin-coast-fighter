import { encodeMessage, PROTOCOL_VERSION } from '@ashears/fighter-relay/protocol';
import type { ClientMessage, ServerMessage } from '@ashears/fighter-relay/protocol';

type Dispatch = (message: ServerMessage) => void;

export class RoomConnection {
  private socket?: WebSocket;
  private timer?: number;

  constructor(private readonly receive: Dispatch, private readonly disconnected: (detail: string) => void) {}

  connect(initialAction: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send(initialAction);
      return;
    }
    this.close();
    const fallback = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8787/rooms`;
    const endpoint = import.meta.env.VITE_ROOM_URL || fallback;
    if (location.protocol === 'https:' && !import.meta.env.VITE_ROOM_URL) {
      this.disconnected('Private rooms need a configured room server on this site.');
      return;
    }
    let socket: WebSocket;
    try { socket = new WebSocket(endpoint); } catch {
      this.disconnected('The private room server address is invalid.');
      return;
    }
    this.socket = socket;
    this.timer = window.setTimeout(() => {
      this.close();
      this.disconnected('The private room server did not respond.');
    }, 5000);
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.clearTimer();
      this.send(initialAction);
    });
    socket.addEventListener('message', (event) => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      let message: ServerMessage & { v: number };
      try { message = JSON.parse(event.data) as typeof message; } catch { return; }
      if (!message || message.v !== PROTOCOL_VERSION) {
        this.close();
        this.disconnected('The room server requires a different game version.');
        return;
      }
      this.receive(message);
    });
    // Browsers report connection failures through close after error.
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.clearTimer();
      this.disconnected('Connection to the private room server was lost.');
    });
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    if (this.socket.bufferedAmount > 64 * 1024) {
      this.close();
      this.disconnected('The connection could not keep up with the match.');
      return;
    }
    this.socket.send(encodeMessage(message));
  }

  close() {
    const socket = this.socket;
    this.socket = undefined;
    this.clearTimer();
    socket?.close();
  }

  private clearTimer() {
    window.clearTimeout(this.timer);
    this.timer = undefined;
  }
}
