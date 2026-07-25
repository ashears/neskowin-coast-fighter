import Phaser from "phaser";
import { getLevel } from "../levels";
import type { MatchResult } from "../types";

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
    this.add.image(width / 2, height / 2, level.textureKey).setDisplaySize(width, height).setAlpha(0.62);
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b1817, 0.52);

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

    this.addButton(width / 2 - 150, 424, "Rematch", () => this.scene.start("CharacterSelectScene", { mode: this.result?.mode ?? "ai" }));
    this.addButton(width / 2 + 150, 424, "Title", () => this.scene.start("TitleScene"));
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
