import Phaser from "phaser";
import { getFighter } from "../fighters";
import { getLevel } from "../levels";

interface CharacterUnlockData {
  fighterId: string;
  levelId?: string;
}

export class CharacterUnlockScene extends Phaser.Scene {
  private fighterId = "chelan";
  private levelId = "neskowin";

  constructor() {
    super("CharacterUnlockScene");
  }

  init(data: CharacterUnlockData) {
    this.fighterId = data.fighterId ?? "chelan";
    this.levelId = data.levelId ?? "neskowin";
  }

  create() {
    const { width, height } = this.scale;
    const fighter = getFighter(this.fighterId);
    const level = getLevel(this.levelId);

    this.add.image(width / 2, height / 2, level.textureKey).setDisplaySize(width, height).setAlpha(0.48);
    this.add.rectangle(width / 2, height / 2, width, height, 0x071210, 0.78);
    this.createRays(width / 2, height / 2 + 10);
    this.createRewardCards();
    this.createGemRain();

    const banner = this.add
      .rectangle(width / 2, 104, 720, 78, 0xf3d86f, 1)
      .setStrokeStyle(5, 0x101820)
      .setAngle(-2)
      .setDepth(8);
    this.tweens.add({ targets: banner, scaleX: 1.035, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(width / 2, 104, "NEW CHARACTER", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "54px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setAngle(-2)
      .setDepth(9);

    const spotlight = this.add
      .ellipse(width / 2, 437, 470, 94, 0x7ee889, 0.28)
      .setStrokeStyle(5, 0xf8fff4, 0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(5);
    this.tweens.add({ targets: spotlight, scaleX: 1.08, alpha: 0.5, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const sprite = this.add
      .image(width / 2, 348, fighter.spriteKey)
      .setDisplaySize(this.getPreviewWidth(fighter.id), this.getPreviewHeight(fighter.id))
      .setDepth(10);
    const finalScaleX = sprite.scaleX;
    const finalScaleY = sprite.scaleY;
    sprite.setScale(0.18);
    this.tweens.add({ targets: sprite, scaleX: finalScaleX, scaleY: finalScaleY, duration: 520, ease: "Back.Out" });
    this.tweens.add({ targets: sprite, y: 330, duration: 760, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 520 });

    this.add
      .text(width / 2, 503, fighter.displayName.toUpperCase(), {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "58px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#101820",
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.addStatChip(width / 2 - 240, 576, "SPECIAL", fighter.specialName, 0xffb84d);
    this.addStatChip(width / 2, 576, "SPEED", String(fighter.speed), 0x7ee8ff);
    this.addStatChip(width / 2 + 240, 576, "SHIELD", String(fighter.maxShield), 0x7ee889);

    this.cameras.main.flash(260, 255, 244, 180, false);
    this.cameras.main.shake(180, 0.006);
    this.addButton(width / 2 - 146, 660, "Map", () => this.scene.start("CampaignSelectScene"));
    this.addButton(width / 2 + 146, 660, "Title", () => this.scene.start("TitleScene"));
  }

  private createRays(x: number, y: number) {
    const rays = this.add.graphics().setDepth(2);
    for (let index = 0; index < 24; index += 1) {
      const angle = (Math.PI * 2 * index) / 24;
      const nextAngle = angle + Math.PI / 42;
      rays.fillStyle(index % 2 === 0 ? 0xf3d86f : 0x7ee889, 0.18);
      rays.beginPath();
      rays.moveTo(x, y);
      rays.lineTo(x + Math.cos(angle) * 940, y + Math.sin(angle) * 940);
      rays.lineTo(x + Math.cos(nextAngle) * 940, y + Math.sin(nextAngle) * 940);
      rays.closePath();
      rays.fillPath();
    }
    this.tweens.add({ targets: rays, rotation: Math.PI * 2, duration: 18000, repeat: -1, ease: "Linear" });
  }

  private createRewardCards() {
    const { width } = this.scale;
    for (let index = 0; index < 5; index += 1) {
      const x = width / 2 - 360 + index * 180;
      const card = this.add
        .rectangle(x, 350 + (index % 2) * 22, 116, 172, index % 2 === 0 ? 0x152926 : 0x203d38, 0.72)
        .setStrokeStyle(3, 0xf3d86f, 0.5)
        .setAngle(-10 + index * 5)
        .setDepth(4);
      this.tweens.add({ targets: card, y: card.y - 18, duration: 900 + index * 80, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  private createGemRain() {
    const { width, height } = this.scale;
    for (let index = 0; index < 42; index += 1) {
      const gem = this.add
        .polygon(Phaser.Math.Between(20, width - 20), Phaser.Math.Between(-80, height), [
          0, -8, 8, 0, 0, 8, -8, 0,
        ], Phaser.Utils.Array.GetRandom([0x7ee8ff, 0x7ee889, 0xf3d86f, 0xffb84d]), 0.88)
        .setDepth(7);
      this.tweens.add({
        targets: gem,
        y: height + 80,
        rotation: Math.PI * 2,
        duration: Phaser.Math.Between(2100, 3900),
        repeat: -1,
        delay: Phaser.Math.Between(0, 900),
        ease: "Linear",
        onRepeat: () => gem.setPosition(Phaser.Math.Between(20, width - 20), -60),
      });
    }
  }

  private addStatChip(x: number, y: number, label: string, value: string, color: number) {
    this.add.rectangle(x, y, 208, 58, 0x101820, 0.92).setStrokeStyle(3, color, 0.9).setDepth(12);
    this.add
      .text(x, y - 13, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#dbe9df",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(13);
    this.add
      .text(x, y + 10, value, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#fff7e6",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(13);
  }

  private addButton(x: number, y: number, label: string, onClick: () => void) {
    const button = this.add
      .rectangle(x, y, 236, 58, 0xf7f2e6, 1)
      .setStrokeStyle(4, 0x101820)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "28px",
        color: "#101820",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(21);
    button.on("pointerover", () => button.setFillStyle(0xf3d86f));
    button.on("pointerout", () => button.setFillStyle(0xf7f2e6));
    button.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
  }

  private getPreviewWidth(id: string) {
    if (id === "proposal-rock") return 420;
    if (id === "chelan") return 470;
    if (id === "ocean") return 470;
    return 280;
  }

  private getPreviewHeight(id: string) {
    if (id === "proposal-rock") return 314;
    if (id === "chelan") return 282;
    if (id === "ocean") return 310;
    return 360;
  }
}
