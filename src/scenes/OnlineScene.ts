import Phaser from "phaser";
import { onlineSession, type OnlineRoom } from "../online";

export class OnlineScene extends Phaser.Scene {
  private rooms: OnlineRoom[] = [];
  private selectedRoomCode = "";
  private statusText?: Phaser.GameObjects.Text;
  private roomList?: Phaser.GameObjects.Container;
  private joinButton?: Phaser.GameObjects.Rectangle;
  private joinButtonText?: Phaser.GameObjects.Text;
  private cleanup?: () => void;
  private refreshEvent?: Phaser.Time.TimerEvent;
  private loadingRooms = false;

  constructor() {
    super("OnlineScene");
  }

  create() {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "beach2").setDisplaySize(width, height).setAlpha(0.72);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070b11, 0.46);
    this.add.rectangle(width / 2, 78, width + 120, 124, 0x101820, 0.88).setAngle(-2).setStrokeStyle(4, 0x7ee8ff, 0.74);

    this.add
      .text(width / 2, 64, "ONLINE SERVER BROWSER", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "50px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add.rectangle(width / 2, 352, 760, 390, 0xf7f2e6, 0.96).setStrokeStyle(8, 0x101820);
    this.add
      .text(width / 2, 186, "OPEN GAMES", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "34px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    this.roomList = this.add.container(width / 2, 242);

    this.addButton(width / 2 - 170, height - 88, "Host Game", () => this.hostGame(), 270, 72, 28);
    this.addButton(width / 2 + 170, height - 88, "Join Game", () => this.joinSelectedRoom(), 270, 72, 28, () => Boolean(this.selectedRoomCode));

    this.statusText = this.add
      .text(width / 2, height - 28, "Loading open games...", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#fff7e6",
        fontStyle: "800",
        backgroundColor: "rgba(16, 24, 32, 0.72)",
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-ESC", () => this.scene.start("TitleScene"));
    this.cleanup = onlineSession.onMessage((message) => {
      this.refreshStatus();
      if (message.type === "created") {
        this.scene.start("CharacterSelectScene", { mode: "online-host" });
      } else if (message.type === "match-start" && onlineSession.latestSelection) {
        this.scene.start("FightScene", onlineSession.latestSelection);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup?.();
      this.cleanup = undefined;
      this.refreshEvent?.remove(false);
      this.refreshEvent = undefined;
    });

    this.refreshRooms();
    this.refreshEvent = this.time.addEvent({ delay: 2500, loop: true, callback: () => this.refreshRooms() });
  }

  private async refreshRooms() {
    if (this.loadingRooms) return;
    this.loadingRooms = true;
    try {
      this.rooms = await onlineSession.listRooms();
      if (this.selectedRoomCode && !this.rooms.some((room) => room.roomCode === this.selectedRoomCode)) {
        this.selectedRoomCode = "";
      }
      this.renderRooms();
      this.refreshStatus(this.rooms.length ? "Select an open game, then join." : "No open games found.");
    } catch {
      this.rooms = [];
      this.selectedRoomCode = "";
      this.renderRooms();
      this.refreshStatus("Online server unavailable.");
    } finally {
      this.loadingRooms = false;
      this.updateJoinButton();
    }
  }

  private renderRooms() {
    this.roomList?.removeAll(true);
    if (!this.roomList) return;

    if (this.rooms.length === 0) {
      this.roomList.add(
        this.add
          .text(0, 116, "NO OPEN GAMES", {
            fontFamily: "Impact, system-ui, sans-serif",
            fontSize: "36px",
            color: "#101820",
            fontStyle: "900",
          })
          .setOrigin(0.5),
      );
      return;
    }

    this.rooms.slice(0, 6).forEach((room, index) => {
      const y = index * 54;
      const selected = room.roomCode === this.selectedRoomCode;
      const row = this.add
        .rectangle(0, y, 620, 46, selected ? 0xe8c66b : 0x101820, selected ? 1 : 0.9)
        .setStrokeStyle(selected ? 5 : 2, selected ? 0x101820 : 0x5dbfd3)
        .setInteractive({ useHandCursor: true });
      const code = this.add
        .text(-268, y, `ROOM ${room.roomCode}`, {
          fontFamily: "Impact, system-ui, sans-serif",
          fontSize: "27px",
          color: selected ? "#101820" : "#fff7e6",
          fontStyle: "900",
        })
        .setOrigin(0, 0.5);
      const age = this.add
        .text(252, y, this.formatAge(room.createdAt), {
          fontFamily: "system-ui, sans-serif",
          fontSize: "17px",
          color: selected ? "#101820" : "#dbe9df",
          fontStyle: "800",
        })
        .setOrigin(1, 0.5);
      const selectRoom = () => {
        this.selectedRoomCode = room.roomCode;
        this.renderRooms();
        this.updateJoinButton();
      };
      row.on("pointerdown", selectRoom);
      code.setInteractive({ useHandCursor: true }).on("pointerdown", selectRoom);
      age.setInteractive({ useHandCursor: true }).on("pointerdown", selectRoom);
      this.roomList?.add([row, code, age]);
    });
  }

  private hostGame() {
    onlineSession.connect("host");
    this.refreshStatus();
  }

  private joinSelectedRoom() {
    if (!this.selectedRoomCode) return;
    onlineSession.connect("guest", this.selectedRoomCode);
    this.refreshStatus();
  }

  private refreshStatus(fallback?: string) {
    const suffix = onlineSession.roomCode ? ` | Code: ${onlineSession.roomCode}` : "";
    this.statusText?.setText(`${onlineSession.status === "Offline" ? (fallback ?? onlineSession.status) : onlineSession.status}${suffix}`);
  }

  private updateJoinButton() {
    const enabled = Boolean(this.selectedRoomCode);
    this.joinButton?.setFillStyle(enabled ? 0xe8c66b : 0x778088, enabled ? 1 : 0.72);
    this.joinButton?.setInteractive(enabled ? { useHandCursor: true } : false);
    this.joinButtonText?.setColor(enabled ? "#101820" : "#dbe0df");
    this.joinButtonText?.setAlpha(enabled ? 1 : 0.74);
  }

  private addButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    buttonWidth = 250,
    buttonHeight = 68,
    fontSize = 24,
    isEnabled: () => boolean = () => true,
  ) {
    const enabled = isEnabled();
    const button = this.add
      .rectangle(x, y, buttonWidth, buttonHeight, enabled ? 0xe8c66b : 0x778088, enabled ? 1 : 0.72)
      .setStrokeStyle(4, 0x101820);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: `${fontSize}px`,
        color: enabled ? "#101820" : "#dbe0df",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setAlpha(enabled ? 1 : 0.74);
    const click = () => {
      if (isEnabled()) onClick();
    };
    button.setInteractive(isEnabled() ? { useHandCursor: true } : false);
    button.on("pointerover", () => {
      if (isEnabled()) button.setFillStyle(0xf3d98c);
    });
    button.on("pointerout", () => button.setFillStyle(isEnabled() ? 0xe8c66b : 0x778088, isEnabled() ? 1 : 0.72));
    button.on("pointerdown", click);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", click);

    if (label === "Join Game") {
      this.joinButton = button;
      this.joinButtonText = text;
      this.updateJoinButton();
    }
  }

  private formatAge(createdAt?: number) {
    if (!createdAt) return "Waiting";
    const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  }
}
