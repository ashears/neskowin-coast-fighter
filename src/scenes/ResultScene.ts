import Phaser from "phaser";
import { campaignLevels, completeCampaignLevel, getCampaignProgress } from "../campaign";
import { getFighter } from "../fighters";
import { getLevel } from "../levels";
import type { FighterConfig } from "../types";
import type { MatchResult } from "../types";
import {
  awardVictoryCoins,
  calculateVictoryReward,
  getEquippedVictoryAnimation,
  getVictoryProgress,
  type CustomVictorySettings,
  type VictoryAnimationConfig,
} from "../victory";

export class ResultScene extends Phaser.Scene {
  private result?: MatchResult;

  constructor() {
    super("ResultScene");
  }

  init(data: MatchResult) {
    this.result = data;
  }

  create() {
    const { width, height } = this.scale;
    const level = getLevel(this.result?.levelId ?? "neskowin");
    const campaignWon = this.result?.mode === "campaign" && this.result.campaignLevelId && this.result.winnerId === this.result.playerOneId;
    const campaignLost = this.result?.mode === "campaign" && this.result.campaignLevelId && !campaignWon;
    const unlockedFighter = campaignWon ? this.completeCampaignWin(this.result!.campaignLevelId!) : undefined;
    const reward = this.result
      ? awardVictoryCoins(
          this.result.matchKey ?? `${this.result.mode}:${this.result.levelId}:${this.result.winnerId}:${this.result.campaignLevelId ?? "none"}`,
          calculateVictoryReward(this.result.mode, Boolean(campaignWon)),
        ).amount
      : 0;
    const victoryProgress = getVictoryProgress();
    const equippedAnimation = getEquippedVictoryAnimation();
    const winner = getFighter(this.result?.winnerId ?? "proposal-rock");
    this.add.image(width / 2, height / 2, level.textureKey).setDisplaySize(width, height).setAlpha(0.62);
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b1817, 0.52);
    this.playVictoryAnimation(equippedAnimation, winner, victoryProgress.custom);

    this.add
      .text(width / 2, 160, "Winner", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#dbe9df",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 242, this.result?.winnerName ?? "The Coast", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        color: "#fff7e6",
        fontStyle: "900",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 326, reward > 0 ? `+${reward} victory coins    Balance ${victoryProgress.coins}` : `Balance ${victoryProgress.coins} coins`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#101820",
        fontStyle: "900",
        backgroundColor: "#f3d86f",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(25);

    if (campaignLost) {
      this.add
        .text(width / 2, 374, "Campaign progress needs a win", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "26px",
          color: "#dbe9df",
          fontStyle: "900",
          backgroundColor: "rgba(12, 25, 23, 0.62)",
          padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5);
    } else if (unlockedFighter) {
      this.add
        .text(width / 2, 374, `${unlockedFighter.displayName} unlocked`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "26px",
          color: "#fff7e6",
          fontStyle: "900",
          backgroundColor: "rgba(12, 25, 23, 0.62)",
          padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5)
        .setDepth(25);
    }

    if (this.result?.mode === "campaign") {
      this.addButton(width / 2 - 280, 674, campaignLost ? "Retry" : unlockedFighter ? "View Unlock" : "Map", () => {
        if (campaignLost) this.retryCampaignBattle();
        else if (unlockedFighter) {
          this.scene.start("CharacterUnlockScene", {
            fighterId: unlockedFighter.id,
            levelId: this.result?.levelId,
          });
        } else this.scene.start("CampaignSelectScene");
      });
      this.addButton(width / 2, 674, "Victory Store", () => this.scene.start("VictoryStoreScene"));
      this.addButton(width / 2 + 280, 674, "Title", () => this.scene.start("TitleScene"));
      return;
    }

    this.addButton(width / 2 - 280, 674, "Rematch", () => this.scene.start("CharacterSelectScene", { mode: this.result?.mode ?? "ai" }));
    this.addButton(width / 2, 674, "Victory Store", () => this.scene.start("VictoryStoreScene"));
    this.addButton(width / 2 + 280, 674, "Title", () => this.scene.start("TitleScene"));
  }

  private playVictoryAnimation(animation: VictoryAnimationConfig, winner: FighterConfig, custom: CustomVictorySettings) {
    const { width, height } = this.scale;
    const accent = animation.id === "custom-sign" ? custom.color : animation.accent;
    const sprite = this.add.image(width / 2, 500, winner.spriteKey).setDisplaySize(this.getPreviewWidth(winner.id), this.getPreviewHeight(winner.id)).setDepth(14);
    const shadow = this.add.ellipse(width / 2, 612, 300, 46, 0x071210, 0.36).setDepth(12);

    if (animation.id === "jump-celebration") {
      this.tweens.add({ targets: sprite, y: 418, duration: 360, yoyo: true, repeat: -1, ease: "Quad.Out" });
      this.tweens.add({ targets: shadow, scaleX: 0.62, alpha: 0.18, duration: 360, yoyo: true, repeat: -1, ease: "Quad.Out" });
      this.createLandingPops(width / 2, 614, accent);
      return;
    }

    if (animation.id === "spin-celebration") {
      this.createChargeRing(width / 2, 500, accent);
      this.tweens.add({ targets: sprite, rotation: Math.PI * 2, x: width / 2 + 86, duration: 820, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: sprite, scaleX: sprite.scaleX * 1.08, scaleY: sprite.scaleY * 0.92, duration: 410, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      return;
    }

    if (animation.id.startsWith("aura-")) {
      this.createPowerAura(width / 2, 506, accent);
      this.tweens.add({ targets: sprite, y: 486, duration: 120, yoyo: true, repeat: -1, ease: "Stepped" });
      this.cameras.main.shake(520, 0.0025);
      return;
    }

    if (animation.id === "coin-burst") {
      this.createCoinBurst(width / 2, 472);
      this.tweens.add({ targets: sprite, y: 478, duration: 640, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      return;
    }

    if (animation.id === "bonfire") {
      this.createBonfire(width / 2, 622);
      this.tweens.add({ targets: sprite, y: 480, duration: 760, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      return;
    }

    if (animation.id === "custom-sign") {
      this.createCustomPattern(width / 2, 486, custom);
      this.add
        .text(width / 2, 606, custom.message.toUpperCase(), {
          fontFamily: "Impact, system-ui, sans-serif",
          fontSize: "32px",
          color: "#fff7e6",
          fontStyle: "900",
          stroke: "#101820",
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setDepth(20);
      return;
    }

    this.createClassicRays(width / 2, 500, accent);
    this.tweens.add({ targets: sprite, y: 480, duration: 760, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private createClassicRays(x: number, y: number, color: number) {
    const rays = this.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      rays.lineStyle(5, color, 0.26);
      rays.lineBetween(x, y, x + Math.cos(angle) * 280, y + Math.sin(angle) * 180);
    }
    this.tweens.add({ targets: rays, rotation: Math.PI * 2, duration: 12000, repeat: -1, ease: "Linear" });
  }

  private createPowerAura(x: number, y: number, color: number) {
    for (let index = 0; index < 5; index += 1) {
      const aura = this.add.ellipse(x, y + 20, 190 + index * 32, 260 + index * 34, color, 0.07).setStrokeStyle(4, color, 0.34).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: aura, scaleX: 1.14, scaleY: 1.08, alpha: 0.02, duration: 520 + index * 90, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    for (let index = 0; index < 28; index += 1) {
      const spark = this.add.rectangle(Phaser.Math.Between(x - 120, x + 120), Phaser.Math.Between(y - 100, y + 120), 7, 22, color, 0.9).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        y: spark.y - Phaser.Math.Between(120, 230),
        alpha: 0,
        duration: Phaser.Math.Between(520, 980),
        repeat: -1,
        delay: Phaser.Math.Between(0, 420),
        ease: "Quad.Out",
        onRepeat: () => spark.setPosition(Phaser.Math.Between(x - 120, x + 120), Phaser.Math.Between(y + 60, y + 130)).setAlpha(0.9),
      });
    }
  }

  private createChargeRing(x: number, y: number, color: number) {
    const ring = this.add.ellipse(x, y, 270, 270, color, 0.08).setStrokeStyle(7, color, 0.55).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scaleX: 0.72, scaleY: 0.72, alpha: 0.22, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private createLandingPops(x: number, y: number, color: number) {
    for (let index = 0; index < 10; index += 1) {
      const pop = this.add.circle(x, y, 6, color, 0).setDepth(13);
      this.tweens.add({
        targets: pop,
        x: x + (index - 4.5) * 28,
        y: y - Phaser.Math.Between(20, 64),
        alpha: 0.82,
        scale: 1.4,
        duration: 360,
        yoyo: true,
        repeat: -1,
        delay: index * 45,
      });
    }
  }

  private createCoinBurst(x: number, y: number) {
    for (let index = 0; index < 34; index += 1) {
      const coin = this.add.circle(x, y, 10, 0xffb84d, 0.92).setStrokeStyle(2, 0x101820).setDepth(18);
      const angle = (Math.PI * 2 * index) / 34;
      this.tweens.add({
        targets: coin,
        x: x + Math.cos(angle) * Phaser.Math.Between(120, 390),
        y: y + Math.sin(angle) * Phaser.Math.Between(70, 230),
        alpha: 0,
        duration: Phaser.Math.Between(850, 1450),
        repeat: -1,
        delay: Phaser.Math.Between(0, 360),
        ease: "Quad.Out",
        onRepeat: () => coin.setPosition(x, y).setAlpha(0.92),
      });
    }
  }

  private createBonfire(x: number, y: number) {
    this.add.ellipse(x, y, 230, 42, 0x101820, 0.48).setDepth(13);
    for (let index = 0; index < 18; index += 1) {
      const flame = this.add.triangle(x + Phaser.Math.Between(-72, 72), y - 20, 0, 38, 18, -24, 36, 38, Phaser.Utils.Array.GetRandom([0xe43f2e, 0xffb84d, 0xf3d86f]), 0.82).setDepth(14);
      this.tweens.add({ targets: flame, y: y - Phaser.Math.Between(70, 145), alpha: 0.1, scaleY: 1.5, duration: Phaser.Math.Between(520, 900), repeat: -1, delay: index * 35, ease: "Sine.Out" });
    }
  }

  private createCustomPattern(x: number, y: number, custom: CustomVictorySettings) {
    if (custom.pattern === "sparks") {
      this.createCoinBurst(x, y);
      return;
    }
    if (custom.pattern === "waves") {
      for (let index = 0; index < 5; index += 1) {
        const wave = this.add.ellipse(x, y + 78, 180 + index * 60, 34 + index * 8, custom.color, 0.08).setStrokeStyle(4, custom.color, 0.34).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: wave, scaleX: 1.2, alpha: 0.02, duration: 700 + index * 100, yoyo: true, repeat: -1 });
      }
      return;
    }
    this.createClassicRays(x, y, custom.color);
  }

  private completeCampaignWin(campaignLevelId: string): FighterConfig | undefined {
    const priorProgress = getCampaignProgress();
    completeCampaignLevel(campaignLevelId);
    const level = campaignLevels.find((candidate) => candidate.id === campaignLevelId);
    if (!level?.unlockFighterId || priorProgress.unlockedFighterIds.includes(level.unlockFighterId)) return undefined;
    return getFighter(level.unlockFighterId);
  }

  private retryCampaignBattle() {
    const campaignLevel = campaignLevels.find((candidate) => candidate.id === this.result?.campaignLevelId);
    if (!campaignLevel) {
      this.scene.start("CampaignSelectScene");
      return;
    }

    this.scene.start("FightScene", {
      mode: "campaign",
      playerOneId: this.result?.playerOneId ?? "proposal-rock",
      playerTwoId: campaignLevel.opponentId,
      levelId: campaignLevel.levelId,
      campaignLevelId: campaignLevel.id,
    });
  }

  private getPreviewWidth(id: string) {
    if (id === "proposal-rock") return 250;
    if (id === "chelan") return 280;
    if (id === "ocean") return 270;
    if (id === "duck-flag") return 170;
    return 190;
  }

  private getPreviewHeight(id: string) {
    if (id === "proposal-rock") return 187;
    if (id === "chelan") return 168;
    if (id === "ocean") return 178;
    if (id === "duck-flag") return 228;
    return 228;
  }

  private addButton(x: number, y: number, label: string, onClick: () => void) {
    const button = this.add
      .rectangle(x, y, 235, 76, 0xe8c66b, 1)
      .setStrokeStyle(3, 0x152926)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "25px",
        color: "#152926",
        fontStyle: "800",
      })
      .setOrigin(0.5);
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }
}
