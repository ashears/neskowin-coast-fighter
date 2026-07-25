import Phaser from "phaser";
import { campaignLevels, completeCampaignLevel } from "../campaign";
import { getFighter } from "../fighters";
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
    const campaignWon = this.result?.mode === "campaign" && this.result.campaignLevelId && this.result.winnerId === this.result.playerOneId;
    const campaignLost = this.result?.mode === "campaign" && this.result.campaignLevelId && !campaignWon;
    const unlockedName = campaignWon ? this.completeCampaignWin(this.result!.campaignLevelId!) : undefined;
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

    if (unlockedName) {
      this.add
        .text(width / 2, 326, `${unlockedName} unlocked`, {
          fontFamily: "Impact, system-ui, sans-serif",
          fontSize: "34px",
          color: "#f3d86f",
          fontStyle: "900",
          stroke: "#101820",
          strokeThickness: 6,
        })
        .setOrigin(0.5);
    } else if (campaignLost) {
      this.add
        .text(width / 2, 326, "Campaign progress needs a win", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "26px",
          color: "#dbe9df",
          fontStyle: "900",
          backgroundColor: "rgba(12, 25, 23, 0.62)",
          padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5);
    }

    if (this.result?.mode === "campaign") {
      this.addButton(width / 2 - 150, 424, campaignLost ? "Retry" : "Map", () => {
        if (campaignLost) this.retryCampaignBattle();
        else this.scene.start("CampaignSelectScene");
      });
      this.addButton(width / 2 + 150, 424, "Title", () => this.scene.start("TitleScene"));
      return;
    }

    this.addButton(width / 2 - 150, 424, "Rematch", () => this.scene.start("CharacterSelectScene", { mode: this.result?.mode ?? "ai" }));
    this.addButton(width / 2 + 150, 424, "Title", () => this.scene.start("TitleScene"));
  }

  private completeCampaignWin(campaignLevelId: string) {
    completeCampaignLevel(campaignLevelId);
    const level = campaignLevels.find((candidate) => candidate.id === campaignLevelId);
    return level?.unlockFighterId ? getFighter(level.unlockFighterId).displayName : undefined;
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
