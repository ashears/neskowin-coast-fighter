import Phaser from "phaser";
import { isFighterUnlocked, STARTING_FIGHTER_ID } from "../campaign";
import { fighters } from "../fighters";
import { onlineSession } from "../online";
import { rerenderOnResize } from "../responsive";
import { drawCharacterSkinOverlay } from "../skins";
import type { GameMode } from "../types";
import { getEquippedCharacterSkin } from "../victory";

interface CharacterSelectData {
  mode: GameMode;
  playerOneId?: string;
  playerTwoId?: string;
}

export class CharacterSelectScene extends Phaser.Scene {
  private mode: GameMode = "ai";
  private playerOneIndex = 0;
  private playerTwoIndex = 1;

  constructor() {
    super("CharacterSelectScene");
  }

  init(data: CharacterSelectData) {
    this.mode = data.mode ?? "ai";
    this.playerOneIndex = this.getUnlockedIndex(data.playerOneId ?? STARTING_FIGHTER_ID);
    this.playerTwoIndex = Math.max(0, fighters.findIndex((fighter) => fighter.id === data.playerTwoId));
    if (this.playerTwoIndex === this.playerOneIndex) this.playerTwoIndex = (this.playerOneIndex + 1) % fighters.length;
  }

  create() {
    rerenderOnResize(this, () => this.render());
    this.render();
  }

  private render() {
    this.children.removeAll();
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "beach1").setDisplaySize(width, height).setAlpha(0.66);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070b11, 0.52);
    this.add.rectangle(width / 2, 75, width + 120, 116, 0x101820, 0.88).setAngle(-2).setStrokeStyle(4, 0xf3d86f, 0.72);

    this.add
      .text(width / 2, 62, "SELECT FIGHTERS", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "54px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.addFighterPanel(width * 0.28, 328, "P1", this.playerOneIndex, -1, 0xe43f2e);
    this.addFighterPanel(width * 0.72, 328, this.mode === "ai" || this.mode === "campaign" ? "AI" : "P2", this.playerTwoIndex, 1, 0x1976d2);
    this.addRoster(width / 2, height - 142);
    this.addBattleModeToggle(width / 2 + 300, height - 54);

    this.addButton(width / 2, height - 54, "Choose Level", () => {
      this.scene.start("LevelSelectScene", {
        mode: this.mode,
        playerOneId: fighters[this.playerOneIndex].id,
        playerTwoId: fighters[this.playerTwoIndex].id,
      });
    }, 300, 66, 26);

    this.addButton(94, 56, "Back", () => this.scene.start("TitleScene"), 140, 56, 20);
    if (this.mode === "online-host") {
      this.add
        .text(width - 158, 56, `Room ${onlineSession.roomCode || "----"}`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          color: "#fff7e6",
          fontStyle: "900",
          backgroundColor: "rgba(16, 24, 32, 0.72)",
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5);
    }
  }

  private addFighterPanel(x: number, y: number, label: string, index: number, side: -1 | 1, accent: number) {
    const fighter = fighters[index];
    this.add.rectangle(x + side * 18, y, 390, 410, accent, 0.78).setAngle(side * -5);
    this.add.rectangle(x, y, 360, 430, 0xf7f2e6, 0.96).setStrokeStyle(8, 0x101820).setAngle(side * -3);
    this.add
      .text(x - side * 122, y - 178, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "42px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    const previewWidth = this.getPreviewWidth(fighter.id);
    this.add.image(x, y - 36, fighter.spriteKey).setDisplaySize(previewWidth, this.getPreviewHeight(fighter.id));
    drawCharacterSkinOverlay(this, getEquippedCharacterSkin(fighter.id), fighter.id, x, y - 36, previewWidth);
    this.add
      .text(x, y + 122, fighter.displayName.toUpperCase(), {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "31px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + 162, fighter.specialName, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#101820",
        fontStyle: "800",
      })
      .setOrigin(0.5);

    this.addArrowButton(x - 138, y + 205, "<", () => this.changeSelection(side, -1));
    this.addArrowButton(x + 138, y + 205, ">", () => this.changeSelection(side, 1));
  }

  private addRoster(x: number, y: number) {
    const spacing = 102;
    const startX = x - ((fighters.length - 1) * spacing) / 2;
    fighters.forEach((fighter, index) => {
      const isP1 = index === this.playerOneIndex;
      const isP2 = index === this.playerTwoIndex;
      const unlocked = isFighterUnlocked(fighter.id);
      const tileX = startX + index * spacing;
      const stroke = isP1 ? 0xe43f2e : isP2 ? 0x1976d2 : 0xf7f2e6;
      const bg = this.add.rectangle(tileX, y, 86, 86, unlocked ? 0x101820 : 0x313a36, 0.9).setStrokeStyle(isP1 || isP2 ? 5 : 2, stroke);
      this.add.image(tileX, y - 8, fighter.spriteKey).setDisplaySize(68, 54).setAlpha(unlocked ? 1 : 0.34);
      drawCharacterSkinOverlay(this, getEquippedCharacterSkin(fighter.id), fighter.id, tileX, y - 8, 68)?.setAlpha(unlocked ? 1 : 0.34);
      this.add
        .text(tileX, y + 32, isP1 ? "P1" : isP2 ? (this.mode === "ai" || this.mode === "campaign" ? "AI" : "P2") : unlocked ? fighter.displayName.split(" ")[0] : "LOCK", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: "#fff7e6",
          fontStyle: "900",
        })
        .setOrigin(0.5);
      bg.setInteractive({ useHandCursor: unlocked }).on("pointerdown", () => {
        if (!unlocked) return;
        this.playerOneIndex = index;
        if (this.playerTwoIndex === this.playerOneIndex) this.playerTwoIndex = (index + 1) % fighters.length;
        this.render();
      });
    });
  }

  private getPreviewWidth(id: string) {
    if (id === "proposal-rock") return 282;
    if (id === "chelan") return 292;
    if (id === "ocean") return 285;
    if (id === "duck-flag") return 170;
    return 190;
  }

  private getPreviewHeight(id: string) {
    if (id === "proposal-rock") return 212;
    if (id === "chelan") return 176;
    if (id === "ocean") return 188;
    if (id === "duck-flag") return 228;
    return 228;
  }

  private changeSelection(side: -1 | 1, delta: number) {
    const next = (current: number) => (current + delta + fighters.length) % fighters.length;
    if (side === -1) {
      this.playerOneIndex = this.nextUnlockedIndex(this.playerOneIndex, delta);
      if (this.playerOneIndex === this.playerTwoIndex) this.playerTwoIndex = next(this.playerTwoIndex);
    } else {
      this.playerTwoIndex = next(this.playerTwoIndex);
      if (this.playerTwoIndex === this.playerOneIndex) this.playerTwoIndex = next(this.playerTwoIndex);
    }
    this.render();
  }

  private getUnlockedIndex(preferredId: string) {
    const preferredIndex = fighters.findIndex((fighter) => fighter.id === preferredId && isFighterUnlocked(fighter.id));
    if (preferredIndex >= 0) return preferredIndex;
    const fallbackIndex = fighters.findIndex((fighter) => fighter.id === STARTING_FIGHTER_ID);
    return Math.max(0, fallbackIndex);
  }

  private nextUnlockedIndex(currentIndex: number, delta: number) {
    let nextIndex = currentIndex;
    for (let step = 0; step < fighters.length; step += 1) {
      nextIndex = (nextIndex + delta + fighters.length) % fighters.length;
      if (isFighterUnlocked(fighters[nextIndex].id)) return nextIndex;
    }
    return this.getUnlockedIndex(STARTING_FIGHTER_ID);
  }

  private addArrowButton(x: number, y: number, label: string, onClick: () => void) {
    this.addButton(x, y, label, onClick, 78, 58, 30);
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
    button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }

  private addBattleModeToggle(x: number, y: number) {
    if (this.mode === "campaign" || this.mode === "online-host" || this.mode === "online-guest") return;

    const label = this.mode === "local" ? "Two Local Players" : "One Player vs AI";
    this.add
      .text(x, y - 38, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "21px",
        color: "#fff7e6",
        fontStyle: "900",
        backgroundColor: "rgba(16, 24, 32, 0.78)",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5);

    this.addButton(
      x,
      y,
      this.mode === "local" ? "Use AI Opponent" : "Add Local P2",
      () => {
        this.mode = this.mode === "local" ? "ai" : "local";
        this.render();
      },
      260,
      58,
      22,
    );
  }
}
