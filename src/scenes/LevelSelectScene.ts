import Phaser from "phaser";
import { getFighter } from "../fighters";
import { levels } from "../levels";
import { onlineSession } from "../online";
import { rerenderOnResize } from "../responsive";
import type { GameMode, MatchSelection } from "../types";

interface LevelSelectData {
  mode: GameMode;
  playerOneId: string;
  playerTwoId: string;
}

export class LevelSelectScene extends Phaser.Scene {
  private mode: GameMode = "ai";
  private playerOneId = "proposal-rock";
  private playerTwoId = "chelan";
  private selectedIndex = 0;

  constructor() {
    super("LevelSelectScene");
  }

  init(data: LevelSelectData) {
    this.mode = data.mode ?? "ai";
    this.playerOneId = data.playerOneId ?? "proposal-rock";
    this.playerTwoId = data.playerTwoId ?? "chelan";
    this.selectedIndex = 0;
  }

  create() {
    rerenderOnResize(this, () => this.render());
    this.render();
  }

  private render() {
    this.children.removeAll();
    const { width, height } = this.scale;
    const selectedLevel = levels[this.selectedIndex];

    this.add.image(width / 2, height / 2, selectedLevel.textureKey).setDisplaySize(width, height).setAlpha(0.72);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070b11, 0.45);

    this.add.rectangle(width / 2, 74, width, 112, 0x101820, 0.72).setStrokeStyle(3, selectedLevel.accent, 0.75);
    this.add
      .text(width / 2, 46, "SELECT LEVEL", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "42px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 94, `${getFighter(this.playerOneId).displayName} vs ${getFighter(this.playerTwoId).displayName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#dbe9df",
        fontStyle: "800",
      })
      .setOrigin(0.5);

    this.add.image(width / 2, 310, selectedLevel.textureKey).setDisplaySize(680, 382).setDepth(2);
    this.add.rectangle(width / 2, 310, 700, 402, 0x000000, 0).setStrokeStyle(8, selectedLevel.accent, 0.95).setDepth(3);
    this.add.rectangle(width / 2, 504, 720, 72, 0x101820, 0.9).setStrokeStyle(4, 0xf7f2e6, 0.86).setDepth(4);
    this.add
      .text(width / 2, 504, selectedLevel.displayName, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "44px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(5);

    const startX = width / 2 - ((levels.length - 1) * 142) / 2;
    levels.forEach((level, index) => {
      const x = startX + index * 142;
      this.addLevelTile(x, height - 98, level.textureKey, level.displayName, level.accent, index === this.selectedIndex, () => {
        this.selectedIndex = index;
        this.render();
      });
    });

    this.addButton(106, 58, "Back", () => {
      this.scene.start("CharacterSelectScene", {
        mode: this.mode,
        playerOneId: this.playerOneId,
        playerTwoId: this.playerTwoId,
      });
    }, 150, 56, 20);
    this.addButton(width - 170, 58, "Fight", () => this.startFight(), 230, 64, 26);
    if (this.mode === "online-host") {
      this.add
        .text(width - 454, 58, `Room ${onlineSession.roomCode || "----"}`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          color: "#fff7e6",
          fontStyle: "900",
          backgroundColor: "rgba(16, 24, 32, 0.72)",
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(12);
    }
  }

  private addLevelTile(
    x: number,
    y: number,
    textureKey: string,
    label: string,
    accent: number,
    selected: boolean,
    onClick: () => void,
  ) {
    const tile = this.add.container(x, y).setDepth(8);
    const bg = this.add.rectangle(0, 0, 128, 86, 0x101820, 0.92).setStrokeStyle(selected ? 5 : 2, selected ? 0xffffff : accent, 0.95);
    const preview = this.add.image(0, -8, textureKey).setDisplaySize(118, 62);
    const name = this.add
      .text(0, 33, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: selected ? "#101820" : "#fff7e6",
        fontStyle: "900",
        backgroundColor: selected ? "#fff7e6" : "rgba(16, 24, 32, 0.8)",
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5);
    tile.add([bg, preview, name]);
    tile.setAngle(selected ? -4 : 0);
    bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    preview.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    name.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
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
      .rectangle(x, y, buttonWidth, buttonHeight, 0xf7f2e6, 1)
      .setStrokeStyle(4, 0x101820)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: `${fontSize}px`,
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(11);
    button.on("pointerover", () => button.setFillStyle(0xe8c66b));
    button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }

  private startFight() {
    const selection: MatchSelection = {
      mode: this.mode,
      playerOneId: this.playerOneId,
      playerTwoId: this.playerTwoId,
      levelId: levels[this.selectedIndex].id,
    };
    this.scene.start("FightScene", selection);
  }
}
