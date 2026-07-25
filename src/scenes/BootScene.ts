import Phaser from "phaser";
import { fighters } from "../fighters";
import { levels } from "../levels";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    for (const level of levels) {
      this.load.image(level.textureKey, level.assetPath);
    }
    this.load.image("projectile-beachBall", "assets/projectiles/beach-ball.svg");
    this.load.image("projectile-shovel", "assets/projectiles/shovel.svg");
    this.load.image("projectile-fish", "assets/projectiles/fish.svg");
    this.load.image("projectile-chair", "assets/projectiles/chair.svg");
    this.load.image("projectile-towel", "assets/projectiles/towel.svg");
    this.load.image("projectile-person", "assets/projectiles/tourist.svg");
    this.load.image("projectile-starfish", "assets/projectiles/starfish.png");
    for (const fighter of fighters) {
      const extension = fighter.id === "proposal-rock" || fighter.id === "chelan" ? "png" : "svg";
      this.load.image(fighter.spriteKey, `assets/fighters/${fighter.id}.${extension}`);
    }
  }

  create() {
    this.scene.start("TitleScene");
  }
}
