import Phaser from "phaser";
import { campaignLevels, completeCampaignLevel, getCampaignProgress } from "../campaign";
import { getFighter } from "../fighters";
import { getLevel } from "../levels";
import { drawCharacterSkinOverlay } from "../skins";
import type { FighterConfig } from "../types";
import type { MatchResult } from "../types";
import {
  awardVictoryCoins,
  calculateVictoryReward,
  getEquippedCharacterSkin,
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
      this.addButton(width / 2, 674, "Store", () => this.scene.start("VictoryStoreScene"));
      this.addButton(width / 2 + 280, 674, "Title", () => this.scene.start("TitleScene"));
      return;
    }

    this.addButton(width / 2 - 280, 674, "Rematch", () => this.scene.start("CharacterSelectScene", { mode: this.result?.mode ?? "ai" }));
    this.addButton(width / 2, 674, "Store", () => this.scene.start("VictoryStoreScene"));
    this.addButton(width / 2 + 280, 674, "Title", () => this.scene.start("TitleScene"));
  }

  private playVictoryAnimation(animation: VictoryAnimationConfig, winner: FighterConfig, custom: CustomVictorySettings) {
    const { width, height } = this.scale;
    const accent = animation.id === "custom-sign" ? custom.color : animation.accent;
    const previewWidth = this.getPreviewWidth(winner.id);
    const sprite = this.add.image(width / 2, 500, winner.spriteKey).setDisplaySize(previewWidth, this.getPreviewHeight(winner.id)).setDepth(14);
    const skinOverlay = drawCharacterSkinOverlay(this, getEquippedCharacterSkin(winner.id), winner.id, width / 2, 500, previewWidth, 15);
    const fighterVisuals = skinOverlay ? [sprite, skinOverlay] : [sprite];
    const shadow = this.add.ellipse(width / 2, 612, 300, 46, 0x071210, 0.36).setDepth(12);

    if (animation.id === "jump-celebration") {
      this.tweens.add({ targets: fighterVisuals, y: "-=82", duration: 360, yoyo: true, repeat: -1, ease: "Quad.Out" });
      this.tweens.add({ targets: shadow, scaleX: 0.62, alpha: 0.18, duration: 360, yoyo: true, repeat: -1, ease: "Quad.Out" });
      this.createLandingPops(width / 2, 614, accent);
      return;
    }

    if (animation.id === "spin-celebration") {
      this.createChargeRing(width / 2, 500, accent);
      this.tweens.add({ targets: fighterVisuals, rotation: Math.PI * 2, x: "+=86", duration: 820, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: fighterVisuals, scaleX: "*=1.08", scaleY: "*=0.92", duration: 410, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      return;
    }

    if (animation.id.startsWith("aura-")) {
      this.createPowerAura(width / 2, 506, accent);
      this.tweens.add({ targets: fighterVisuals, y: "-=14", duration: 120, yoyo: true, repeat: -1, ease: "Stepped" });
      this.cameras.main.shake(520, 0.0025);
      return;
    }

    if (animation.id === "coin-burst") {
      this.createCoinBurst(width / 2, 472);
      this.tweens.add({ targets: fighterVisuals, y: "-=22", duration: 640, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      return;
    }

    if (animation.id === "bonfire") {
      this.createBonfire(width / 2, 622);
      this.tweens.add({ targets: fighterVisuals, y: "-=20", duration: 760, yoyo: true, repeat: -1, ease: "Sine.InOut" });
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
    this.tweens.add({ targets: fighterVisuals, y: "-=20", duration: 760, yoyo: true, repeat: -1, ease: "Sine.InOut" });
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
    const coreColor = this.mixAuraColor(color, 0xffffff, 0.5);
    const shadowColor = this.mixAuraColor(color, 0x101820, 0.28);
    const floorY = y + 116;
    const groundGlow = this.add.ellipse(x, floorY, 360, 54, color, 0.2).setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
    const hotCore = this.add.ellipse(x, floorY - 70, 188, 276, coreColor, 0.13).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
    const innerHeat = this.add.ellipse(x, floorY - 84, 92, 226, 0xffffff, 0.08).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({ targets: groundGlow, scaleX: 1.18, scaleY: 0.74, alpha: 0.09, duration: 180, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: hotCore, scaleX: 1.08, scaleY: 1.16, alpha: 0.05, duration: 96, yoyo: true, repeat: -1, ease: "Stepped" });
    this.tweens.add({ targets: innerHeat, scaleX: 1.26, scaleY: 1.08, alpha: 0.02, duration: 130, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    for (let index = 0; index < 4; index += 1) {
      const ring = this.add.ellipse(x, floorY - index * 18, 210 + index * 58, 34 + index * 10, color, 0.02).setStrokeStyle(3, coreColor, 0.28).setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ring,
        scaleX: 1.7,
        scaleY: 1.34,
        y: ring.y - 18,
        alpha: 0,
        duration: 620 + index * 120,
        repeat: -1,
        delay: index * 150,
        ease: "Quad.Out",
        onRepeat: () => ring.setPosition(x, floorY - index * 18).setScale(1).setAlpha(0.34),
      });
    }

    for (let index = 0; index < 12; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const layerColor = index % 3 === 0 ? coreColor : index % 3 === 1 ? color : shadowColor;
      this.createAuraFlameWisp(x, floorY, layerColor, {
        side,
        offset: Phaser.Math.Between(14, 92),
        height: Phaser.Math.Between(218, 352),
        width: Phaser.Math.Between(38, 86),
        delay: index * 58,
        duration: Phaser.Math.Between(560, 920),
        alpha: index % 3 === 0 ? 0.42 : 0.26,
        depth: index % 3 === 0 ? 13 : 11,
      });
    }

    for (let index = 0; index < 7; index += 1) {
      this.createAuraLightning(x, floorY, index % 2 === 0 ? coreColor : 0xffffff, index * 84);
    }

    for (let index = 0; index < 42; index += 1) {
      this.createAuraEmber(x, floorY, index % 5 === 0 ? 0xffffff : coreColor, index * 24);
    }
  }

  private createAuraFlameWisp(
    x: number,
    floorY: number,
    color: number,
    config: { side: 1 | -1; offset: number; height: number; width: number; delay: number; duration: number; alpha: number; depth: number },
  ) {
    const flame = this.add.graphics().setDepth(config.depth).setBlendMode(Phaser.BlendModes.ADD);
    const state = { progress: 0 };
    const draw = () => {
      const wave = Math.sin(state.progress * Math.PI * 2);
      const snap = Math.sin(state.progress * Math.PI * 8) * 0.16;
      const baseX = x + config.side * (config.offset + wave * 18);
      const tipX = x + config.side * (config.offset * 0.35 + Math.sin(state.progress * Math.PI * 5) * 40);
      const topY = floorY - config.height * (0.86 + state.progress * 0.24);
      const waistY = floorY - config.height * 0.48;
      const width = config.width * (1 - state.progress * 0.28);
      const alpha = config.alpha * (0.58 + Math.abs(wave) * 0.42) * (1 - state.progress * 0.42);
      const curvePoint = (startX: number, startY: number, controlX: number, controlY: number, endX: number, endY: number, ratio: number) => {
        const inverse = 1 - ratio;
        return {
          x: inverse * inverse * startX + 2 * inverse * ratio * controlX + ratio * ratio * endX,
          y: inverse * inverse * startY + 2 * inverse * ratio * controlY + ratio * ratio * endY,
        };
      };

      flame.clear();
      flame.fillStyle(color, alpha);
      flame.beginPath();
      const leftBaseX = baseX - config.side * width * 0.62;
      const rightBaseX = baseX + config.side * width * 0.46;
      flame.moveTo(leftBaseX, floorY + 4);
      for (let step = 1; step <= 8; step += 1) {
        const point = curvePoint(leftBaseX, floorY + 4, baseX - config.side * width * (1.12 + snap), waistY, tipX, topY, step / 8);
        flame.lineTo(point.x, point.y);
      }
      for (let step = 1; step <= 8; step += 1) {
        const point = curvePoint(tipX, topY, baseX + config.side * width * (0.78 - snap), waistY + 28, rightBaseX, floorY + 4, step / 8);
        flame.lineTo(point.x, point.y);
      }
      flame.closePath();
      flame.fillPath();

      flame.lineStyle(2, this.mixAuraColor(color, 0xffffff, 0.62), alpha * 0.92);
      flame.beginPath();
      flame.moveTo(baseX, floorY - 10);
      for (let step = 1; step <= 7; step += 1) {
        const point = curvePoint(baseX, floorY - 10, baseX + config.side * width * 0.38, waistY + wave * 18, tipX, topY + 12, step / 7);
        flame.lineTo(point.x, point.y);
      }
      flame.strokePath();
    };

    draw();
    this.tweens.add({
      targets: state,
      progress: 1,
      duration: config.duration,
      repeat: -1,
      delay: config.delay,
      ease: "Sine.InOut",
      onUpdate: draw,
      onRepeat: () => {
        config.offset = Phaser.Math.Between(12, 98);
        config.height = Phaser.Math.Between(220, 370);
      },
    });
  }

  private createAuraLightning(x: number, floorY: number, color: number, delay: number) {
    const bolt = this.add.graphics().setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
    const redraw = () => {
      const side = Phaser.Math.RND.pick([-1, 1]);
      const startX = x + side * Phaser.Math.Between(42, 128);
      let cursorX = startX;
      let cursorY = floorY - Phaser.Math.Between(18, 70);
      bolt.clear();
      bolt.lineStyle(Phaser.Math.Between(2, 4), color, 0.72);
      bolt.beginPath();
      bolt.moveTo(cursorX, cursorY);
      for (let step = 0; step < 5; step += 1) {
        cursorX += side * Phaser.Math.Between(-34, 24);
        cursorY -= Phaser.Math.Between(28, 58);
        bolt.lineTo(cursorX, cursorY);
      }
      bolt.strokePath();
      bolt.setAlpha(1);
    };
    this.tweens.add({
      targets: bolt,
      alpha: 0,
      duration: 110,
      repeat: -1,
      repeatDelay: Phaser.Math.Between(170, 360),
      delay,
      ease: "Quad.Out",
      onStart: redraw,
      onRepeat: redraw,
    });
  }

  private createAuraEmber(x: number, floorY: number, color: number, delay: number) {
    const ember = this.add.circle(x, floorY, Phaser.Math.Between(2, 6), color, 0.85).setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    const reset = () => {
      ember
        .setPosition(x + Phaser.Math.Between(-138, 138), floorY + Phaser.Math.Between(-8, 30))
        .setScale(Phaser.Math.FloatBetween(0.8, 1.7))
        .setAlpha(Phaser.Math.FloatBetween(0.46, 0.92));
    };
    reset();
    this.tweens.add({
      targets: ember,
      x: ember.x + Phaser.Math.Between(-60, 60),
      y: floorY - Phaser.Math.Between(170, 360),
      alpha: 0,
      scale: 0.28,
      duration: Phaser.Math.Between(560, 1180),
      repeat: -1,
      delay,
      ease: "Cubic.Out",
      onRepeat: reset,
    });
  }

  private mixAuraColor(color: number, target: number, amount: number) {
    const inverse = 1 - amount;
    const red = Math.round(((color >> 16) & 0xff) * inverse + ((target >> 16) & 0xff) * amount);
    const green = Math.round(((color >> 8) & 0xff) * inverse + ((target >> 8) & 0xff) * amount);
    const blue = Math.round((color & 0xff) * inverse + (target & 0xff) * amount);
    return (red << 16) | (green << 8) | blue;
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
