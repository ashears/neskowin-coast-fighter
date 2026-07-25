import type { GameMode, MatchResult, MatchSelection } from "./types";

export type OnlineRole = "host" | "guest";
export type ControlAction = "left" | "right" | "up" | "down" | "block" | "light" | "heavy" | "special";
export type ButtonState = Record<ControlAction, boolean>;

export interface FighterNetState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  health: number;
  shield: number;
  specialCharge: number;
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

  connect(role: OnlineRole, roomCode?: string) {
    this.disconnect();
    this.role = role;
    this.status = role === "host" ? "Creating room..." : "Joining room...";
    const url = this.getServerUrl();
    this.socket = new WebSocket(url);
    this.socket.addEventListener("open", () => {
      this.send(role === "host" ? { type: "create" } : { type: "join", roomCode: roomCode?.trim().toUpperCase() });
    });
    this.socket.addEventListener("message", (event) => this.handleMessage(event.data));
    this.socket.addEventListener("close", () => {
      this.status = "Disconnected";
      this.emit({ type: "peer-left" });
    });
    this.socket.addEventListener("error", () => {
      this.status = "Could not reach online server";
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

  send(message: Record<string, unknown>) {
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

  private handleMessage(data: string) {
    let message: OnlineMessage;
    try {
      message = JSON.parse(data) as OnlineMessage;
    } catch {
      return;
    }

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
    }

    this.emit(message);
  }

  private emit(message: OnlineMessage) {
    this.listeners.forEach((listener) => listener(message));
  }

  private getServerUrl() {
    const params = new URLSearchParams(window.location.search);
    const configured = params.get("server");
    if (configured) return configured;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:8080`;
  }
}

export const onlineSession = new OnlineSession();
