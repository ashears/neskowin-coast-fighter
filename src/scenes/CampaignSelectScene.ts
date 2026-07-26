import Phaser from "phaser";
import { STARTING_FIGHTER_ID, campaignLevels, getCampaignProgress, isCampaignLevelUnlocked } from "../campaign";
import { getFighter } from "../fighters";
import { getLevel } from "../levels";
import { getModSettings } from "../mods";
import { rerenderOnResize } from "../responsive";
import type { MatchSelection } from "../types";

export class CampaignSelectScene extends Phaser.Scene {
  private readonly sourceMapBounds = { x: 134, y: 156, width: 1012, height: 426 };
  private readonly displayMapBounds = { x: 20, y: 112, width: 1240, height: 502 };
  private rainbowFireworkEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super("CampaignSelectScene");
  }

  create() {
    this.events.once("shutdown", () => this.stopRainbowFireworks());
    rerenderOnResize(this, () => this.render());
    this.render();
  }

  private render() {
    this.children.removeAll();
    const { width, height } = this.scale;
    const progress = getCampaignProgress();

    this.add.image(width / 2, height / 2, "beach2").setDisplaySize(width, height).setAlpha(0.72);
    this.add.rectangle(width / 2, height / 2, width, height, 0x071210, 0.36);
    this.add.rectangle(width / 2, 50, width + 80, 92, 0x101820, 0.82).setAngle(-1.5).setStrokeStyle(4, 0xe8c66b, 0.72);

    this.add
      .text(width / 2, 38, "CAMPAIGN MAP", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "42px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 76, "Win battles to unlock fighters and new stops along the coast", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#dbe9df",
        fontStyle: "800",
      })
      .setOrigin(0.5);

    const modSettings = getModSettings();
    this.drawMapBase();
    if (modSettings.scaryMode) this.drawScaryMapMode();
    this.syncRainbowFireworks(modSettings.rainbowFireworkMode);
    campaignLevels.forEach((level, index) => {
      const unlocked = isCampaignLevelUnlocked(level.id);
      const completed = progress.completedLevelIds.includes(level.id);
      const nextLevel = index < campaignLevels.length - 1 ? campaignLevels[index + 1] : undefined;
      if (nextLevel) {
        this.drawPath(
          this.mapScreenX(level.mapX),
          this.mapScreenY(level.mapY),
          this.mapScreenX(nextLevel.mapX),
          this.mapScreenY(nextLevel.mapY),
          completed,
        );
      }
    });
    campaignLevels.forEach((level, index) => {
      this.addCampaignNode(index);
    });

    this.addButton(86, 48, "Back", () => this.scene.start("TitleScene"), 118, 48, 18);

    const unlockedNames = progress.unlockedFighterIds.map((id) => getFighter(id).displayName).join("  /  ");
    this.add
      .text(width / 2, height - 24, `Unlocked fighters: ${unlockedNames}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "19px",
        color: "#fff7e6",
        fontStyle: "900",
        backgroundColor: "rgba(16, 24, 32, 0.76)",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5);
  }

  private drawMapBase() {
    const { x: mapX, y: mapY, width: mapWidth, height: mapHeight } = this.getDisplayedMapBounds();
    const radius = 22;

    if (this.textures.exists("campaign-map")) {
      const image = this.add.image(mapX + mapWidth / 2, mapY + mapHeight / 2, "campaign-map").setDepth(1);
      image.setDisplaySize(mapWidth, mapHeight);

      const frame = this.add.graphics().setDepth(2);
      frame.lineStyle(8, 0x101820, 0.88);
      frame.strokeRoundedRect(mapX, mapY, mapWidth, mapHeight, radius);
      return;
    }

    const graphics = this.add.graphics().setDepth(1);
    graphics.fillStyle(0xf7f2e6, 0.9);
    graphics.fillRoundedRect(mapX, mapY, mapWidth, mapHeight, radius);
    graphics.lineStyle(8, 0x101820, 0.88);
    graphics.strokeRoundedRect(mapX, mapY, mapWidth, mapHeight, radius);

    graphics.fillStyle(0x2f8f84, 0.34);
    graphics.beginPath();
    graphics.moveTo(this.mapScreenX(160), this.mapScreenY(480));
    graphics.lineTo(this.mapScreenX(302), this.mapScreenY(398));
    graphics.lineTo(this.mapScreenX(446), this.mapScreenY(424));
    graphics.lineTo(this.mapScreenX(618), this.mapScreenY(338));
    graphics.lineTo(this.mapScreenX(808), this.mapScreenY(374));
    graphics.lineTo(this.mapScreenX(1014), this.mapScreenY(244));
    graphics.lineTo(this.mapScreenX(1126), this.mapScreenY(224));
    graphics.lineTo(this.mapScreenX(1126), this.mapScreenY(560));
    graphics.lineTo(this.mapScreenX(160), this.mapScreenY(560));
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(4, 0x1976d2, 0.42);
    for (let x = 188; x < 1120; x += 72) {
      graphics.lineBetween(this.mapScreenX(x), this.mapScreenY(190), this.mapScreenX(x - 68), this.mapScreenY(548));
    }
  }

  private drawScaryMapMode() {
    const { x, y, width, height } = this.getDisplayedMapBounds();
    const graphics = this.add.graphics().setDepth(6);
    graphics.fillStyle(0x050307, 0.58);
    graphics.fillRoundedRect(x, y, width, height, 22);
    graphics.lineStyle(6, 0x9b111e, 0.82);
    graphics.strokeRoundedRect(x + 4, y + 4, width - 8, height - 8, 18);

    for (let index = 0; index < 8; index += 1) {
      const fogY = y + 48 + index * 52;
      const fog = this.add.rectangle(x + width / 2, fogY, width * 0.88, 18, index % 2 === 0 ? 0x36111c : 0x0b0b12, 0.22).setDepth(7);
      fog.setAngle(index % 2 === 0 ? -2 : 2);
      this.tweens.add({ targets: fog, x: fog.x + (index % 2 === 0 ? 38 : -38), alpha: 0.34, duration: 1600 + index * 90, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    const eyePositions = [
      { x: x + width * 0.22, y: y + height * 0.24 },
      { x: x + width * 0.72, y: y + height * 0.34 },
      { x: x + width * 0.52, y: y + height * 0.68 },
    ];
    eyePositions.forEach((position, index) => {
      const leftEye = this.add.ellipse(position.x - 16, position.y, 20, 12, 0xff2020, 0.88).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
      const rightEye = this.add.ellipse(position.x + 16, position.y, 20, 12, 0xff2020, 0.88).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: [leftEye, rightEye], alpha: 0.18, duration: 420 + index * 120, yoyo: true, repeat: -1, ease: "Stepped" });
    });

    for (let index = 0; index < 7; index += 1) {
      const bolt = this.add.graphics().setDepth(8);
      const startX = Phaser.Math.Between(Math.floor(x + 80), Math.floor(x + width - 80));
      let cursorX = startX;
      let cursorY = y + Phaser.Math.Between(34, 92);
      bolt.lineStyle(4, index % 2 === 0 ? 0xff2020 : 0x6d1bff, 0.56);
      bolt.beginPath();
      bolt.moveTo(cursorX, cursorY);
      for (let segment = 0; segment < 5; segment += 1) {
        cursorX += Phaser.Math.Between(-34, 34);
        cursorY += Phaser.Math.Between(34, 62);
        bolt.lineTo(cursorX, cursorY);
      }
      bolt.strokePath();
      this.tweens.add({ targets: bolt, alpha: 0.08, duration: 180 + index * 30, yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(600, 1400) });
    }

    this.add
      .text(x + width / 2, y + 40, "SCARY MODE", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "38px",
        color: "#ffdddd",
        fontStyle: "900",
        stroke: "#5c0505",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(9);
  }

  private syncRainbowFireworks(enabled: boolean) {
    if (!enabled) {
      this.stopRainbowFireworks();
      return;
    }

    if (!this.rainbowFireworkEvent) {
      this.rainbowFireworkEvent = this.time.addEvent({ delay: 260, loop: true, callback: () => this.createRainbowFireworkBurst() });
    }
    for (let index = 0; index < 5; index += 1) {
      this.time.delayedCall(index * 70, () => this.createRainbowFireworkBurst());
    }
  }

  private stopRainbowFireworks() {
    this.rainbowFireworkEvent?.remove(false);
    this.rainbowFireworkEvent = undefined;
  }

  private createRainbowFireworkBurst() {
    const { x, y, width, height } = this.getDisplayedMapBounds();
    const colors = [0xff2020, 0xff8a00, 0xfff000, 0x43ff4b, 0x00d4ff, 0x2450ff, 0xb030ff];
    const originX = Phaser.Math.Between(Math.floor(x + 64), Math.floor(x + width - 64));
    const originY = Phaser.Math.Between(Math.floor(y + 48), Math.floor(y + height - 74));
    const ring = this.add.circle(originX, originY, 5, Phaser.Utils.Array.GetRandom(colors), 0.45).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 8, alpha: 0, duration: 620, ease: "Sine.Out", onComplete: () => ring.destroy() });

    colors.forEach((color, colorIndex) => {
      for (let sparkIndex = 0; sparkIndex < 3; sparkIndex += 1) {
        const angle = ((colorIndex * 3 + sparkIndex) / (colors.length * 3)) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.08, 0.08);
        const distance = Phaser.Math.Between(44, 124);
        const spark = this.add.star(originX, originY, 5, 3, Phaser.Math.Between(8, 14), color, 0.94).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: spark,
          x: originX + Math.cos(angle) * distance,
          y: originY + Math.sin(angle) * distance,
          angle: Phaser.Math.Between(-240, 240),
          alpha: 0,
          scale: 0.25,
          duration: Phaser.Math.Between(480, 820),
          ease: "Quad.Out",
          onComplete: () => spark.destroy(),
        });
      }
    });
  }

  private drawPath(fromX: number, fromY: number, toX: number, toY: number, completed: boolean) {
    const graphics = this.add.graphics().setDepth(3);
    graphics.lineStyle(10, completed ? 0xe43f2e : 0x101820, completed ? 0.82 : 0.34);
    graphics.lineBetween(fromX, fromY, toX, toY);
    graphics.lineStyle(4, 0xf7f2e6, completed ? 0.86 : 0.42);
    graphics.lineBetween(fromX, fromY, toX, toY);
  }

  private addCampaignNode(index: number) {
    const level = campaignLevels[index];
    const progress = getCampaignProgress();
    const unlocked = isCampaignLevelUnlocked(level.id);
    const completed = progress.completedLevelIds.includes(level.id);
    const opponent = getFighter(level.opponentId);
    const arena = getLevel(level.levelId);
    const accent = completed ? 0x4fb477 : unlocked ? arena.accent : 0x69706d;
    const isBossEncounter = level.levelId === "proposal-rock-boss";

    const container = this.add.container(this.mapScreenX(level.mapX), this.mapScreenY(level.mapY)).setDepth(10);
    const glow = this.add.circle(0, 0, 38, accent, unlocked ? 0.24 : 0.07);
    const button = this.add
      .circle(0, 0, 25, unlocked ? 0xf7f2e6 : 0x7b827e, 1)
      .setStrokeStyle(4, unlocked ? 0x101820 : 0x3c4641);
    const number = this.add
      .text(0, -1, completed ? "DONE" : unlocked ? String(index + 1) : "LOCK", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: unlocked && !completed ? "22px" : "14px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    const label = this.add
      .text(0, 62, level.displayName, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "23px",
        color: unlocked ? "#fff7e6" : "#cbd2cf",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const encounterLabel = this.add
      .text(0, 91, isBossEncounter ? "BOSS Encounter" : `vs ${opponent.displayName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: isBossEncounter ? "17px" : "15px",
        color: isBossEncounter ? "#101820" : "#f7f2e6",
        fontStyle: "900",
        backgroundColor: isBossEncounter ? "#f3d86f" : "rgba(16, 24, 32, 0.74)",
        padding: { x: 9, y: 4 },
      })
      .setOrigin(0.5);
    const modeLabel = isBossEncounter
      ? this.add
          .text(0, 121, "Trash Pickup Minigame", {
            fontFamily: "system-ui, sans-serif",
            fontSize: "13px",
            color: "#fff7e6",
            fontStyle: "900",
            backgroundColor: "rgba(16, 24, 32, 0.74)",
            padding: { x: 8, y: 3 },
          })
          .setOrigin(0.5)
      : undefined;

    container.add([glow, button, number, label, encounterLabel]);
    if (modeLabel) container.add(modeLabel);
    if (unlocked) {
      button.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.startCampaignBattle(level.id));
      number.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.startCampaignBattle(level.id));
      button.on("pointerover", () => button.setFillStyle(0xf3d98c));
      button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    }
  }

  private mapScreenX(sourceX: number) {
    const ratio = (sourceX - this.sourceMapBounds.x) / this.sourceMapBounds.width;
    const mapBounds = this.getDisplayedMapBounds();
    return mapBounds.x + ratio * mapBounds.width;
  }

  private mapScreenY(sourceY: number) {
    const ratio = (sourceY - this.sourceMapBounds.y) / this.sourceMapBounds.height;
    const mapBounds = this.getDisplayedMapBounds();
    return mapBounds.y + ratio * mapBounds.height;
  }

  private getDisplayedMapBounds() {
    if (!this.textures.exists("campaign-map")) return this.displayMapBounds;

    const source = this.textures.get("campaign-map").getSourceImage() as { width: number; height: number };
    const scale = Math.min(this.displayMapBounds.width / source.width, this.displayMapBounds.height / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    return {
      x: this.displayMapBounds.x + (this.displayMapBounds.width - width) / 2,
      y: this.displayMapBounds.y + (this.displayMapBounds.height - height) / 2,
      width,
      height,
    };
  }

  private startCampaignBattle(campaignLevelId: string) {
    const level = campaignLevels.find((candidate) => candidate.id === campaignLevelId);
    if (!level || !isCampaignLevelUnlocked(level.id)) return;

    const selection: MatchSelection = {
      mode: "campaign",
      playerOneId: STARTING_FIGHTER_ID,
      playerTwoId: level.opponentId,
      levelId: level.levelId,
      campaignLevelId: level.id,
    };
    this.scene.start("FightScene", selection);
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
      .setDepth(20);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: `${fontSize}px`,
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(21);
    button.on("pointerover", () => button.setFillStyle(0xf3d98c));
    button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }
}
