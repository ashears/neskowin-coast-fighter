import Phaser from "phaser";
import { getFighter } from "../fighters";
import { rerenderOnResize } from "../responsive";
import { characterSkins, drawCharacterSkinOverlay, type CharacterSkinConfig } from "../skins";
import {
  equipCharacterSkin,
  equipVictoryAnimation,
  getEquippedCharacterSkin,
  getVictoryProgress,
  normalizeCustomMessage,
  purchaseCharacterSkin,
  purchaseVictoryAnimation,
  updateCustomVictorySettings,
  victoryAnimations,
  type CustomVictorySettings,
  type VictoryAnimationConfig,
} from "../victory";

const CUSTOM_COLORS = [0xf3d86f, 0x7ee889, 0x7ee8ff, 0xffb84d, 0xe43f2e];
const CUSTOM_PATTERNS: CustomVictorySettings["pattern"][] = ["rays", "sparks", "waves"];
type StoreTab = "victory" | "skins";

export class VictoryStoreScene extends Phaser.Scene {
  private activeTab: StoreTab = "victory";
  private selectedIndex = 0;
  private notice = "";

  constructor() {
    super("VictoryStoreScene");
  }

  create() {
    rerenderOnResize(this, () => this.render());
    this.render();
  }

  private render() {
    this.children.removeAll();
    const { width, height } = this.scale;
    const progress = getVictoryProgress();

    this.add.image(width / 2, height / 2, "beach3").setDisplaySize(width, height).setAlpha(0.66);
    this.add.rectangle(width / 2, height / 2, width, height, 0x071210, 0.58);
    this.add.rectangle(width / 2, 52, width + 110, 100, 0x101820, 0.9).setAngle(-1.5).setStrokeStyle(4, 0xf3d86f, 0.82);
    this.add.text(width / 2, 48, "STORE", {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "48px",
      color: "#fff7e6",
      fontStyle: "900",
      stroke: "#101820",
      strokeThickness: 7,
    }).setOrigin(0.5);

    this.add.text(width - 92, 48, `${progress.coins} COINS`, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      color: "#101820",
      fontStyle: "900",
      backgroundColor: "#f3d86f",
      padding: { x: 13, y: 7 },
    }).setOrigin(0.5);

    this.addButton(86, 48, "Back", () => this.scene.start("TitleScene"), 118, 48, 18);
    this.addTabButton(234, 112, "Victory", "victory");
    this.addTabButton(406, 112, "Skins", "skins");
    if (this.activeTab === "victory") {
      const selected = victoryAnimations[this.selectedIndex] ?? victoryAnimations[0];
      const owned = progress.ownedAnimationIds.includes(selected.id);
      const equipped = progress.equippedAnimationId === selected.id;
      this.addAnimationList(142, 174, progress.equippedAnimationId, progress.ownedAnimationIds);
      this.addVictoryPreviewPanel(selected, owned, equipped, progress.custom);
    } else {
      const selected = characterSkins[this.selectedIndex] ?? characterSkins[0];
      const owned = progress.ownedSkinIds.includes(selected.id);
      const equipped = progress.equippedSkinIdsByFighter[selected.fighterId] === selected.id;
      this.addSkinList(142, 174, progress.equippedSkinIdsByFighter, progress.ownedSkinIds);
      this.addSkinPreviewPanel(selected, owned, equipped);
    }

    if (this.notice) {
      this.add.text(width / 2, height - 32, this.notice, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#fff7e6",
        fontStyle: "900",
        backgroundColor: "rgba(16, 24, 32, 0.78)",
        padding: { x: 14, y: 7 },
      }).setOrigin(0.5);
    }
  }

  private addAnimationList(x: number, y: number, equippedId: string, ownedIds: string[]) {
    victoryAnimations.forEach((animation, index) => {
      const selected = index === this.selectedIndex;
      const owned = ownedIds.includes(animation.id);
      const tileY = y + index * 64;
      const bg = this.add.rectangle(x + 160, tileY, 320, 56, selected ? animation.accent : 0x101820, selected ? 0.94 : 0.84)
        .setStrokeStyle(selected ? 5 : 2, selected ? 0xf7f2e6 : 0x41504b)
        .setInteractive({ useHandCursor: true });
      this.add.text(x + 28, tileY - 22, animation.displayName.toUpperCase(), {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "20px",
        color: selected ? "#101820" : "#fff7e6",
        fontStyle: "900",
      });
      this.add.text(x + 28, tileY + 5, equippedId === animation.id ? "EQUIPPED" : owned ? "OWNED" : `${animation.price} COINS`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: selected ? "#101820" : "#dbe9df",
        fontStyle: "900",
      });
      bg.on("pointerdown", () => {
        this.selectedIndex = index;
        this.notice = "";
        this.render();
      });
    });
  }

  private addSkinList(x: number, y: number, equippedByFighter: Record<string, string | undefined>, ownedIds: string[]) {
    characterSkins.forEach((skin, index) => {
      const selected = index === this.selectedIndex;
      const owned = ownedIds.includes(skin.id);
      const equipped = equippedByFighter[skin.fighterId] === skin.id;
      const tileY = y + index * 64;
      const bg = this.add.rectangle(x + 160, tileY, 320, 56, selected ? skin.accent : 0x101820, selected ? 0.94 : 0.84)
        .setStrokeStyle(selected ? 5 : 2, selected ? 0xf7f2e6 : 0x41504b)
        .setInteractive({ useHandCursor: true });
      this.add.text(x + 28, tileY - 22, skin.displayName.toUpperCase(), {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "20px",
        color: selected ? "#fff7e6" : "#fff7e6",
        fontStyle: "900",
      });
      this.add.text(x + 28, tileY + 5, equipped ? "EQUIPPED" : owned ? "OWNED" : `${skin.price} COINS`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#dbe9df",
        fontStyle: "900",
      });
      bg.on("pointerdown", () => {
        this.selectedIndex = index;
        this.notice = "";
        this.render();
      });
    });
  }

  private addVictoryPreviewPanel(animation: VictoryAnimationConfig, owned: boolean, equipped: boolean, custom: CustomVictorySettings) {
    const { width } = this.scale;
    this.add.rectangle(782, 412, 820, 520, 0xf7f2e6, 0.96).setStrokeStyle(5, 0x101820);
    this.add.text(434, 182, animation.displayName.toUpperCase(), {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "44px",
      color: "#101820",
      fontStyle: "900",
    });
    this.add.text(436, 238, animation.description, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      color: "#27323a",
      fontStyle: "800",
      wordWrap: { width: 660 },
      lineSpacing: 5,
    });
    this.drawPreview(animation, custom);

    if (animation.id === "custom-sign" && owned) {
      this.addCustomControls(custom);
    }

    if (!owned) {
      this.addButton(width / 2 + 170, 646, `Buy ${animation.price}`, () => this.buySelected(), 220, 62, 25);
    } else {
      this.addButton(width / 2 + 170, 646, equipped ? "Equipped" : "Equip", () => this.equipSelected(), 220, 62, 25);
    }
  }

  private addSkinPreviewPanel(skin: CharacterSkinConfig, owned: boolean, equipped: boolean) {
    const { width } = this.scale;
    this.add.rectangle(782, 412, 820, 520, 0xf7f2e6, 0.96).setStrokeStyle(5, 0x101820);
    this.add.text(434, 182, skin.displayName.toUpperCase(), {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "44px",
      color: "#101820",
      fontStyle: "900",
    });
    this.add.text(436, 238, skin.description, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      color: "#27323a",
      fontStyle: "800",
      wordWrap: { width: 660 },
      lineSpacing: 5,
    });
    this.drawSkinPreview(skin);

    if (!owned) {
      this.addButton(width / 2 + 170, 646, `Buy ${skin.price}`, () => this.buySelectedSkin(), 220, 62, 25);
    } else {
      this.addButton(width / 2 + 170, 646, equipped ? "Equipped" : "Equip", () => this.equipSelectedSkin(), 220, 62, 25);
    }
  }

  private drawPreview(animation: VictoryAnimationConfig, custom: CustomVictorySettings) {
    const centerX = 782;
    const centerY = 420;
    const label = animation.id === "custom-sign" ? custom.message : "WINNER";
    const accent = animation.id === "custom-sign" ? custom.color : animation.accent;
    this.add.rectangle(centerX, centerY, 590, 255, 0x101820, 0.94).setStrokeStyle(4, accent, 0.9);
    this.add.ellipse(centerX, centerY + 62, 340, 54, accent, 0.2).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(centerX, centerY - 18, "fighter-proposal-rock").setDisplaySize(230, 172);
    drawCharacterSkinOverlay(this, getEquippedCharacterSkin("proposal-rock"), "proposal-rock", centerX, centerY - 18, 230);
    this.add.text(centerX, centerY + 106, label.toUpperCase(), {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "34px",
      color: "#fff7e6",
      fontStyle: "900",
      stroke: "#101820",
      strokeThickness: 7,
    }).setOrigin(0.5);

    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const radius = animation.id === "bonfire" ? 95 : 128;
      this.add.circle(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * 56, animation.id === "coin-burst" ? 10 : 6, accent, 0.82);
    }
  }

  private drawSkinPreview(skin: CharacterSkinConfig) {
    const centerX = 782;
    const centerY = 420;
    const fighter = getFighter(skin.fighterId);
    const previewSize = this.getSkinPreviewSize(skin.fighterId);
    this.add.rectangle(centerX, centerY, 590, 255, 0x101820, 0.94).setStrokeStyle(4, skin.accent, 0.9);
    this.add.ellipse(centerX, centerY + 62, 340, 54, skin.accent, 0.2).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(centerX, centerY - 18, fighter.spriteKey).setDisplaySize(previewSize.width, previewSize.height);
    drawCharacterSkinOverlay(this, skin, fighter.id, centerX, centerY - 18, previewSize.width);
    this.add.text(centerX, centerY + 108, fighter.displayName.toUpperCase(), {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "31px",
      color: "#fff7e6",
      fontStyle: "900",
      stroke: "#101820",
      strokeThickness: 7,
    }).setOrigin(0.5);
  }

  private getSkinPreviewSize(fighterId: string) {
    if (fighterId === "proposal-rock") return { width: 230, height: 172 };
    if (fighterId === "chelan") return { width: 360, height: 216 };
    if (fighterId === "ocean") return { width: 330, height: 215 };
    return { width: 180, height: 228 };
  }

  private addCustomControls(custom: CustomVictorySettings) {
    this.add.text(436, 565, "CUSTOMIZE", {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "24px",
      color: "#101820",
      fontStyle: "900",
    });
    this.addButton(560, 608, "Set Text", () => this.setCustomText(), 170, 52, 20);
    CUSTOM_COLORS.forEach((color, index) => {
      const chip = this.add.circle(686 + index * 44, 608, 17, color, 1).setStrokeStyle(custom.color === color ? 5 : 2, 0x101820);
      chip.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        updateCustomVictorySettings({ ...custom, color });
        this.notice = "Custom color saved";
        this.render();
      });
    });
    CUSTOM_PATTERNS.forEach((pattern, index) => {
      this.addButton(936 + index * 86, 608, pattern, () => {
        updateCustomVictorySettings({ ...custom, pattern });
        this.notice = "Custom pattern saved";
        this.render();
      }, 78, 44, 15);
    });
  }

  private buySelected() {
    const animation = victoryAnimations[this.selectedIndex];
    const result = purchaseVictoryAnimation(animation.id);
    this.notice = result.ok ? `${animation.displayName} purchased and equipped` : "Not enough coins";
    this.render();
  }

  private buySelectedSkin() {
    const skin = characterSkins[this.selectedIndex];
    const result = purchaseCharacterSkin(skin.id);
    this.notice = result.ok ? `${skin.displayName} purchased and equipped` : "Not enough coins";
    this.render();
  }

  private equipSelected() {
    const animation = victoryAnimations[this.selectedIndex];
    equipVictoryAnimation(animation.id);
    this.notice = `${animation.displayName} equipped`;
    this.render();
  }

  private equipSelectedSkin() {
    const skin = characterSkins[this.selectedIndex];
    equipCharacterSkin(skin.id);
    this.notice = `${skin.displayName} equipped`;
    this.render();
  }

  private setCustomText() {
    const progress = getVictoryProgress();
    const entered = window.prompt("Victory text", progress.custom.message);
    if (entered === null) return;
    updateCustomVictorySettings({ ...progress.custom, message: normalizeCustomMessage(entered) });
    this.notice = "Custom text saved";
    this.render();
  }

  private addButton(x: number, y: number, label: string, onClick: () => void, buttonWidth = 250, buttonHeight = 68, fontSize = 24) {
    const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0xf7f2e6, 1).setStrokeStyle(4, 0x101820).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: `${fontSize}px`,
      color: "#101820",
      fontStyle: "900",
    }).setOrigin(0.5);
    button.on("pointerover", () => button.setFillStyle(0xf3d98c));
    button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }

  private addTabButton(x: number, y: number, label: string, tab: StoreTab) {
    const active = this.activeTab === tab;
    const button = this.add.rectangle(x, y, 148, 46, active ? 0xf3d86f : 0xf7f2e6, 1)
      .setStrokeStyle(active ? 5 : 3, 0x101820)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: "Impact, system-ui, sans-serif",
      fontSize: "21px",
      color: "#101820",
      fontStyle: "900",
    }).setOrigin(0.5);
    const select = () => {
      this.activeTab = tab;
      this.selectedIndex = 0;
      this.notice = "";
      this.render();
    };
    button.on("pointerdown", select);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", select);
  }
}
