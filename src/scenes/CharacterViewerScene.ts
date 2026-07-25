import Phaser from "phaser";
import { campaignLevels, isFighterUnlocked, STARTING_FIGHTER_ID } from "../campaign";
import { fighters } from "../fighters";
import { rerenderOnResize } from "../responsive";
import type { AttackConfig, AttackKind, FighterConfig } from "../types";

interface CharacterViewerData {
  fighterId?: string;
  returnScene?: string;
  fromUnlock?: boolean;
}

const attackLabels: Record<AttackKind, string> = {
  light: "Light Attack",
  heavy: "Heavy Attack",
  special: "Special",
};

export class CharacterViewerScene extends Phaser.Scene {
  private selectedIndex = 0;
  private returnScene = "TitleScene";
  private fromUnlock = false;

  constructor() {
    super("CharacterViewerScene");
  }

  init(data: CharacterViewerData) {
    this.returnScene = data.returnScene ?? "TitleScene";
    this.fromUnlock = data.fromUnlock ?? false;
    this.selectedIndex = this.getVisibleIndex(data.fighterId ?? STARTING_FIGHTER_ID);
  }

  create() {
    rerenderOnResize(this, () => this.render());
    this.render();
  }

  private render() {
    this.children.removeAll();
    const { width, height } = this.scale;
    const fighter = fighters[this.selectedIndex];
    const unlocked = isFighterUnlocked(fighter.id);

    this.add.image(width / 2, height / 2, "beach4").setDisplaySize(width, height).setAlpha(0.62);
    this.add.rectangle(width / 2, height / 2, width, height, 0x071210, 0.58);
    this.add.rectangle(width / 2, 49, width + 110, 98, 0x101820, 0.9).setAngle(-1.5).setStrokeStyle(4, this.getRarityColor(fighter), 0.82);
    this.add.rectangle(320, 394, 542, 590, 0x0f1b20, 0.9).setStrokeStyle(3, 0xd7b95d, 0.64);
    this.add.rectangle(876, 392, 670, 592, 0xf7f2e6, 0.96).setStrokeStyle(4, 0x101820, 0.9);

    this.add
      .text(width / 2, 46, this.fromUnlock ? "CHARACTER UNLOCKED" : "Characters", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "46px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    this.addRoster(88, 142);
    this.addHeroPortrait(fighter, unlocked);
    this.addIdentityPanel(fighter, unlocked);
    this.addAbilities(fighter);
    this.addCoreStats(fighter);
    this.addButton(90, 48, "Back", () => this.scene.start(this.returnScene), 120, 48, 18);
    this.addSmallArrow(174, 438, "<", () => this.changeSelection(-1));
    this.addSmallArrow(520, 438, ">", () => this.changeSelection(1));
  }

  private addHeroPortrait(fighter: FighterConfig, unlocked: boolean) {
    const rarityColor = this.getRarityColor(fighter);
    this.add.rectangle(352, 202, 342, 196, rarityColor, 0.28).setStrokeStyle(2, rarityColor, 0.74);
    const spotlight = this.add.ellipse(352, 434, 312, 72, rarityColor, 0.24).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: spotlight, scaleX: 1.05, alpha: 0.42, duration: 920, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.add.image(352, 350, fighter.spriteKey).setDisplaySize(this.getPreviewWidth(fighter.id), this.getPreviewHeight(fighter.id)).setAlpha(unlocked ? 1 : 0.28);
    if (!unlocked) {
      this.add.rectangle(352, 350, 342, 374, 0x050808, 0.48);
      this.add.text(352, 350, "LOCKED", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "54px",
        color: "#f3d86f",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 8,
      }).setOrigin(0.5);
    }
  }

  private addIdentityPanel(fighter: FighterConfig, unlocked: boolean) {
    const rarityColor = this.getRarityColor(fighter);
    this.add.text(628, 132, fighter.displayName.toUpperCase(), {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "52px",
      color: "#101820",
      fontStyle: "900",
    });
    this.add.text(630, 187, fighter.title, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "21px",
      color: "#27323a",
      fontStyle: "900",
    });
    this.addBadge(636, 234, fighter.rarity, rarityColor);
    this.addBadge(786, 234, fighter.role, 0x1976d2);
    this.add.text(630, 276, fighter.bio, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      color: "#101820",
      fontStyle: "700",
      wordWrap: { width: 560 },
      lineSpacing: 5,
    });
    this.add.text(630, 360, fighter.passiveName.toUpperCase(), {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "25px",
      color: "#101820",
      fontStyle: "900",
    });
    this.add.text(630, 393, fighter.passiveDescription, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "15px",
      color: "#2f3c39",
      fontStyle: "800",
      wordWrap: { width: 548 },
      lineSpacing: 2,
    });
    this.addTraitColumn(120, 518, "STRENGTHS", fighter.strengths, 0x4fb477);
    this.addTraitColumn(342, 518, "WATCH OUT", fighter.weaknesses, 0xe43f2e);
  }

  private addCoreStats(fighter: FighterConfig) {
    this.add.text(630, 594, "COMBAT STATS", {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "24px",
      color: "#101820",
      fontStyle: "900",
    });
    this.addStatPill(630, 632, "Health", fighter.maxHealth, 160, 0xe43f2e);
    this.addStatPill(822, 632, "Shield", fighter.maxShield, 90, 0x1976d2);
    this.addStatPill(1014, 632, "Recharge", fighter.shieldRechargePerSecond, 28, 0x4fb477);
    this.addStatPill(630, 678, "Speed", fighter.speed, 300, 0xf3d86f);
    this.addStatPill(822, 678, "Defense", Math.round((1 - fighter.defense) * 100), 25, 0xffb84d, `${Math.round((1 - fighter.defense) * 100)}%`);
    this.addStatPill(1014, 678, "Range", Math.max(...Object.values(fighter.attacks).map((attack) => attack.range)), 540, 0x98d8a8);
  }

  private addAbilities(fighter: FighterConfig) {
    this.add.text(630, 432, "ABILITIES", {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "24px",
      color: "#101820",
      fontStyle: "900",
    });
    (Object.entries(fighter.attacks) as [AttackKind, AttackConfig][]).forEach(([kind, attack], index) => {
      this.addAbilityRow(630, 480 + index * 39, kind, attack);
    });
  }

  private addAbilityRow(x: number, y: number, kind: AttackKind, attack: AttackConfig) {
    const accent = kind === "light" ? 0x4fb477 : kind === "heavy" ? 0xe43f2e : 0x1976d2;
    this.add.rectangle(x + 278, y, 556, 34, 0x101820, 0.94).setStrokeStyle(2, 0x101820, 1);
    this.add.rectangle(x + 6, y, 12, 34, accent, 1);
    this.add.text(x + 24, y - 12, attackLabels[kind].toUpperCase(), {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "17px",
      color: "#fff7e6",
      fontStyle: "900",
    });
    this.add.text(x + 184, y - 10, `DMG ${attack.damage}`, this.cardTextStyle(13));
    this.add.text(x + 270, y - 10, `RANGE ${attack.range}`, this.cardTextStyle(13));
    this.add.text(x + 386, y - 10, `KB ${attack.knockback}`, this.cardTextStyle(13));
    this.add.text(x + 480, y - 10, `${attack.cooldown}ms`, this.cardTextStyle(13));
    this.add.text(x + 184, y + 7, `Windup ${attack.windup}ms     Active ${attack.active}ms`, this.cardTextStyle(11));
  }

  private addRoster(x: number, y: number) {
    fighters.forEach((fighter, index) => {
      const unlocked = isFighterUnlocked(fighter.id);
      const selected = index === this.selectedIndex;
      const tileY = y + index * 82;
      const bg = this.add
        .rectangle(x, tileY, 128, 66, selected ? this.getRarityColor(fighter) : 0x101820, selected ? 0.92 : 0.82)
        .setStrokeStyle(selected ? 4 : 2, selected ? 0xf7f2e6 : 0x41504b);
      this.add.image(x - 38, tileY - 5, fighter.spriteKey).setDisplaySize(54, 42).setAlpha(unlocked ? 1 : 0.28);
      if (!unlocked) this.addLockIcon(x - 38, tileY - 5, 0.82);
      this.add.text(x + 18, tileY - 13, unlocked ? fighter.displayName : "?????", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#fff7e6",
        fontStyle: "900",
      }).setOrigin(0.5);
      this.add.text(x + 18, tileY + 12, unlocked ? fighter.rarity : this.getUnlockHint(fighter.id), {
        fontFamily: "system-ui, sans-serif",
        fontSize: unlocked ? "11px" : "10px",
        color: "#dbe9df",
        fontStyle: "900",
        align: "center",
        wordWrap: { width: 74 },
      }).setOrigin(0.5);
      if (unlocked) {
        bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
          this.selectedIndex = index;
          this.render();
        });
      }
    });
  }

  private addTraitColumn(x: number, y: number, title: string, traits: string[], accent: number) {
    this.add.text(x, y, title, {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "21px",
      color: "#fff7e6",
      fontStyle: "900",
    });
    traits.forEach((trait, index) => {
      this.add.circle(x + 8, y + 36 + index * 27, 5, accent, 1);
      this.add.text(x + 22, y + 25 + index * 27, trait, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#dbe9df",
        fontStyle: "800",
      });
    });
  }

  private addStatPill(x: number, y: number, label: string, value: number, max: number, color: number, displayValue = String(value)) {
    const width = 132;
    this.add.rectangle(x + 74, y, 164, 38, 0x101820, 0.95).setStrokeStyle(2, color, 0.85);
    this.add.text(x + 10, y - 15, label.toUpperCase(), {
      fontFamily: "system-ui, sans-serif",
      fontSize: "11px",
      color: "#fff7e6",
      fontStyle: "900",
    });
    this.add.rectangle(x + 10, y + 8, width, 7, 0x24302e, 1).setOrigin(0, 0.5);
    this.add.rectangle(x + 10, y + 8, Math.max(4, Math.min(width, (value / max) * width)), 7, color, 1).setOrigin(0, 0.5);
    this.add.text(x + 142, y - 17, displayValue, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      color: "#fff7e6",
      fontStyle: "900",
    }).setOrigin(1, 0);
  }

  private addBadge(x: number, y: number, label: string, color: number) {
    const badge = this.add.text(x, y, label.toUpperCase(), {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#fff7e6",
      fontStyle: "900",
      backgroundColor: Phaser.Display.Color.IntegerToColor(color).rgba,
      padding: { x: 10, y: 5 },
    });
    badge.setOrigin(0, 0.5);
  }

  private addSmallArrow(x: number, y: number, label: string, onClick: () => void) {
    this.addButton(x, y, label, onClick, 58, 48, 24);
  }

  private addButton(x: number, y: number, label: string, onClick: () => void, buttonWidth = 210, buttonHeight = 58, fontSize = 24) {
    const button = this.add
      .rectangle(x, y, buttonWidth, buttonHeight, 0xf7f2e6, 1)
      .setStrokeStyle(4, 0x101820)
      .setInteractive({ useHandCursor: true })
      .setDepth(30);
    const text = this.add.text(x, y, label, {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: `${fontSize}px`,
      color: "#101820",
      fontStyle: "900",
    }).setOrigin(0.5).setDepth(31);
    button.on("pointerover", () => button.setFillStyle(0xf3d98c));
    button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }

  private cardTextStyle(fontSize = 14): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: "system-ui, sans-serif",
      fontSize: `${fontSize}px`,
      color: "#dbe9df",
      fontStyle: "800",
    };
  }

  private getVisibleIndex(preferredId: string) {
    const preferredIndex = fighters.findIndex((fighter) => fighter.id === preferredId && isFighterUnlocked(fighter.id));
    if (preferredIndex >= 0) return preferredIndex;
    return Math.max(0, fighters.findIndex((fighter) => fighter.id === STARTING_FIGHTER_ID));
  }

  private changeSelection(delta: number) {
    for (let step = 0; step < fighters.length; step += 1) {
      const nextIndex = (this.selectedIndex + delta * (step + 1) + fighters.length) % fighters.length;
      if (isFighterUnlocked(fighters[nextIndex].id)) {
        this.selectedIndex = nextIndex;
        break;
      }
    }
    this.render();
  }

  private getUnlockHint(fighterId: string) {
    const level = campaignLevels.find((candidate) => candidate.unlockFighterId === fighterId);
    return level ? `Unlock by ${level.displayName}` : "Unlock in campaign";
  }

  private addLockIcon(x: number, y: number, alpha: number) {
    const shackle = this.add.graphics().setAlpha(alpha);
    shackle.lineStyle(4, 0xf3d86f, 1);
    shackle.strokeRoundedRect(x - 12, y - 14, 24, 24, 10);
    this.add.rectangle(x, y + 6, 34, 26, 0xf3d86f, alpha).setStrokeStyle(3, 0x101820, alpha);
    this.add.circle(x, y + 4, 4, 0x101820, alpha);
    this.add.rectangle(x, y + 12, 4, 10, 0x101820, alpha);
  }

  private getThreatScore(fighter: FighterConfig) {
    const attacks = Object.values(fighter.attacks);
    const damage = attacks.reduce((total, attack) => total + attack.damage, 0);
    const range = Math.max(...attacks.map((attack) => attack.range));
    return Math.min(100, Math.round(damage * 1.2 + range / 8));
  }

  private getRarityColor(fighter: FighterConfig) {
    if (fighter.rarity === "Boss") return 0x7b3fe4;
    if (fighter.rarity === "Legendary") return 0xd7b95d;
    if (fighter.rarity === "Epic") return 0xc24f8d;
    if (fighter.rarity === "Rare") return 0x1976d2;
    return 0x4fb477;
  }

  private getPreviewWidth(id: string) {
    if (id === "proposal-rock") return 336;
    if (id === "chelan") return 354;
    if (id === "ocean") return 350;
    return 232;
  }

  private getPreviewHeight(id: string) {
    if (id === "proposal-rock") return 252;
    if (id === "chelan") return 214;
    if (id === "ocean") return 230;
    return 280;
  }
}
