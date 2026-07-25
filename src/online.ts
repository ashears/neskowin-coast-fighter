import { DataConnection, Peer } from "peerjs";
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
type WireMessage = OnlineMessage | { type: "join-request"; roomCode: string };

const ROOM_PREFIX = "quick-game-coast";
const PEER_OPTIONS = {
  debug: 1,
  config: {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }],
  },
};

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
  private peer?: Peer;
  private connection?: DataConnection;
  private listeners = new Set<Listener>();

  get connected() {
    return Boolean(this.connection?.open);
  }

  connect(role: OnlineRole, roomCode?: string) {
    this.disconnect();
    this.role = role;
    if (!this.browserSupportsWebRtc()) {
      this.status = "This browser does not support online play";
      this.emit({ type: "error", message: this.status });
      return;
    }

    if (role === "host") this.createRoom();
    else this.joinRoom(roomCode);
  }

  disconnect() {
    this.connection?.close();
    this.peer?.destroy();
    this.connection = undefined;
    this.peer = undefined;
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
    this.connection?.send(message);
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

  private createRoom() {
    const roomCode = createRoomCode();
    this.roomCode = roomCode;
    this.status = "Creating room...";
    this.peer = new Peer(roomCodeToPeerId(roomCode), PEER_OPTIONS);
    this.peer.on("open", () => {
      this.status = `Room ${roomCode} ready`;
      this.emit({ type: "created", roomCode });
    });
    this.peer.on("connection", (connection) => {
      if (this.connection) {
        connection.on("open", () => connection.send({ type: "error", message: "Room is already full" }));
        connection.close();
        return;
      }
      this.bindConnection(connection);
      this.status = "Other player connecting...";
      connection.on("open", () => {
        this.status = "Other player connected";
        connection.send({ type: "joined", roomCode });
        this.emit({ type: "peer-joined" });
      });
    });
    this.peer.on("error", (error) => {
      if (error.type === "unavailable-id") {
        this.status = "Room code collision. Try creating a room again.";
      } else {
        this.status = `Online connection failed: ${error.type}`;
      }
      this.emit({ type: "error", message: this.status });
    });
  }

  private joinRoom(roomCode?: string) {
    const normalizedCode = roomCode?.trim().toUpperCase() ?? "";
    if (!normalizedCode) {
      this.status = "Enter a room code";
      this.emit({ type: "error", message: this.status });
      return;
    }

    this.roomCode = normalizedCode;
    this.status = "Joining room...";
    this.peer = new Peer(PEER_OPTIONS);
    this.peer.on("open", () => {
      const connection = this.peer?.connect(roomCodeToPeerId(normalizedCode), { reliable: true, serialization: "json" });
      if (!connection) return;
      this.bindConnection(connection);
      connection.on("open", () => {
        this.status = `Joined room ${normalizedCode}`;
        connection.send({ type: "join-request", roomCode: normalizedCode });
      });
    });
    this.peer.on("error", (error) => {
      this.status = error.type === "peer-unavailable" ? "Room not found" : `Online connection failed: ${error.type}`;
      this.emit({ type: "error", message: this.status });
    });
  }

  private bindConnection(connection: DataConnection) {
    this.connection = connection;
    connection.on("data", (data) => this.handleMessage(data));
    connection.on("close", () => {
      this.connection = undefined;
      this.remoteControls = blankControls();
      this.status = "Other player disconnected";
      this.emit({ type: "peer-left" });
    });
    connection.on("error", () => {
      this.status = "Peer connection failed";
      this.emit({ type: "error", message: this.status });
    });
  }

  private handleMessage(data: unknown) {
    const message = data as WireMessage;
    if (!message || typeof message !== "object" || !("type" in message)) return;

    if (message.type === "join-request") {
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

  private browserSupportsWebRtc() {
    return typeof RTCPeerConnection !== "undefined";
  }
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function roomCodeToPeerId(roomCode: string) {
  return `${ROOM_PREFIX}-${roomCode.toLowerCase()}`;
}

export const onlineSession = new OnlineSession();
