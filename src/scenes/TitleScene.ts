import Phaser from "phaser";
import { rerenderOnResize } from "../responsive";
import { drawCharacterSkinOverlay } from "../skins";
import type { GameMode } from "../types";
import { getModSettings, setDamageMultiplier, setInfiniteHealth, setRainbowFireworkMode, setScaryMode, setSpeedMultiplier } from "../mods";
import type { DamageMultiplier, SpeedMultiplier } from "../mods";
import { getEquippedCharacterSkin, grantVictoryCoins } from "../victory";

type TitleMenu = "main" | "start" | "mod";

export class TitleScene extends Phaser.Scene {
  private activeMenu: TitleMenu = "main";
  private proposalRockClicks = 0;
  private lastProposalRockClickAt = 0;
  private modNotice = "";

  constructor() {
    super("TitleScene");
  }

  create() {
    this.activeMenu = "main";
    rerenderOnResize(this, () => this.render());
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

    const proposalRock = this.add.image(245, 390, "fighter-proposal-rock").setDisplaySize(355, 265).setAngle(-8);
    proposalRock.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.handleProposalRockClick());
    drawCharacterSkinOverlay(this, getEquippedCharacterSkin("proposal-rock"), "proposal-rock", 245, 390, 355)?.setAngle(-8);
    this.add.image(width - 240, 382, "fighter-chelan").setDisplaySize(370, 222).setAngle(8);
    this.add.text(width / 2, 286, this.getMenuHeading(), {
      fontFamily: "system-ui, sans-serif",
      fontSize: "25px",
      color: "#f7f2e6",
      fontStyle: "900",
      backgroundColor: "rgba(16, 24, 32, 0.78)",
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5);

    if (this.activeMenu === "main") {
      this.addButton(width / 2 - 300, 430, "Start Game", () => this.showStartMenu(), 260, 88, -4);
      this.addButton(width / 2, 430, "View Characters", () => this.scene.start("CharacterViewerScene"), 290, 88, 0);
      this.addButton(width / 2 + 300, 430, "Store", () => this.scene.start("VictoryStoreScene"), 270, 88, 4);
    } else if (this.activeMenu === "start") {
      this.addButton(width / 2 - 290, 430, "Campaign", () => this.scene.start("CampaignSelectScene"), 255, 88, -5);
      this.addButton(width / 2, 430, "Single Battle", () => this.startMode("ai"), 285, 88, 0);
      this.addButton(width / 2 + 290, 430, "Online Battle", () => this.scene.start("OnlineScene"), 285, 88, 5);
      this.addButton(width / 2, 535, "Back", () => this.showMainMenu(), 170, 62, 0);
    } else {
      this.renderModMenu(width);
    }

    this.add
      .text(width / 2, height - 34, "P1: WASD or solo arrows + F/G/H    Local P2: Arrows + J/K/L    Online rooms work across web devices", {
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

  private showModMenu() {
    this.activeMenu = "mod";
    this.modNotice = "";
    this.render();
  }

  private getMenuHeading() {
    if (this.activeMenu === "mod") return "MOD MENU";
    if (this.activeMenu === "start") return "START GAME";
    return "MAIN MENU";
  }

  private handleProposalRockClick() {
    const now = this.time.now;
    this.proposalRockClicks = now - this.lastProposalRockClickAt <= 820 ? this.proposalRockClicks + 1 : 1;
    this.lastProposalRockClickAt = now;
    if (this.proposalRockClicks >= 3) {
      this.proposalRockClicks = 0;
      this.showModMenu();
    }
  }

  private renderModMenu(width: number) {
    const settings = getModSettings();
    const damageMultipliers: DamageMultiplier[] = [2, 3, 5, 10, 25];
    const speedMultipliers: SpeedMultiplier[] = [1.5, 2, 3, 5];
    const modButtons = [
      {
        label: "500 Coins",
        onClick: () => {
          const progress = grantVictoryCoins(500);
          this.modNotice = `Added 500 coins. Balance ${progress.coins}`;
        },
      },
      {
        label: settings.rainbowFireworkMode ? "Rainbow Firework: ON" : "Rainbow Firework",
        onClick: () => {
          const next = setRainbowFireworkMode(!getModSettings().rainbowFireworkMode);
          this.modNotice = next.rainbowFireworkMode ? "Rainbow firework mode enabled" : "Rainbow firework mode disabled";
        },
      },
      {
        label: settings.scaryMode ? "Scary Mode: ON" : "Scary Mode",
        onClick: () => {
          const next = setScaryMode(!getModSettings().scaryMode);
          this.modNotice = next.scaryMode ? "Scary mode enabled" : "Scary mode disabled";
        },
      },
      {
        label: settings.infiniteHealth ? "Infinite Health: ON" : "Infinite Health",
        onClick: () => {
          const next = setInfiniteHealth(!getModSettings().infiniteHealth);
          this.modNotice = next.infiniteHealth ? "Infinite health enabled" : "Infinite health disabled";
        },
      },
      ...damageMultipliers.map((multiplier) => ({
        label: settings.damageMultiplier === multiplier ? `${multiplier}x Damage: ON` : `${multiplier}x Damage`,
        onClick: () => {
          setDamageMultiplier(multiplier);
          this.modNotice = `${multiplier}x damage enabled`;
        },
      })),
      ...speedMultipliers.map((multiplier) => ({
        label: settings.speedMultiplier === multiplier ? `${multiplier}x Speed: ON` : `${multiplier}x Speed`,
        onClick: () => {
          setSpeedMultiplier(multiplier);
          this.modNotice = `${multiplier}x speed enabled`;
        },
      })),
    ];

    modButtons.forEach((buttonConfig, index) => {
      const columns = 4;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = width / 2 + (col - 1.5) * 250;
      const y = 356 + row * 72;
      this.addButton(x, y, buttonConfig.label, () => {
        buttonConfig.onClick();
        this.render();
      }, 230, 56, col === 0 ? -2 : col === columns - 1 ? 2 : 0, 20);
    });

    this.addButton(width / 2, 654, "Back", () => this.showMainMenu(), 170, 56, 0, 28);
    if (this.modNotice) {
      this.add
        .text(width / 2, 324, this.modNotice, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          color: "#fff7e6",
          fontStyle: "900",
          backgroundColor: "rgba(16, 24, 32, 0.78)",
          padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5);
    }
  }

  private addButton(x: number, y: number, label: string, onClick: () => void, buttonWidth = 285, buttonHeight = 92, angle = 0, fontSize = 32) {
    const button = this.add
      .rectangle(x, y, buttonWidth, buttonHeight, 0xf7f2e6, 1)
      .setStrokeStyle(6, 0x101820)
      .setAngle(angle)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: `${fontSize}px`,
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
