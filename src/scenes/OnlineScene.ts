import Phaser from "phaser";
import { onlineSession } from "../online";

export class OnlineScene extends Phaser.Scene {
  private joinCode = "";
  private statusText?: Phaser.GameObjects.Text;
  private codeText?: Phaser.GameObjects.Text;
  private cleanup?: () => void;

  constructor() {
    super("OnlineScene");
  }

  create() {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "beach2").setDisplaySize(width, height).setAlpha(0.72);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070b11, 0.46);
    this.add.rectangle(width / 2, 78, width + 120, 124, 0x101820, 0.88).setAngle(-2).setStrokeStyle(4, 0x7ee8ff, 0.74);

    this.add
      .text(width / 2, 64, "ONLINE MULTIPLAYER", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "52px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.addPanel(width * 0.31, 356, "HOST", "Create a room on this computer, then pick fighters and a level.", () => {
      onlineSession.connect("host");
      this.refreshStatus();
    });
    this.addJoinPanel(width * 0.69, 356);
    this.addButton(94, 56, "Back", () => this.scene.start("TitleScene"), 140, 56, 20);

    this.statusText = this.add
      .text(width / 2, height - 58, onlineSession.status, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#fff7e6",
        fontStyle: "800",
        backgroundColor: "rgba(16, 24, 32, 0.72)",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);

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
    });
  }

  private addPanel(x: number, y: number, title: string, body: string, onClick: () => void) {
    this.add.rectangle(x, y, 420, 330, 0xf7f2e6, 0.96).setStrokeStyle(8, 0x101820);
    this.add
      .text(x, y - 108, title, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "46px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    this.add
      .text(x, y - 38, body, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "21px",
        color: "#101820",
        fontStyle: "800",
        align: "center",
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5);
    this.addButton(x, y + 96, "Create Room", onClick, 250, 68, 25);
  }

  private addJoinPanel(x: number, y: number) {
    this.add.rectangle(x, y, 420, 330, 0xf7f2e6, 0.96).setStrokeStyle(8, 0x101820);
    this.add
      .text(x, y - 108, "JOIN", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "46px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    this.codeText = this.add
      .text(x, y - 28, "ROOM CODE: ____", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "34px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + 26, "Tap the code box, type the host code, then join as Player 2.", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "19px",
        color: "#101820",
        fontStyle: "800",
        align: "center",
        wordWrap: { width: 330 },
      })
      .setOrigin(0.5);
    this.codeText.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.promptForCode());
    this.addButton(x - 82, y + 106, "Code", () => this.promptForCode(), 142, 64, 23);
    this.addButton(x + 92, y + 106, "Join", () => this.joinRoom(), 142, 64, 23);
  }

  private promptForCode() {
    const code = window.prompt("Room code", this.joinCode);
    if (code === null) return;
    this.joinCode = code.trim().toUpperCase().slice(0, 8);
    this.refreshCode();
  }

  private joinRoom() {
    if (!this.joinCode) this.promptForCode();
    if (!this.joinCode) return;
    onlineSession.connect("guest", this.joinCode);
    this.refreshStatus();
  }

  private refreshCode() {
    this.codeText?.setText(`ROOM CODE: ${this.joinCode || "____"}`);
  }

  private refreshStatus() {
    const suffix = onlineSession.roomCode ? ` | Code: ${onlineSession.roomCode}` : "";
    this.statusText?.setText(`${onlineSession.status}${suffix}`);
  }

  private addButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    buttonWidth = 250,
    buttonHeight = 68,
    fontSize = 24,
  ) {
    const button = this.add
      .rectangle(x, y, buttonWidth, buttonHeight, 0xe8c66b, 1)
      .setStrokeStyle(4, 0x101820)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: `${fontSize}px`,
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    button.on("pointerover", () => button.setFillStyle(0xf3d98c));
    button.on("pointerout", () => button.setFillStyle(0xe8c66b));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }
}
