import type { AttackKind, GameMode, MatchResult, MatchSelection } from "./types";

export type OnlineRole = "host" | "guest";
export type ControlAction = "left" | "right" | "up" | "down" | "block" | "light" | "heavy" | "special";
export type ButtonState = Record<ControlAction, boolean>;

export interface FighterNetState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  health: number;
  lives?: number;
  shield: number;
  cooldowns: Record<AttackKind, number>;
  rounds: number;
  facing: 1 | -1;
  isBlocking: boolean;
}

export interface MatchNetState {
  playerOne: FighterNetState;
  playerTwo: FighterNetState;
  roundNumber: number;
  remainingTime: number;
  roundOver: boolean;
}

export interface OnlineRoom {
  roomCode: string;
  createdAt?: number;
}

export type OnlineMessage =
  | { type: "created"; roomCode: string }
  | { type: "joined"; roomCode: string }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "match-start"; selection: MatchSelection }
  | { type: "match-result"; result: MatchResult }
  | { type: "input"; controls: ButtonState }
  | { type: "state"; state: MatchNetState }
  | { type: "error"; message: string };

type Listener = (message: OnlineMessage) => void;
type WireMessage = OnlineMessage | { type: "create" } | { type: "join"; roomCode: string };

const blankControls = (): ButtonState => ({
  left: false,
  right: false,
  up: false,
  down: false,
  block: false,
  light: false,
  heavy: false,
  special: false,
});

class OnlineSession {
  role?: OnlineRole;
  roomCode = "";
  status = "Offline";
  latestSelection?: MatchSelection;
  latestResult?: MatchResult;
  latestState?: MatchNetState;
  remoteControls: ButtonState = blankControls();
  private socket?: WebSocket;
  private listeners = new Set<Listener>();

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async listRooms(): Promise<OnlineRoom[]> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${getRelayHttpUrl()}/rooms`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Room browser failed: ${response.status}`);
      const data = (await response.json()) as { rooms?: OnlineRoom[] };
      return Array.isArray(data.rooms) ? data.rooms : [];
    } finally {
      window.clearTimeout(timeout);
    }
  }

  connect(role: OnlineRole, roomCode?: string) {
    this.disconnect();
    this.role = role;

    if (typeof WebSocket === "undefined") {
      this.status = "This browser does not support online play";
      this.emit({ type: "error", message: this.status });
      return;
    }

    const normalizedCode = roomCode?.trim().toUpperCase() ?? "";
    if (role === "guest" && !normalizedCode) {
      this.status = "Select a room";
      this.emit({ type: "error", message: this.status });
      return;
    }

    this.roomCode = normalizedCode;
    this.status = role === "host" ? "Creating room..." : "Joining room...";
    const socket = new WebSocket(getRelayWsUrl());
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (role === "host") this.send({ type: "create" });
      else this.send({ type: "join", roomCode: normalizedCode });
    });
    socket.addEventListener("message", (event) => this.handleMessage(event.data));
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.remoteControls = blankControls();
      if (this.status !== "Offline") {
        this.status = "Other player disconnected";
        this.emit({ type: "peer-left" });
      }
    });
    socket.addEventListener("error", () => {
      if (this.socket !== socket) return;
      this.status = "Online server connection failed";
      this.emit({ type: "error", message: this.status });
    });
  }

  disconnect() {
    this.socket?.close();
    this.socket = undefined;
    this.role = undefined;
    this.roomCode = "";
    this.latestSelection = undefined;
    this.latestResult = undefined;
    this.latestState = undefined;
    this.remoteControls = blankControls();
    this.status = "Offline";
  }

  onMessage(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: WireMessage) {
    if (!this.connected) return;
    this.socket?.send(JSON.stringify(message));
  }

  sendInput(controls: ButtonState) {
    this.send({ type: "input", controls });
  }

  sendState(state: MatchNetState) {
    this.latestState = state;
    this.send({ type: "state", state });
  }

  sendMatchStart(selection: MatchSelection) {
    this.latestSelection = selection;
    this.send({ type: "match-start", selection });
  }

  sendMatchResult(result: MatchResult) {
    this.latestResult = result;
    this.send({ type: "match-result", result });
  }

  private handleMessage(data: unknown) {
    let message: OnlineMessage;
    try {
      message = JSON.parse(String(data)) as OnlineMessage;
    } catch {
      return;
    }
    if (!message || typeof message !== "object" || !("type" in message)) return;

    if (message.type === "created" || message.type === "joined") {
      this.roomCode = message.roomCode;
      this.status = message.type === "created" ? `Room ${message.roomCode} ready` : `Joined room ${message.roomCode}`;
    } else if (message.type === "peer-joined") {
      this.status = "Other player connected";
    } else if (message.type === "match-start") {
      this.latestSelection = { ...message.selection, mode: "online-guest" as GameMode, roomCode: this.roomCode };
    } else if (message.type === "match-result") {
      this.latestResult = { ...message.result, mode: "online-guest" as GameMode };
    } else if (message.type === "input") {
      this.remoteControls = { ...blankControls(), ...message.controls };
    } else if (message.type === "state") {
      this.latestState = message.state;
    } else if (message.type === "error") {
      this.status = message.message;
    } else if (message.type === "peer-left") {
      this.status = "Other player disconnected";
    }

    this.emit(message);
  }

  private emit(message: OnlineMessage) {
    this.listeners.forEach((listener) => listener(message));
  }
}

function getRelayHttpUrl() {
  const configured = getConfiguredRelayUrl();
  if (configured) return configured.replace(/^ws/, "http").replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:8080`;
}

function getRelayWsUrl() {
  const configured = getConfiguredRelayUrl();
  if (configured) return configured.replace(/^http/, "ws").replace(/\/$/, "");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8080`;
}

function getConfiguredRelayUrl() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_ONLINE_SERVER_URL;
}

export const onlineSession = new OnlineSession();
