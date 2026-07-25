import Phaser from "phaser";
import type { GameMode } from "../types";

type TitleMenu = "main" | "start";

export class TitleScene extends Phaser.Scene {
  private activeMenu: TitleMenu = "main";

  constructor() {
    super("TitleScene");
  }

  create() {
    this.activeMenu = "main";
    this.render();
  }

  private render() {
    this.children.removeAll();
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "beach2").setDisplaySize(width, height).setAlpha(0.82);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070b11, 0.38);
    this.add.rectangle(width / 2 - 420, height / 2, 430, 980, 0xe43f2e, 0.78).setAngle(-16);
    this.add.rectangle(width / 2 + 440, height / 2, 430, 980, 0x1976d2, 0.72).setAngle(16);
    this.add.rectangle(width / 2, 606, width + 180, 142, 0x101820, 0.9).setAngle(-3);

    this.add
      .text(width / 2, 94, "NESKOWIN", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "86px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 164, "COAST FIGHTER", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "58px",
        color: "#f3d86f",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 9,
      })
      .setOrigin(0.5);

    this.add.image(245, 390, "fighter-proposal-rock").setDisplaySize(355, 265).setAngle(-8);
    this.add.image(width - 240, 382, "fighter-chelan").setDisplaySize(370, 222).setAngle(8);
    this.add.text(width / 2, 286, this.activeMenu === "main" ? "MAIN MENU" : "START GAME", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "25px",
      color: "#f7f2e6",
      fontStyle: "900",
      backgroundColor: "rgba(16, 24, 32, 0.78)",
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);

    if (this.activeMenu === "main") {
      this.addButton(width / 2 - 150, 430, "Start Game", () => this.showStartMenu(), 280, 88, -4);
      this.addButton(width / 2 + 150, 430, "View Characters", () => this.scene.start("CharacterViewerScene"), 300, 88, 4);
    } else {
      this.addButton(width / 2 - 290, 430, "Campaign", () => this.scene.start("CampaignSelectScene"), 255, 88, -5);
      this.addButton(width / 2, 430, "Single Battle", () => this.startMode("local"), 285, 88, 0);
      this.addButton(width / 2 + 290, 430, "Online Battle", () => this.scene.start("OnlineScene"), 285, 88, 5);
      this.addButton(width / 2, 535, "Back", () => this.showMainMenu(), 170, 62, 0);
    }

    this.add
      .text(width / 2, height - 76, "WASD/F/G/H/Shift    Arrows/J/K/L/Slash    Online rooms work across web devices", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "21px",
        color: "#f4f0e8",
        fontStyle: "800",
      })
      .setOrigin(0.5);
  }

  private showMainMenu() {
    this.activeMenu = "main";
    this.render();
  }

  private showStartMenu() {
    this.activeMenu = "start";
    this.render();
  }

  private addButton(x: number, y: number, label: string, onClick: () => void, buttonWidth = 285, buttonHeight = 92, angle = 0) {
    const button = this.add
      .rectangle(x, y, buttonWidth, buttonHeight, 0xf7f2e6, 1)
      .setStrokeStyle(6, 0x101820)
      .setAngle(angle)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "32px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setAngle(angle);

    button.on("pointerover", () => button.setFillStyle(0xf3d98c));
    button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }

  private startMode(mode: GameMode) {
    this.scene.start("CharacterSelectScene", { mode });
  }
}
