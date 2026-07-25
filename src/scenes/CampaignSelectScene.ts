import Phaser from "phaser";
import { campaignLevels, getCampaignProgress, isCampaignLevelUnlocked } from "../campaign";
import { fighters, getFighter } from "../fighters";
import { getLevel } from "../levels";
import type { MatchSelection } from "../types";

export class CampaignSelectScene extends Phaser.Scene {
  private selectedFighterIndex = 0;

  constructor() {
    super("CampaignSelectScene");
  }

  create() {
    this.render();
  }

  private render() {
    this.children.removeAll();
    const { width, height } = this.scale;
    const progress = getCampaignProgress();
    this.selectedFighterIndex = this.getAvailableFighterIndex(this.selectedFighterIndex);

    this.add.image(width / 2, height / 2, "beach2").setDisplaySize(width, height).setAlpha(0.72);
    this.add.rectangle(width / 2, height / 2, width, height, 0x071210, 0.36);
    this.add.rectangle(width / 2, 70, width + 80, 116, 0x101820, 0.82).setAngle(-1.5).setStrokeStyle(4, 0xe8c66b, 0.72);

    this.add
      .text(width / 2, 54, "CAMPAIGN MAP", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "50px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 100, "Win battles to unlock fighters and new stops along the coast", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#dbe9df",
        fontStyle: "800",
      })
      .setOrigin(0.5);

    this.drawMapBase();
    campaignLevels.forEach((level, index) => {
      const unlocked = isCampaignLevelUnlocked(level.id);
      const completed = progress.completedLevelIds.includes(level.id);
      const nextLevel = index < campaignLevels.length - 1 ? campaignLevels[index + 1] : undefined;
      if (nextLevel) this.drawPath(level.mapX, level.mapY, nextLevel.mapX, nextLevel.mapY, completed);
    });
    campaignLevels.forEach((level, index) => {
      this.addCampaignNode(index);
    });

    this.addPlayerPicker(width - 166, 188);
    this.addButton(98, 58, "Back", () => this.scene.start("TitleScene"), 140, 56, 20);

    const unlockedNames = progress.unlockedFighterIds.map((id) => getFighter(id).displayName).join("  /  ");
    this.add
      .text(width / 2, height - 38, `Unlocked fighters: ${unlockedNames}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "19px",
        color: "#fff7e6",
        fontStyle: "900",
        backgroundColor: "rgba(16, 24, 32, 0.76)",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5);
  }

  private addPlayerPicker(x: number, y: number) {
    const fighter = fighters[this.selectedFighterIndex];
    this.add.rectangle(x, y, 238, 150, 0x101820, 0.9).setStrokeStyle(4, 0xf7f2e6, 0.84).setDepth(18);
    this.add
      .text(x, y - 58, "PLAYER", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "25px",
        color: "#f3d86f",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(19);
    this.add.image(x, y - 6, fighter.spriteKey).setDisplaySize(this.getPreviewWidth(fighter.id), this.getPreviewHeight(fighter.id)).setDepth(19);
    this.add
      .text(x, y + 54, fighter.displayName, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#fff7e6",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(19);
    this.addSmallButton(x - 92, y + 4, "<", () => this.changePlayer(-1));
    this.addSmallButton(x + 92, y + 4, ">", () => this.changePlayer(1));
  }

  private drawMapBase() {
    const mapX = 134;
    const mapY = 156;
    const mapWidth = 1012;
    const mapHeight = 426;
    const radius = 22;

    if (this.textures.exists("campaign-map")) {
      const image = this.add.image(mapX + mapWidth / 2, mapY + mapHeight / 2, "campaign-map").setDepth(1);
      const source = this.textures.get("campaign-map").getSourceImage() as { width: number; height: number };
      const targetRatio = mapWidth / mapHeight;
      const sourceRatio = source.width / source.height;
      let cropX = 0;
      let cropY = 0;
      let cropWidth = source.width;
      let cropHeight = source.height;

      if (sourceRatio > targetRatio) {
        cropWidth = source.height * targetRatio;
        cropX = (source.width - cropWidth) / 2;
      } else {
        cropHeight = source.width / targetRatio;
        cropY = (source.height - cropHeight) / 2;
      }

      image.setCrop(cropX, cropY, cropWidth, cropHeight).setDisplaySize(mapWidth, mapHeight);

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
    graphics.moveTo(160, 480);
    graphics.lineTo(302, 398);
    graphics.lineTo(446, 424);
    graphics.lineTo(618, 338);
    graphics.lineTo(808, 374);
    graphics.lineTo(1014, 244);
    graphics.lineTo(1126, 224);
    graphics.lineTo(1126, 560);
    graphics.lineTo(160, 560);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(4, 0x1976d2, 0.42);
    for (let x = 188; x < 1120; x += 72) {
      graphics.lineBetween(x, 190, x - 68, 548);
    }
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

    const container = this.add.container(level.mapX, level.mapY).setDepth(10);
    const glow = this.add.circle(0, 0, 50, accent, unlocked ? 0.28 : 0.08);
    const button = this.add
      .circle(0, 0, 34, unlocked ? 0xf7f2e6 : 0x7b827e, 1)
      .setStrokeStyle(6, unlocked ? 0x101820 : 0x3c4641);
    const number = this.add
      .text(0, -1, completed ? "DONE" : unlocked ? String(index + 1) : "LOCK", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: unlocked && !completed ? "28px" : "19px",
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
    const opponentLabel = this.add
      .text(0, 91, `vs ${opponent.displayName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#f7f2e6",
        fontStyle: "900",
        backgroundColor: "rgba(16, 24, 32, 0.74)",
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5);

    container.add([glow, button, number, label, opponentLabel]);
    if (unlocked) {
      button.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.startCampaignBattle(level.id));
      number.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.startCampaignBattle(level.id));
      button.on("pointerover", () => button.setFillStyle(0xf3d98c));
      button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    }
  }

  private startCampaignBattle(campaignLevelId: string) {
    const level = campaignLevels.find((candidate) => candidate.id === campaignLevelId);
    if (!level || !isCampaignLevelUnlocked(level.id)) return;

    const selection: MatchSelection = {
      mode: "campaign",
      playerOneId: fighters[this.selectedFighterIndex].id,
      playerTwoId: level.opponentId,
      levelId: level.levelId,
      campaignLevelId: level.id,
    };
    this.scene.start("FightScene", selection);
  }

  private changePlayer(delta: number) {
    const progress = getCampaignProgress();
    let nextIndex = this.selectedFighterIndex;
    for (let step = 0; step < fighters.length; step += 1) {
      nextIndex = (nextIndex + delta + fighters.length) % fighters.length;
      if (progress.unlockedFighterIds.includes(fighters[nextIndex].id)) {
        this.selectedFighterIndex = nextIndex;
        this.render();
        return;
      }
    }
  }

  private getAvailableFighterIndex(preferredIndex: number) {
    const progress = getCampaignProgress();
    if (progress.unlockedFighterIds.includes(fighters[preferredIndex]?.id)) return preferredIndex;
    const fallback = fighters.findIndex((fighter) => progress.unlockedFighterIds.includes(fighter.id));
    return Math.max(0, fallback);
  }

  private getPreviewWidth(id: string) {
    if (id === "proposal-rock") return 120;
    if (id === "chelan") return 126;
    if (id === "ocean") return 124;
    return 82;
  }

  private getPreviewHeight(id: string) {
    if (id === "proposal-rock") return 90;
    if (id === "chelan") return 76;
    if (id === "ocean") return 82;
    return 102;
  }

  private addSmallButton(x: number, y: number, label: string, onClick: () => void) {
    this.addButton(x, y, label, onClick, 38, 42, 22);
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
