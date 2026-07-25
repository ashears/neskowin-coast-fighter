import Phaser from "phaser";
import "./style.css";
import { BootScene } from "./scenes/BootScene";
import { CampaignSelectScene } from "./scenes/CampaignSelectScene";
import { CharacterUnlockScene } from "./scenes/CharacterUnlockScene";
import { CharacterViewerScene } from "./scenes/CharacterViewerScene";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { FightScene } from "./scenes/FightScene";
import { LevelSelectScene } from "./scenes/LevelSelectScene";
import { OnlineScene } from "./scenes/OnlineScene";
import { ResultScene } from "./scenes/ResultScene";
import { TitleScene } from "./scenes/TitleScene";
import { VictoryStoreScene } from "./scenes/VictoryStoreScene";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./responsive";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#102421",
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    autoRound: true,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1700 },
      debug: false,
    },
  },
  input: {
    activePointers: 8,
  },
  scene: [
    BootScene,
    TitleScene,
    OnlineScene,
    CampaignSelectScene,
    CharacterSelectScene,
    LevelSelectScene,
    FightScene,
    ResultScene,
    CharacterUnlockScene,
    CharacterViewerScene,
    VictoryStoreScene,
  ],
};

new Phaser.Game(config);
