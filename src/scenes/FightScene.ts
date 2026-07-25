import Phaser from "phaser";
import { getFighter } from "../fighters";
import { getLevel } from "../levels";
import { onlineSession, type MatchNetState } from "../online";
import type { AttackKind, FighterConfig, MatchResult, MatchSelection } from "../types";

type ControlAction = "left" | "right" | "up" | "down" | "block" | "light" | "heavy" | "special";
type ButtonState = Record<ControlAction, boolean>;
type AttackState = {
  kind: AttackKind;
  startedAt: number;
  hit: boolean;
  slam?: {
    launched: boolean;
    impacted: boolean;
  };
};
type BeachProjectileKind = "beachBall" | "shovel" | "fish" | "chair" | "towel" | "person";
type OceanWaveKind = "breaker" | "cross" | "sneaker";

interface BeachProjectile {
  object: Phaser.GameObjects.Image;
  owner: RuntimeFighter;
  kind: BeachProjectileKind;
  damage: number;
  knockback: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  expiresAt: number;
  hit: boolean;
}

interface OceanWave {
  body: Phaser.GameObjects.Rectangle;
  crest: Phaser.GameObjects.Ellipse;
  warning: Phaser.GameObjects.Rectangle;
  kind: OceanWaveKind;
  width: number;
  height: number;
  velocityY: number;
  damage: number;
  knockback: number;
  oneShot: boolean;
  hit: boolean;
  expiresAt: number;
}

interface StarfishMine {
  object: Phaser.GameObjects.Container;
  owner: RuntimeFighter;
  damage: number;
  knockback: number;
  radius: number;
  armedAt: number;
  expiresAt: number;
  triggered: boolean;
}

interface RuntimeFighter {
  config: FighterConfig;
  sprite: Phaser.Physics.Arcade.Sprite;
  nameLabel: Phaser.GameObjects.Text;
  shieldAura: Phaser.GameObjects.Ellipse;
  shieldEdge: Phaser.GameObjects.Ellipse;
  baseScaleX: number;
  baseScaleY: number;
  health: number;
  shield: number;
  specialCharge: number;
  shieldRechargePausedUntil: number;
  rounds: number;
  facing: 1 | -1;
  isBlocking: boolean;
  attack?: AttackState;
  cooldowns: Record<AttackKind, number>;
  controls: ButtonState;
  keyboardControls: ButtonState;
  touchControls: ButtonState;
  aiTimer: number;
  aiPlan: Partial<ButtonState>;
}

const blankControls = (): ButtonState => ({
  left: false,
  right: false,
  up: false,
  down: false,
  block: false,
  light: false,
  heavy: false,
  special: false,
});

const SPECIAL_CHARGE_MAX = 100;
const SPECIAL_CHARGE_ON_BLOCK = 24;
const SPECIAL_CHARGE_ON_HIT: Record<Exclude<AttackKind, "special">, number> = {
  light: 16,
  heavy: 28,
};

export class FightScene extends Phaser.Scene {
  private selection!: MatchSelection;
  private playerOne!: RuntimeFighter;
  private playerTwo!: RuntimeFighter;
  private ground?: Phaser.GameObjects.Rectangle;
  private healthBars: Phaser.GameObjects.Rectangle[] = [];
  private shieldBars: Phaser.GameObjects.Rectangle[] = [];
  private specialBars: Phaser.GameObjects.Rectangle[] = [];
  private timerText?: Phaser.GameObjects.Text;
  private roundText?: Phaser.GameObjects.Text;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private roundTime = 60;
  private roundStartedAt = 0;
  private roundOver = false;
  private roundNumber = 1;
  private projectiles: BeachProjectile[] = [];
  private starfishMines: StarfishMine[] = [];
  private oceanBossActive = false;
  private oceanBossSprite?: Phaser.GameObjects.Image;
  private oceanBossFoam?: Phaser.GameObjects.Ellipse;
  private oceanWaves: OceanWave[] = [];
  private nextOceanWaveAt = 0;
  private nextSneakerWaveAt = 0;
  private lastOnlineStateAt = 0;
  private onlineStatusText?: Phaser.GameObjects.Text;
  private onlineCleanup?: () => void;

  constructor() {
    super("FightScene");
  }

  init(data: MatchSelection) {
    this.selection = { ...data, levelId: data.levelId ?? "neskowin" };
    this.oceanBossActive = this.selection.levelId === "ocean-boss";
    this.roundTime = 60;
    this.roundStartedAt = 0;
    this.roundOver = false;
    this.roundNumber = 1;
    this.healthBars = [];
    this.shieldBars = [];
    this.specialBars = [];
    this.lastOnlineStateAt = 0;
    this.onlineStatusText = undefined;
  }

  create() {
    const { width, height } = this.scale;
    const level = getLevel(this.selection.levelId);
    this.add.image(width / 2, height / 2, level.textureKey).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, this.oceanBossActive ? 0x071b24 : 0x0b1817, this.oceanBossActive ? 0.08 : 0.16);
    if (this.oceanBossActive) this.createOceanBossArena();

    this.ground = this.add.rectangle(width / 2, this.fightFloorY(height), width, 34, 0x4a594e, 1);
    this.physics.add.existing(this.ground, true);

    this.playerOne = this.createFighter(getFighter(this.selection.playerOneId), 260, this.fighterSpawnY(height), 1, "P1");
    this.playerTwo = this.createFighter(
      getFighter(this.selection.playerTwoId),
      this.oceanBossActive ? width / 2 : width - 260,
      this.fighterSpawnY(height),
      -1,
      this.oceanBossActive ? "BOSS" : this.selection.mode === "ai" ? "AI" : "P2",
    );
    if (this.oceanBossActive) this.configureOceanBossFighter();

    this.physics.add.collider(this.playerOne.sprite, this.ground);
    if (!this.oceanBossActive) {
      this.physics.add.collider(this.playerTwo.sprite, this.ground);
      this.physics.add.collider(this.playerOne.sprite, this.playerTwo.sprite);
    }

    this.createHud();
    this.createKeyboard();
    this.createTouchControls();
    this.createOnlineHud();
    this.onlineCleanup = onlineSession.onMessage((message) => {
      if (message.type === "match-result" && onlineSession.latestResult && this.isOnlineGuest()) {
        this.scene.start("ResultScene", onlineSession.latestResult);
      } else if (message.type === "peer-joined" && this.isOnlineHost()) {
        onlineSession.sendMatchStart({ ...this.selection, mode: "online-guest", roomCode: onlineSession.roomCode });
        this.onlineStatusText?.setText(`Online host room ${onlineSession.roomCode || this.selection.roomCode || "----"}`);
      } else if (message.type === "peer-left") {
        this.onlineStatusText?.setText("Other player disconnected");
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.onlineCleanup?.();
      this.onlineCleanup = undefined;
    });
    this.startRound();

    if (this.isOnlineHost()) {
      onlineSession.sendMatchStart({ ...this.selection, mode: "online-guest", roomCode: onlineSession.roomCode });
    }
  }

  private fightFloorY(height: number) {
    return height - 250;
  }

  private fighterSpawnY(height: number) {
    return height - 365;
  }

  private createOceanBossArena() {
    const { width, height } = this.scale;
    this.oceanBossSprite = this.add
      .image(width / 2, 256, "fighter-ocean")
      .setDisplaySize(500, 330)
      .setAlpha(0.92)
      .setDepth(1);
    this.oceanBossFoam = this.add
      .ellipse(width / 2, 390, 700, 58, 0xd7fbff, 0.22)
      .setStrokeStyle(4, 0xd7fbff, 0.36)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.add.rectangle(width / 2, this.fightFloorY(height) + 16, width, 34, 0x7a6746, 0.5).setDepth(2);
    this.add
      .text(width / 2, 116, "The Ocean", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#f8fff4",
        fontStyle: "900",
        stroke: "#063544",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(5);
  }

  private configureOceanBossFighter() {
    const { width, height } = this.scale;
    this.playerTwo.sprite.setPosition(width / 2, this.fighterSpawnY(height));
    this.playerTwo.sprite.setVisible(false);
    this.playerTwo.sprite.setImmovable(true);
    (this.playerTwo.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.playerTwo.nameLabel.setVisible(false);
    this.playerTwo.shieldAura.setVisible(false);
    this.playerTwo.shieldEdge.setVisible(false);
  }

  update(time: number) {
    if (this.roundOver) return;

    this.readKeyboard();
    if (this.isOnlineGuest()) {
      onlineSession.sendInput(this.playerOne.controls);
      this.applyOnlineState();
      return;
    }
    if (this.isOnlineHost()) {
      this.playerTwo.controls = { ...blankControls(), ...onlineSession.remoteControls };
    }
    if (this.oceanBossActive) this.updateOceanBoss(time);
    else if (this.selection.mode === "ai") this.updateAi(time);

    this.updateFighter(this.playerOne, this.playerTwo, time);
    if (!this.oceanBossActive) this.updateFighter(this.playerTwo, this.playerOne, time);
    else this.updateOceanBossTarget();
    this.rechargeShields(time);
    this.resolveAttacks(this.playerOne, this.playerTwo, time);
    if (!this.oceanBossActive) this.resolveAttacks(this.playerTwo, this.playerOne, time);
    this.updateProjectiles(time);
    this.updateStarfishMines(time);
    this.updateHud(time);
    if (this.isOnlineHost() && time - this.lastOnlineStateAt >= 50) {
      this.lastOnlineStateAt = time;
      onlineSession.sendState(this.createOnlineState(time));
    }

    const elapsed = Math.floor((time - this.roundStartedAt) / 1000);
    if (elapsed >= this.roundTime || this.playerOne.health <= 0 || this.playerTwo.health <= 0) {
      this.finishRound();
    }
  }

  private createFighter(config: FighterConfig, x: number, y: number, facing: 1 | -1, tag: string): RuntimeFighter {
    const sprite = this.physics.add.sprite(x, y, config.spriteKey);
    if (config.id === "proposal-rock") {
      sprite.setDisplaySize(230, 172);
    } else if (config.id === "chelan") {
      sprite.setDisplaySize(250, 150);
    } else if (config.id === "ocean") {
      sprite.setDisplaySize(230, 150);
    } else {
      sprite.setDisplaySize(150, 190);
    }
    sprite.setCollideWorldBounds(true);
    sprite.setDragX(1600);
    sprite.setMaxVelocity(430, 980);
    if (config.id === "proposal-rock") {
      this.setDisplayedBodySize(sprite, 188, 138);
    } else if (config.id === "chelan") {
      sprite.setSize(210, 118);
      sprite.setOffset(44, 64);
    } else if (config.id === "ocean") {
      sprite.setSize(198, 104);
      sprite.setOffset(61, 182);
    } else {
      sprite.setSize(108, 174);
      sprite.setOffset(21, 10);
    }

    const nameLabel = this.add
      .text(x, y - 132, `${tag} ${config.displayName}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#fff7e6",
        fontStyle: "800",
        backgroundColor: "rgba(12, 25, 23, 0.55)",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);
    const shieldSize = this.getShieldVisualSize(config);
    const shieldAura = this.add
      .ellipse(x, y, shieldSize.width, shieldSize.height, 0x7ee8ff, 0.16)
      .setStrokeStyle(5, 0xcaf8ff, 0.65)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    const shieldEdge = this.add
      .ellipse(x, y, shieldSize.width * 0.82, shieldSize.height * 0.82, 0x1b6d8a, 0.08)
      .setStrokeStyle(3, 0x7ee8ff, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);

    return {
      config,
      sprite,
      nameLabel,
      shieldAura,
      shieldEdge,
      baseScaleX: sprite.scaleX,
      baseScaleY: sprite.scaleY,
      health: config.maxHealth,
      shield: config.maxShield,
      specialCharge: 0,
      shieldRechargePausedUntil: 0,
      rounds: 0,
      facing,
      isBlocking: false,
      cooldowns: { light: 0, heavy: 0, special: 0 },
      controls: blankControls(),
      keyboardControls: blankControls(),
      touchControls: blankControls(),
      aiTimer: 0,
      aiPlan: {},
    };
  }

  private setDisplayedBodySize(sprite: Phaser.Physics.Arcade.Sprite, width: number, height: number) {
    sprite.setBodySize(width / sprite.scaleX, height / sprite.scaleY, true);
  }

  private getShieldVisualSize(config: FighterConfig) {
    if (config.id === "proposal-rock") return { width: 290, height: 230 };
    if (config.id === "chelan") return { width: 305, height: 210 };
    if (config.id === "ocean") return { width: 305, height: 205 };
    return { width: 215, height: 255 };
  }

  private createHud() {
    const { width } = this.scale;
    this.add.rectangle(256, 39, 432, 24, 0x071210, 0.9).setStrokeStyle(2, 0xe8c66b);
    this.add.rectangle(width - 256, 39, 432, 24, 0x071210, 0.9).setStrokeStyle(2, 0xe8c66b);
    this.add.rectangle(256, 62, 432, 13, 0x071210, 0.82).setStrokeStyle(1, 0x7ee8ff, 0.72);
    this.add.rectangle(width - 256, 62, 432, 13, 0x071210, 0.82).setStrokeStyle(1, 0x7ee8ff, 0.72);
    this.add.rectangle(256, 78, 432, 13, 0x071210, 0.82).setStrokeStyle(1, 0xffef7d, 0.72);
    this.add.rectangle(width - 256, 78, 432, 13, 0x071210, 0.82).setStrokeStyle(1, 0xffef7d, 0.72);
    this.healthBars = [
      this.add.rectangle(40, 39, 420, 16, 0x56c271).setOrigin(0, 0.5),
      this.add.rectangle(width - 40, 39, 420, 16, 0x56c271).setOrigin(1, 0.5),
    ];
    this.shieldBars = [
      this.add.rectangle(40, 62, 420, 7, 0x7ee8ff).setOrigin(0, 0.5),
      this.add.rectangle(width - 40, 62, 420, 7, 0x7ee8ff).setOrigin(1, 0.5),
    ];
    this.specialBars = [
      this.add.rectangle(40, 78, 420, 7, 0xffb84d).setOrigin(0, 0.5),
      this.add.rectangle(width - 40, 78, 420, 7, 0xffb84d).setOrigin(1, 0.5),
    ];
    this.timerText = this.add
      .text(width / 2, 36, "60", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#fff7e6",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    this.roundText = this.add
      .text(width / 2, 84, "Round 1", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#dbe9df",
        fontStyle: "700",
      })
      .setOrigin(0.5);
  }

  private createOnlineHud() {
    if (!this.isOnlineHost() && !this.isOnlineGuest()) return;
    const roomCode = onlineSession.roomCode || this.selection.roomCode || "----";
    const label = this.isOnlineHost() ? `Online host room ${roomCode}` : `Online Player 2 room ${roomCode}`;
    this.onlineStatusText = this.add
      .text(this.scale.width / 2, 116, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#fff7e6",
        fontStyle: "800",
        backgroundColor: "rgba(12, 25, 23, 0.62)",
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(50);
  }

  private createKeyboard() {
    if (!this.input.keyboard) return;
    this.keys = this.input.keyboard.addKeys({
      p1Left: Phaser.Input.Keyboard.KeyCodes.A,
      p1Right: Phaser.Input.Keyboard.KeyCodes.D,
      p1Up: Phaser.Input.Keyboard.KeyCodes.W,
      p1Down: Phaser.Input.Keyboard.KeyCodes.S,
      p1Block: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      p1Light: Phaser.Input.Keyboard.KeyCodes.F,
      p1Heavy: Phaser.Input.Keyboard.KeyCodes.G,
      p1Special: Phaser.Input.Keyboard.KeyCodes.H,
      p2Left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      p2Right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      p2Up: Phaser.Input.Keyboard.KeyCodes.UP,
      p2Down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      p2Block: Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH,
      p2Light: Phaser.Input.Keyboard.KeyCodes.J,
      p2Heavy: Phaser.Input.Keyboard.KeyCodes.K,
      p2Special: Phaser.Input.Keyboard.KeyCodes.L,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private readKeyboard() {
    if (!this.keys) {
      this.playerOne.controls = this.mergeControls(blankControls(), this.playerOne.touchControls);
      if (this.selection.mode === "local") {
        this.playerTwo.controls = this.mergeControls(blankControls(), this.playerTwo.touchControls);
      }
      return;
    }
    this.playerOne.keyboardControls.left = this.keys.p1Left.isDown;
    this.playerOne.keyboardControls.right = this.keys.p1Right.isDown;
    this.playerOne.keyboardControls.up = Phaser.Input.Keyboard.JustDown(this.keys.p1Up);
    this.playerOne.keyboardControls.down = this.keys.p1Down.isDown;
    this.playerOne.keyboardControls.block = this.keys.p1Block.isDown;
    this.playerOne.keyboardControls.light = Phaser.Input.Keyboard.JustDown(this.keys.p1Light);
    this.playerOne.keyboardControls.heavy = Phaser.Input.Keyboard.JustDown(this.keys.p1Heavy);
    this.playerOne.keyboardControls.special = Phaser.Input.Keyboard.JustDown(this.keys.p1Special);
    this.playerOne.controls = this.mergeControls(this.playerOne.keyboardControls, this.playerOne.touchControls);

    if (this.selection.mode === "local") {
      this.playerTwo.keyboardControls.left = this.keys.p2Left.isDown;
      this.playerTwo.keyboardControls.right = this.keys.p2Right.isDown;
      this.playerTwo.keyboardControls.up = Phaser.Input.Keyboard.JustDown(this.keys.p2Up);
      this.playerTwo.keyboardControls.down = this.keys.p2Down.isDown;
      this.playerTwo.keyboardControls.block = this.keys.p2Block.isDown;
      this.playerTwo.keyboardControls.light = Phaser.Input.Keyboard.JustDown(this.keys.p2Light);
      this.playerTwo.keyboardControls.heavy = Phaser.Input.Keyboard.JustDown(this.keys.p2Heavy);
      this.playerTwo.keyboardControls.special = Phaser.Input.Keyboard.JustDown(this.keys.p2Special);
      this.playerTwo.controls = this.mergeControls(this.playerTwo.keyboardControls, this.playerTwo.touchControls);
    }
  }

  private mergeControls(primary: ButtonState, secondary: ButtonState): ButtonState {
    return {
      left: primary.left || secondary.left,
      right: primary.right || secondary.right,
      up: primary.up || secondary.up,
      down: primary.down || secondary.down,
      block: primary.block || secondary.block,
      light: primary.light || secondary.light,
      heavy: primary.heavy || secondary.heavy,
      special: primary.special || secondary.special,
    };
  }

  private clearControls(controls: ButtonState) {
    controls.left = false;
    controls.right = false;
    controls.up = false;
    controls.down = false;
    controls.block = false;
    controls.light = false;
    controls.heavy = false;
    controls.special = false;
  }

  private createTouchControls() {
    const { width, height } = this.scale;
    this.addTouchButton(84, height - 102, "◀", this.playerOne.touchControls, "left", "MOVE");
    this.addTouchButton(188, height - 102, "▶", this.playerOne.touchControls, "right", "MOVE");
    this.addTouchButton(136, height - 202, "▲", this.playerOne.touchControls, "up", "JUMP", true);
    this.addTouchButton(136, height - 34, "▼", this.playerOne.touchControls, "down", "DUCK");

    this.addTouchButton(width - 382, height - 102, "B", this.playerOne.touchControls, "block", "BLOCK");
    this.addTouchButton(width - 276, height - 102, "L", this.playerOne.touchControls, "light", "LIGHT", true);
    this.addTouchButton(width - 170, height - 102, "H", this.playerOne.touchControls, "heavy", "HEAVY", true);
    this.addTouchButton(width - 64, height - 102, "S", this.playerOne.touchControls, "special", "SPECIAL", true);

    if (this.selection.mode === "local") {
      this.add
        .text(width / 2, height - 26, "Local keyboard controls enabled for Player 2", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: "#fff7e6",
          backgroundColor: "rgba(12, 25, 23, 0.55)",
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5);
    } else if (this.isOnlineGuest()) {
      this.add
        .text(width / 2, height - 26, "You are Player 2 on this device", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: "#fff7e6",
          backgroundColor: "rgba(12, 25, 23, 0.55)",
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5);
    }
  }

  private addTouchButton(
    x: number,
    y: number,
    label: string,
    controls: ButtonState,
    action: ControlAction,
    caption: string,
    pulse = false,
  ) {
    const isAttack = action === "light" || action === "heavy" || action === "special";
    const baseColor = isAttack ? 0xffb84d : action === "block" ? 0x9bc2ff : 0xf2d37a;
    const activeColor = isAttack ? 0xffef7d : action === "block" ? 0xd4e7ff : 0xffeba8;
    const ring = this.add
      .circle(x, y, 47, 0x102421, 0.42)
      .setStrokeStyle(3, 0xfff2ba, 0.42)
      .setScrollFactor(0);
    const button = this.add
      .circle(x, y, 39, baseColor, 0.9)
      .setStrokeStyle(3, 0x102421)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "25px",
        color: "#102421",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    const captionText = this.add
      .text(x, y + 58, caption, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#fff7e6",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const release = () => {
      controls[action] = false;
      button.setFillStyle(baseColor, 0.9);
      this.tweens.add({ targets: [button, text], scale: 1, duration: 70, ease: "Back.Out" });
      this.tweens.add({ targets: ring, scale: 1, alpha: 1, duration: 90, ease: "Sine.Out" });
    };

    button.on("pointerdown", () => {
      controls[action] = true;
      button.setFillStyle(activeColor, 1);
      this.input.manager.canvas.style.cursor = "pointer";
      this.triggerHaptic(action);
      this.tweens.add({ targets: [button, text], scale: 0.88, duration: 55, ease: "Sine.Out" });
      this.tweens.add({ targets: ring, scale: 1.22, alpha: 0.42, duration: 120, ease: "Sine.Out" });
      this.popTouchFeedback(x, y - 64, caption, isAttack ? 0xffef7d : 0xd4e7ff);
      if (pulse) this.time.delayedCall(125, release);
    });
    button.on("pointerup", release);
    button.on("pointerupoutside", release);
    button.on("pointerout", release);

    captionText.setInteractive({ useHandCursor: true });
  }

  private triggerHaptic(action: ControlAction) {
    if (!("vibrate" in navigator)) return;
    const pattern = action === "special" ? [18, 18, 28] : action === "heavy" ? 22 : 10;
    navigator.vibrate(pattern);
  }

  private popTouchFeedback(x: number, y: number, label: string, color: number) {
    const burst = this.add.circle(x, y + 18, 8, color, 0.72).setScrollFactor(0);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#102421",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.tweens.add({
      targets: burst,
      radius: 34,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      scale: 1.16,
      duration: 360,
      ease: "Quad.Out",
      onComplete: () => text.destroy(),
    });
  }

  private startRound() {
    const { width, height } = this.scale;
    this.roundOver = false;
    this.roundStartedAt = this.time.now;
    this.playerOne.health = this.playerOne.config.maxHealth;
    this.playerTwo.health = this.playerTwo.config.maxHealth;
    this.playerOne.shield = this.playerOne.config.maxShield;
    this.playerTwo.shield = this.playerTwo.config.maxShield;
    this.playerOne.specialCharge = 0;
    this.playerTwo.specialCharge = 0;
    this.playerOne.shieldRechargePausedUntil = 0;
    this.playerTwo.shieldRechargePausedUntil = 0;
    this.playerOne.sprite.setPosition(this.oceanBossActive ? 290 : 260, this.fighterSpawnY(height)).setVelocity(0, 0);
    this.playerOne.sprite.setAlpha(1).setScale(this.playerOne.baseScaleX, this.playerOne.baseScaleY);
    (this.playerOne.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    this.playerTwo.sprite.setPosition(this.oceanBossActive ? width / 2 : width - 260, this.fighterSpawnY(height)).setVelocity(0, 0);
    this.playerOne.facing = 1;
    this.playerTwo.facing = -1;
    this.playerOne.cooldowns = { light: 0, heavy: 0, special: 0 };
    this.playerTwo.cooldowns = { light: 0, heavy: 0, special: 0 };
    this.clearControls(this.playerOne.keyboardControls);
    this.clearControls(this.playerOne.touchControls);
    this.clearControls(this.playerOne.controls);
    this.clearControls(this.playerTwo.keyboardControls);
    this.clearControls(this.playerTwo.touchControls);
    this.clearControls(this.playerTwo.controls);
    this.playerOne.attack = undefined;
    this.playerTwo.attack = undefined;
    this.updateShieldVisual(this.playerOne);
    this.updateShieldVisual(this.playerTwo);
    this.projectiles.forEach((projectile) => projectile.object.destroy());
    this.projectiles = [];
    this.starfishMines.forEach((mine) => mine.object.destroy());
    this.starfishMines = [];
    this.oceanWaves.forEach((wave) => this.destroyOceanWave(wave));
    this.oceanWaves = [];
    this.nextOceanWaveAt = this.time.now + 900;
    this.nextSneakerWaveAt = this.time.now + Phaser.Math.Between(16000, 23000);
    if (this.oceanBossActive) {
      this.playerTwo.sprite.setVisible(false);
      this.playerTwo.nameLabel.setVisible(false);
      this.flashMoveLabel(width / 2, 176, "DODGE THE BREAKERS");
    }
  }

  private updateFighter(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    const controls = actor.controls;
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;
    actor.facing = actor.sprite.x <= opponent.sprite.x ? 1 : -1;
    actor.sprite.setFlipX(actor.facing === -1);
    actor.nameLabel.setPosition(actor.sprite.x, actor.sprite.y - 132);
    actor.isBlocking = controls.block && body.blocked.down && !actor.attack && actor.shield > 0;

    const speed = actor.isBlocking ? actor.config.speed * 0.38 : actor.config.speed;
    if (controls.left && !controls.right) actor.sprite.setVelocityX(-speed);
    else if (controls.right && !controls.left) actor.sprite.setVelocityX(speed);

    if (controls.up && body.blocked.down && !actor.isBlocking) {
      actor.sprite.setVelocityY(-actor.config.jumpPower);
    }

    if (controls.down && body.blocked.down) {
      actor.sprite.setVelocityX(body.velocity.x * 0.55);
    }

    if (controls.light) this.tryAttack(actor, "light", time);
    if (controls.heavy) this.tryAttack(actor, "heavy", time);
    if (controls.special) this.tryAttack(actor, "special", time);

    actor.sprite.setTint(actor.isBlocking ? 0xa8c6ff : actor.config.tint);
    this.updateShieldVisual(actor);
  }

  private updateOceanBoss(time: number) {
    const pulse = 1 + Math.sin(time / 460) * 0.025;
    this.oceanBossSprite?.setScale(pulse, 1 + Math.sin(time / 620) * 0.018);
    this.oceanBossFoam?.setScale(1 + Math.sin(time / 340) * 0.045, 1 + Math.sin(time / 260) * 0.08);

    if (time >= this.nextOceanWaveAt) {
      this.spawnOceanWave(Math.random() < 0.24 ? "cross" : "breaker", time);
      this.nextOceanWaveAt = time + Phaser.Math.Between(1150, 1850);
    }

    if (time >= this.nextSneakerWaveAt) {
      this.spawnOceanWave("sneaker", time);
      this.nextSneakerWaveAt = time + Phaser.Math.Between(19000, 28000);
    }

    this.updateOceanWaves(time);
  }

  private updateOceanBossTarget() {
    const { width, height } = this.scale;
    this.playerTwo.sprite.setPosition(width / 2, this.fighterSpawnY(height));
    this.playerTwo.sprite.setVelocity(0, 0);
    this.playerTwo.facing = this.playerOne.sprite.x <= width / 2 ? -1 : 1;
    this.playerTwo.isBlocking = false;
  }

  private spawnOceanWave(kind: OceanWaveKind, time: number) {
    const { width } = this.scale;
    const isSneaker = kind === "sneaker";
    const laneX = isSneaker ? Phaser.Math.Between(330, width - 330) : Phaser.Math.Between(190, width - 190);
    const waveWidth = isSneaker ? 460 : kind === "cross" ? 210 : 138;
    const waveHeight = isSneaker ? 106 : 72;
    const startY = isSneaker ? 284 : 316;
    const velocityY = isSneaker ? 390 : kind === "cross" ? 300 : 250;
    const warning = this.add
      .rectangle(laneX, this.fightFloorY(this.scale.height) - 18, waveWidth, isSneaker ? 92 : 56, isSneaker ? 0xfff2ba : 0xcaf8ff, isSneaker ? 0.34 : 0.2)
      .setStrokeStyle(isSneaker ? 5 : 3, isSneaker ? 0xffef7d : 0xe5ffff, isSneaker ? 0.85 : 0.5)
      .setDepth(8);
    const body = this.add
      .rectangle(laneX, startY, waveWidth, waveHeight, isSneaker ? 0x184d62 : 0x2e9fc2, isSneaker ? 0.78 : 0.66)
      .setStrokeStyle(isSneaker ? 6 : 3, isSneaker ? 0xf8fff4 : 0xcaf8ff, isSneaker ? 0.94 : 0.72)
      .setDepth(7);
    const crest = this.add
      .ellipse(laneX, startY - waveHeight / 2, waveWidth * 0.94, isSneaker ? 42 : 24, 0xf8fff4, isSneaker ? 0.92 : 0.78)
      .setDepth(9);

    this.tweens.add({
      targets: warning,
      alpha: isSneaker ? 0.08 : 0.04,
      yoyo: true,
      repeat: isSneaker ? 9 : 4,
      duration: isSneaker ? 120 : 95,
      ease: "Sine.InOut",
    });

    if (isSneaker) {
      this.flashMoveLabel(laneX, startY - 72, "SNEAKER WAVE");
      this.cameras.main.shake(220, 0.008);
    }

    this.oceanWaves.push({
      body,
      crest,
      warning,
      kind,
      width: waveWidth,
      height: waveHeight,
      velocityY,
      damage: isSneaker ? 999 : kind === "cross" ? 12 : 10,
      knockback: isSneaker ? 0 : kind === "cross" ? 470 : 380,
      oneShot: isSneaker,
      hit: false,
      expiresAt: time + (isSneaker ? 2600 : 2200),
    });
  }

  private updateOceanWaves(time: number) {
    const delta = this.game.loop.delta / 1000;
    const player = this.playerOne;
    const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body;

    this.oceanWaves = this.oceanWaves.filter((wave) => {
      wave.body.y += wave.velocityY * delta;
      wave.crest.y = wave.body.y - wave.height / 2 + Math.sin(time / 82) * 5;
      wave.crest.x = wave.body.x + Math.sin(time / 125 + wave.body.x) * 8;
      wave.body.scaleX = 1 + Math.sin(time / 130 + wave.body.x) * 0.025;

      if (!wave.hit && this.isPlayerInOceanWave(wave, playerBody)) {
        wave.hit = true;
        if (wave.oneShot) this.sweepPlayerIntoOcean(wave);
        else this.hitPlayerWithOceanWave(wave);
      }

      if (time >= wave.expiresAt || wave.body.y > this.scale.height + 130) {
        this.destroyOceanWave(wave);
        return false;
      }
      return true;
    });
  }

  private isPlayerInOceanWave(wave: OceanWave, playerBody: Phaser.Physics.Arcade.Body) {
    const playerCenterX = playerBody.center.x;
    const playerCenterY = playerBody.center.y;
    const hitWidth = wave.width / 2 + playerBody.width * 0.28;
    const hitHeight = wave.height / 2 + playerBody.height * 0.28;
    return Math.abs(playerCenterX - wave.body.x) <= hitWidth && Math.abs(playerCenterY - wave.body.y) <= hitHeight;
  }

  private hitPlayerWithOceanWave(wave: OceanWave) {
    const shielded = this.absorbDamageWithShield(this.playerOne, wave.damage);
    if (shielded) this.addSpecialCharge(this.playerOne, SPECIAL_CHARGE_ON_BLOCK);
    const pushDirection = this.playerOne.sprite.x < wave.body.x ? -1 : 1;
    this.playerOne.sprite.setVelocityX(pushDirection * wave.knockback * (shielded ? 0.34 : 1));
    this.playerOne.sprite.setVelocityY(shielded ? -80 : -220);
    this.createOceanSplash(this.playerOne.sprite.x, this.playerOne.sprite.y - 20, wave.kind);
    this.cameras.main.shake(80, 0.005);
  }

  private sweepPlayerIntoOcean(wave: OceanWave) {
    this.playerOne.health = 0;
    this.playerOne.sprite.setVelocity(0, 0);
    (this.playerOne.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({
      targets: this.playerOne.sprite,
      x: wave.body.x,
      y: 260,
      alpha: 0.12,
      scaleX: this.playerOne.baseScaleX * 0.62,
      scaleY: this.playerOne.baseScaleY * 0.62,
      duration: 720,
      ease: "Cubic.In",
    });
    this.createOceanSplash(wave.body.x, wave.body.y, "sneaker");
    this.flashMoveLabel(wave.body.x, wave.body.y - 92, "SWEPT AWAY");
    this.cameras.main.flash(190, 220, 250, 255, false);
    this.cameras.main.shake(520, 0.018);
  }

  private createOceanSplash(x: number, y: number, kind: OceanWaveKind) {
    const count = kind === "sneaker" ? 24 : 10;
    for (let index = 0; index < count; index += 1) {
      const drop = this.add.circle(x, y, Phaser.Math.Between(4, kind === "sneaker" ? 12 : 8), 0xd7fbff, 0.82).setDepth(12);
      this.tweens.add({
        targets: drop,
        x: x + Phaser.Math.Between(-180, 180),
        y: y - Phaser.Math.Between(34, kind === "sneaker" ? 180 : 98),
        alpha: 0,
        duration: Phaser.Math.Between(260, kind === "sneaker" ? 760 : 520),
        ease: "Cubic.Out",
        onComplete: () => drop.destroy(),
      });
    }
  }

  private destroyOceanWave(wave: OceanWave) {
    wave.body.destroy();
    wave.crest.destroy();
    wave.warning.destroy();
  }

  private rechargeShields(time: number) {
    const delta = this.game.loop.delta / 1000;
    for (const actor of [this.playerOne, this.playerTwo]) {
      if (actor.isBlocking || actor.shield >= actor.config.maxShield || time < actor.shieldRechargePausedUntil) continue;
      actor.shield = Math.min(actor.config.maxShield, actor.shield + actor.config.shieldRechargePerSecond * delta);
    }
  }

  private updateShieldVisual(actor: RuntimeFighter) {
    const visible = actor.isBlocking && actor.shield > 0;
    const shieldRatio = actor.config.maxShield > 0 ? Phaser.Math.Clamp(actor.shield / actor.config.maxShield, 0, 1) : 0;
    const pulse = visible ? 1 + Math.sin(this.time.now / 85) * 0.035 : 1;
    actor.shieldAura
      .setPosition(actor.sprite.x + actor.facing * 8, actor.sprite.y - 8)
      .setAlpha(visible ? 0.18 + shieldRatio * 0.22 : 0)
      .setScale(pulse, pulse)
      .setVisible(visible);
    actor.shieldEdge
      .setPosition(actor.sprite.x + actor.facing * 8, actor.sprite.y - 8)
      .setAlpha(visible ? 0.68 + shieldRatio * 0.28 : 0)
      .setScale(pulse * 1.03, pulse * 1.03)
      .setVisible(visible);
  }

  private tryAttack(actor: RuntimeFighter, kind: AttackKind, time: number) {
    if (actor.attack || actor.cooldowns[kind] > time || actor.isBlocking) return;
    if (kind === "special" && actor.specialCharge < SPECIAL_CHARGE_MAX) return;
    const attack = actor.config.attacks[kind];
    const isProposalSlam = actor.config.id === "proposal-rock" && kind === "special";
    const isProposalMine = actor.config.id === "proposal-rock" && kind === "heavy";
    const isChelanZap = actor.config.id === "chelan" && kind === "special";
    actor.attack = isProposalSlam
      ? { kind, startedAt: time, hit: false, slam: { launched: false, impacted: false } }
      : { kind, startedAt: time, hit: false };
    if (kind === "special") actor.specialCharge = 0;
    actor.cooldowns[kind] = time + attack.cooldown;
    if (isProposalSlam) {
      actor.sprite.setVelocity(actor.facing * 390, -760);
      actor.sprite.setAngularVelocity(actor.facing * 105);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, "BODY SLAM");
      this.cameras.main.shake(80, 0.004);
      return;
    }
    if (isProposalMine) {
      actor.attack.hit = true;
      actor.sprite.setVelocityX(-actor.facing * 55);
      this.spawnStarfishMine(actor, time);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 132, "STARFISH MINE");
      this.time.delayedCall(180, () => {
        if (actor.attack?.kind === "heavy" && actor.config.id === "proposal-rock") actor.attack = undefined;
      });
      return;
    }
    if (isChelanZap) {
      actor.attack.hit = true;
      actor.sprite.setVelocityX(-actor.facing * 65);
      this.spawnChelanZap(actor, time);
      this.time.delayedCall(120, () => {
        if (actor.attack?.kind === "special" && actor.config.id === "chelan") actor.attack = undefined;
      });
      return;
    }
    actor.sprite.setVelocityX(actor.facing * Math.min(130, attack.knockback * 0.2));
  }

  private resolveAttacks(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (!actor.attack) return;
    if (actor.attack.slam) {
      this.resolveProposalSlam(actor, opponent, time);
      return;
    }
    const attack = actor.config.attacks[actor.attack.kind];
    const age = time - actor.attack.startedAt;
    const active = age >= attack.windup && age <= attack.windup + attack.active;
    actor.sprite.setAlpha(active ? 0.82 : 1);

    if (active && !actor.attack.hit && this.inAttackRange(actor, opponent, attack.range)) {
      actor.attack.hit = true;
      this.applyDamage(opponent, actor, actor.attack.kind);
    }

    if (age > attack.windup + attack.active + 90) {
      actor.attack = undefined;
      actor.sprite.setAlpha(1);
    }
  }

  private inAttackRange(actor: RuntimeFighter, opponent: RuntimeFighter, range: number) {
    const xDistance = Math.abs(actor.sprite.x - opponent.sprite.x);
    const yDistance = Math.abs(actor.sprite.y - opponent.sprite.y);
    const correctFacing = actor.facing === 1 ? opponent.sprite.x >= actor.sprite.x : opponent.sprite.x <= actor.sprite.x;
    return correctFacing && xDistance <= range && yDistance < 130;
  }

  private applyDamage(target: RuntimeFighter, attacker: RuntimeFighter, kind: AttackKind) {
    const attack = attacker.config.attacks[kind];
    const shielded = this.absorbDamageWithShield(target, attack.damage);
    this.awardSpecialChargeForHit(attacker, kind);
    if (shielded) this.addSpecialCharge(target, SPECIAL_CHARGE_ON_BLOCK);
    if (this.oceanBossActive && target === this.playerTwo) {
      this.createOceanSplash(target.sprite.x + attacker.facing * Phaser.Math.Between(24, 90), target.sprite.y - 70, kind === "special" ? "cross" : "breaker");
      this.flashMoveLabel(target.sprite.x, target.sprite.y - 158, kind === "special" ? "TIDE BROKEN" : "SPLASH");
      this.oceanBossSprite?.setTint(0xd7fbff);
      this.time.delayedCall(90, () => this.oceanBossSprite?.clearTint());
      this.cameras.main.shake(kind === "special" ? 120 : 60, kind === "special" ? 0.008 : 0.004);
      return;
    }
    target.sprite.setVelocityX(attacker.facing * attack.knockback * (shielded ? 0.34 : 1));
    target.sprite.setVelocityY(shielded ? -70 : -180);
    this.cameras.main.shake(kind === "special" ? 90 : 45, kind === "special" ? 0.006 : 0.003);
  }

  private absorbDamageWithShield(target: RuntimeFighter, rawDamage: number) {
    const defendedDamage = rawDamage * target.config.defense;
    if (target.isBlocking && target.shield > 0) {
      const shieldDamage = Math.min(target.shield, defendedDamage);
      target.shield = Math.max(0, target.shield - shieldDamage);
      target.shieldRechargePausedUntil = this.time.now + 950;
      this.createShieldHit(target);

      const overflow = defendedDamage - shieldDamage;
      if (overflow > 0) {
        target.health = Math.max(0, target.health - Math.round(overflow));
        this.flashMoveLabel(target.sprite.x, target.sprite.y - 118, "BREAK");
      }
      return true;
    }

    target.health = Math.max(0, target.health - Math.round(defendedDamage));
    return false;
  }

  private createShieldHit(target: RuntimeFighter) {
    const x = target.sprite.x + target.facing * 28;
    const y = target.sprite.y - 18;
    const burst = this.add.ellipse(x, y, 58, 86, 0xcaf8ff, 0.38).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: burst,
      scaleX: 2.2,
      scaleY: 1.5,
      alpha: 0,
      duration: 220,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
  }

  private awardSpecialChargeForHit(attacker: RuntimeFighter, kind: AttackKind) {
    if (kind === "special") return;
    this.addSpecialCharge(attacker, SPECIAL_CHARGE_ON_HIT[kind]);
  }

  private addSpecialCharge(actor: RuntimeFighter, amount: number) {
    if (amount <= 0 || actor.specialCharge >= SPECIAL_CHARGE_MAX) return;
    const previousCharge = actor.specialCharge;
    actor.specialCharge = Math.min(SPECIAL_CHARGE_MAX, actor.specialCharge + amount);
    if (previousCharge < SPECIAL_CHARGE_MAX && actor.specialCharge >= SPECIAL_CHARGE_MAX) {
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 154, "SPECIAL READY");
    }
  }

  private spawnStarfishMine(actor: RuntimeFighter, time: number) {
    const attack = actor.config.attacks.heavy;
    const x = Phaser.Math.Clamp(actor.sprite.x - actor.facing * 58, 88, this.scale.width - 88);
    const y = this.fightFloorY(this.scale.height) - 34;
    const warning = this.add.circle(0, 0, 42, 0xffef7d, 0.12).setStrokeStyle(2, 0xffef7d, 0.35);
    const star = this.add.image(0, 0, "projectile-starfish").setDisplaySize(82, 82);
    const object = this.add.container(x, y, [warning, star]).setDepth(6);

    this.tweens.add({
      targets: object,
      scaleX: 1.08,
      scaleY: 0.92,
      yoyo: true,
      repeat: -1,
      duration: 520,
      ease: "Sine.InOut",
    });

    this.starfishMines.push({
      object,
      owner: actor,
      damage: attack.damage,
      knockback: attack.knockback,
      radius: attack.range,
      armedAt: time + 420,
      expiresAt: time + 6500,
      triggered: false,
    });
  }

  private updateStarfishMines(time: number) {
    this.starfishMines = this.starfishMines.filter((mine) => {
      if (mine.triggered || time >= mine.expiresAt) {
        mine.object.destroy();
        return false;
      }

      const armed = time >= mine.armedAt;
      mine.object.setAlpha(armed ? 1 : 0.58);
      mine.object.rotation += this.game.loop.delta * 0.0008;

      const target = mine.owner === this.playerOne ? this.playerTwo : this.playerOne;
      const body = target.sprite.body as Phaser.Physics.Arcade.Body;
      const targetFootY = body.bottom;
      const xDistance = Math.abs(body.center.x - mine.object.x);
      const yDistance = Math.abs(targetFootY - mine.object.y);

      if (armed && xDistance <= mine.radius && yDistance <= 76) {
        mine.triggered = true;
        const shielded = this.absorbDamageWithShield(target, mine.damage);
        this.awardSpecialChargeForHit(mine.owner, "heavy");
        if (shielded) this.addSpecialCharge(target, SPECIAL_CHARGE_ON_BLOCK);
        const pushDirection = target.sprite.x < mine.object.x ? -1 : 1;
        target.sprite.setVelocityX(pushDirection * mine.knockback * (shielded ? 0.34 : 1));
        target.sprite.setVelocityY(shielded ? -190 : -330);
        this.createStarfishMineBurst(mine.object.x, mine.object.y);
        mine.object.destroy();
        return false;
      }

      return true;
    });
  }

  private createStarfishMineBurst(x: number, y: number) {
    this.cameras.main.shake(120, 0.009);
    const ring = this.add.circle(x, y, 20, 0xffef7d, 0.34).setStrokeStyle(5, 0xfff6b8, 0.8).setDepth(9);
    this.tweens.add({
      targets: ring,
      radius: 96,
      alpha: 0,
      duration: 320,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    for (let index = 0; index < 10; index += 1) {
      const shard = this.add.star(x, y, 5, 4, 11, 0xff8c62, 0.95).setDepth(10);
      this.tweens.add({
        targets: shard,
        x: x + Phaser.Math.Between(-130, 130),
        y: y - Phaser.Math.Between(28, 130),
        angle: Phaser.Math.Between(-220, 220),
        alpha: 0,
        duration: Phaser.Math.Between(280, 520),
        ease: "Cubic.Out",
        onComplete: () => shard.destroy(),
      });
    }
    this.flashMoveLabel(x, y - 76, "TRAPPED");
  }

  private spawnChelanZap(actor: RuntimeFighter, time: number) {
    const kind = this.pickBeachProjectileKind();
    const config = this.getBeachProjectileConfig(kind);
    const startX = actor.sprite.x + actor.facing * 110;
    const startY = actor.sprite.y - 28;
    const object = this.add
      .image(startX, startY, config.texture)
      .setDisplaySize(config.size, config.size)
      .setOrigin(0.5)
      .setAngle(actor.facing > 0 ? config.startAngle : -config.startAngle);

    this.projectiles.push({
      object,
      owner: actor,
      kind,
      damage: config.damage,
      knockback: config.knockback,
      radius: config.radius,
      velocityX: actor.facing * config.speed,
      velocityY: config.lift,
      expiresAt: time + 1300,
      hit: false,
    });

    const zap = this.add.line(startX - actor.facing * 62, startY, 0, 0, actor.facing * 84, Phaser.Math.Between(-14, 14), 0x7ee8ff, 0.85);
    zap.setLineWidth(5, 2);
    this.tweens.add({
      targets: zap,
      alpha: 0,
      scaleX: 1.45,
      duration: 170,
      ease: "Quad.Out",
      onComplete: () => zap.destroy(),
    });
    this.cameras.main.shake(kind === "person" ? 80 : 35, kind === "person" ? 0.006 : 0.0025);
  }

  private pickBeachProjectileKind(): BeachProjectileKind {
    const roll = Math.random();
    if (roll > 0.94) return "person";
    const common: BeachProjectileKind[] = ["beachBall", "shovel", "fish", "chair", "towel"];
    return Phaser.Utils.Array.GetRandom(common);
  }

  private getBeachProjectileConfig(kind: BeachProjectileKind) {
    const configs = {
      beachBall: { texture: "projectile-beachBall", damage: 10, knockback: 360, radius: 44, speed: 650, lift: -70, size: 58, startAngle: 0 },
      shovel: { texture: "projectile-shovel", damage: 14, knockback: 450, radius: 50, speed: 720, lift: -45, size: 66, startAngle: 28 },
      fish: { texture: "projectile-fish", damage: 12, knockback: 405, radius: 46, speed: 780, lift: -95, size: 64, startAngle: 0 },
      chair: { texture: "projectile-chair", damage: 16, knockback: 560, radius: 58, speed: 590, lift: -80, size: 72, startAngle: -12 },
      towel: { texture: "projectile-towel", damage: 9, knockback: 310, radius: 54, speed: 700, lift: -120, size: 74, startAngle: 18 },
      person: { texture: "projectile-person", damage: 19, knockback: 690, radius: 62, speed: 560, lift: -155, size: 76, startAngle: -16 },
    } satisfies Record<
      BeachProjectileKind,
      {
        texture: string;
        damage: number;
        knockback: number;
        radius: number;
        speed: number;
        lift: number;
        size: number;
        startAngle: number;
      }
    >;
    return configs[kind];
  }

  private updateProjectiles(time: number) {
    this.projectiles = this.projectiles.filter((projectile) => {
      if (projectile.hit || time >= projectile.expiresAt) {
        projectile.object.destroy();
        return false;
      }

      const delta = this.game.loop.delta / 1000;
      projectile.velocityY += 760 * delta;
      projectile.object.x += projectile.velocityX * delta;
      projectile.object.y += projectile.velocityY * delta;
      projectile.object.rotation += (projectile.velocityX > 0 ? 1 : -1) * delta * (projectile.kind === "towel" ? 5.5 : 8);

      const target = projectile.owner === this.playerOne ? this.playerTwo : this.playerOne;
      const xDistance = Math.abs(projectile.object.x - target.sprite.x);
      const yDistance = Math.abs(projectile.object.y - target.sprite.y);
      if (xDistance <= projectile.radius && yDistance <= projectile.radius + 58) {
        projectile.hit = true;
        const shielded = this.absorbDamageWithShield(target, projectile.damage);
        if (shielded) this.addSpecialCharge(target, SPECIAL_CHARGE_ON_BLOCK);
        target.sprite.setVelocityX(Math.sign(projectile.velocityX) * projectile.knockback * (shielded ? 0.35 : 1));
        target.sprite.setVelocityY(shielded ? -90 : -250);
        this.createProjectilePop(projectile.object.x, projectile.object.y, projectile.kind);
        projectile.object.destroy();
        return false;
      }

      if (projectile.object.x < -120 || projectile.object.x > this.scale.width + 120 || projectile.object.y > this.scale.height + 80) {
        projectile.object.destroy();
        return false;
      }
      return true;
    });
  }

  private createProjectilePop(x: number, y: number, kind: BeachProjectileKind) {
    const color = kind === "towel" ? 0xff9ad5 : kind === "fish" ? 0x9df1ff : kind === "person" ? 0xffef7d : 0xf3d98c;
    const burst = this.add.circle(x, y, 12, color, 0.82);
    this.tweens.add({
      targets: burst,
      radius: kind === "person" ? 52 : 38,
      alpha: 0,
      duration: 280,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
    this.cameras.main.shake(kind === "person" || kind === "chair" ? 95 : 55, kind === "person" ? 0.008 : 0.004);
  }

  private resolveProposalSlam(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (!actor.attack?.slam) return;
    const slam = actor.attack.slam;
    const attack = actor.config.attacks.special;
    const age = time - actor.attack.startedAt;
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;

    slam.launched = slam.launched || age > 110 || body.velocity.y < -80;
    actor.sprite.setAlpha(0.94);
    const slamScale = 1.08 + Math.sin(age / 55) * 0.035;
    actor.sprite.setScale(actor.baseScaleX * slamScale, actor.baseScaleY * slamScale);
    actor.sprite.setAngularVelocity(actor.facing * (body.velocity.y < 0 ? 105 : 170));

    if (!slam.impacted && slam.launched && age > 300 && body.blocked.down) {
      slam.impacted = true;
      actor.attack.hit = true;
      actor.sprite.setAngularVelocity(0);
      actor.sprite.setRotation(0);
      actor.sprite.setScale(actor.baseScaleX * 1.18, actor.baseScaleY * 0.82);
      actor.sprite.setVelocityX(0);
      this.createSlamImpact(actor.sprite.x, actor.sprite.y + 72);

      if (this.inSlamRange(actor, opponent, attack.range)) {
        this.applyDamage(opponent, actor, "special");
        opponent.sprite.setVelocityX(actor.facing * attack.knockback);
        opponent.sprite.setVelocityY(-360);
        this.flashMoveLabel(opponent.sprite.x, opponent.sprite.y - 130, "CRUSHED");
      }
    }

    if (slam.impacted && age > 680) {
      actor.attack = undefined;
      actor.sprite.setAlpha(1);
      actor.sprite.setScale(actor.baseScaleX, actor.baseScaleY);
      actor.sprite.setRotation(0);
    }

    if (!slam.impacted && age > 1400) {
      actor.attack = undefined;
      actor.sprite.setAlpha(1);
      actor.sprite.setScale(actor.baseScaleX, actor.baseScaleY);
      actor.sprite.setRotation(0);
      actor.sprite.setAngularVelocity(0);
    }
  }

  private inSlamRange(actor: RuntimeFighter, opponent: RuntimeFighter, range: number) {
    const xDistance = Math.abs(actor.sprite.x - opponent.sprite.x);
    const yDistance = Math.abs(actor.sprite.y - opponent.sprite.y);
    return xDistance <= range && yDistance < 185;
  }

  private createSlamImpact(x: number, y: number) {
    this.cameras.main.shake(180, 0.014);
    this.cameras.main.flash(90, 235, 220, 166, false);
    for (let index = 0; index < 3; index += 1) {
      const ring = this.add.ellipse(x, y, 70 + index * 42, 16 + index * 8, 0xf3d98c, 0.44 - index * 0.09);
      this.tweens.add({
        targets: ring,
        scaleX: 2.8 + index * 0.7,
        scaleY: 1.7 + index * 0.25,
        alpha: 0,
        duration: 420 + index * 120,
        ease: "Quad.Out",
        onComplete: () => ring.destroy(),
      });
    }
    for (let index = 0; index < 12; index += 1) {
      const pebble = this.add.circle(x, y - 8, Phaser.Math.Between(4, 9), 0x6f766d, 0.95);
      this.tweens.add({
        targets: pebble,
        x: x + Phaser.Math.Between(-185, 185),
        y: y - Phaser.Math.Between(26, 118),
        alpha: 0,
        duration: Phaser.Math.Between(360, 680),
        ease: "Cubic.Out",
        onComplete: () => pebble.destroy(),
      });
    }
    this.flashMoveLabel(x, y - 96, "BOOM");
  }

  private flashMoveLabel(x: number, y: number, label: string) {
    const text = this.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#102421",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: text,
      y: y - 44,
      scale: 1.24,
      alpha: 0,
      duration: 620,
      ease: "Quad.Out",
      onComplete: () => text.destroy(),
    });
  }

  private updateAi(time: number) {
    if (time < this.playerTwo.aiTimer) {
      this.playerTwo.controls = { ...blankControls(), ...this.playerTwo.aiPlan } as ButtonState;
      return;
    }

    const distance = this.playerOne.sprite.x - this.playerTwo.sprite.x;
    const absDistance = Math.abs(distance);
    const plan: Partial<ButtonState> = {};
    if (absDistance > 170) {
      plan.left = distance < 0;
      plan.right = distance > 0;
    } else if (absDistance < 72 && Math.random() < 0.4) {
      plan.left = distance > 0;
      plan.right = distance < 0;
    }

    const aggression = this.playerTwo.config.aiProfile === "aggressive" ? 0.78 : 0.58;
    if (absDistance < 96 && Math.random() < aggression) plan.light = true;
    else if (absDistance < 126 && Math.random() < 0.48) plan.heavy = true;
    else if (absDistance < 188 && this.playerTwo.specialCharge >= SPECIAL_CHARGE_MAX && Math.random() < 0.36) plan.special = true;
    if (this.playerOne.attack && Math.random() < (this.playerTwo.config.aiProfile === "defensive" ? 0.7 : 0.38)) plan.block = true;
    if (Math.random() < 0.08) plan.up = true;

    this.playerTwo.aiPlan = plan;
    this.playerTwo.controls = { ...blankControls(), ...plan } as ButtonState;
    this.playerTwo.aiTimer = time + Phaser.Math.Between(140, 330);
  }

  private isOnlineHost() {
    return this.selection.mode === "online-host";
  }

  private isOnlineGuest() {
    return this.selection.mode === "online-guest";
  }

  private createOnlineState(time: number): MatchNetState {
    const remainingTime = Math.max(0, this.roundTime - Math.floor((time - this.roundStartedAt) / 1000));
    return {
      playerOne: this.getFighterNetState(this.playerOne),
      playerTwo: this.getFighterNetState(this.playerTwo),
      roundNumber: this.roundNumber,
      remainingTime,
      roundOver: this.roundOver,
    };
  }

  private getFighterNetState(actor: RuntimeFighter) {
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;
    return {
      x: actor.sprite.x,
      y: actor.sprite.y,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      health: actor.health,
      shield: actor.shield,
      specialCharge: actor.specialCharge,
      rounds: actor.rounds,
      facing: actor.facing,
      isBlocking: actor.isBlocking,
    };
  }

  private applyOnlineState() {
    const state = onlineSession.latestState;
    if (!state) {
      this.onlineStatusText?.setText(`Waiting for host state in room ${onlineSession.roomCode || this.selection.roomCode || "----"}`);
      return;
    }

    this.roundNumber = state.roundNumber;
    this.roundStartedAt = this.time.now - (this.roundTime - state.remainingTime) * 1000;
    this.roundOver = state.roundOver;
    this.applyFighterNetState(this.playerOne, state.playerOne);
    this.applyFighterNetState(this.playerTwo, state.playerTwo);
    this.updateHud(this.time.now);
  }

  private applyFighterNetState(actor: RuntimeFighter, state: MatchNetState["playerOne"]) {
    actor.health = state.health;
    actor.shield = state.shield;
    actor.specialCharge = state.specialCharge;
    actor.rounds = state.rounds;
    actor.facing = state.facing;
    actor.isBlocking = state.isBlocking;
    actor.sprite.setPosition(state.x, state.y);
    actor.sprite.setVelocity(state.velocityX, state.velocityY);
    actor.sprite.setFlipX(state.facing === -1);
    actor.nameLabel.setPosition(actor.sprite.x, actor.sprite.y - 132);
    actor.sprite.setTint(actor.isBlocking ? 0xa8c6ff : actor.config.tint);
    this.updateShieldVisual(actor);
  }

  private updateHud(time: number) {
    const p1Ratio = Phaser.Math.Clamp(this.playerOne.health / this.playerOne.config.maxHealth, 0, 1);
    const p2Ratio = Phaser.Math.Clamp(this.playerTwo.health / this.playerTwo.config.maxHealth, 0, 1);
    const p1ShieldRatio =
      this.playerOne.config.maxShield > 0 ? Phaser.Math.Clamp(this.playerOne.shield / this.playerOne.config.maxShield, 0, 1) : 0;
    const p2ShieldRatio =
      this.playerTwo.config.maxShield > 0 ? Phaser.Math.Clamp(this.playerTwo.shield / this.playerTwo.config.maxShield, 0, 1) : 0;
    const p1SpecialRatio = Phaser.Math.Clamp(this.playerOne.specialCharge / SPECIAL_CHARGE_MAX, 0, 1);
    const p2SpecialRatio = Phaser.Math.Clamp(this.playerTwo.specialCharge / SPECIAL_CHARGE_MAX, 0, 1);
    this.healthBars[0].displayWidth = 420 * p1Ratio;
    this.healthBars[1].displayWidth = 420 * p2Ratio;
    this.shieldBars[0].displayWidth = 420 * p1ShieldRatio;
    this.shieldBars[1].displayWidth = 420 * p2ShieldRatio;
    this.specialBars[0].displayWidth = 420 * p1SpecialRatio;
    this.specialBars[1].displayWidth = 420 * p2SpecialRatio;
    this.shieldBars[0].setFillStyle(this.playerOne.isBlocking ? 0xcaf8ff : 0x7ee8ff);
    this.shieldBars[1].setFillStyle(this.playerTwo.isBlocking ? 0xcaf8ff : 0x7ee8ff);
    this.specialBars[0].setFillStyle(p1SpecialRatio >= 1 ? 0xffef7d : 0xffb84d);
    this.specialBars[1].setFillStyle(p2SpecialRatio >= 1 ? 0xffef7d : 0xffb84d);
    const remaining = Math.max(0, this.roundTime - Math.floor((time - this.roundStartedAt) / 1000));
    this.timerText?.setText(String(remaining));
    this.roundText?.setText(`Round ${this.roundNumber}    ${this.playerOne.rounds}-${this.playerTwo.rounds}`);
  }

  private finishRound() {
    this.roundOver = true;
    const p1Wins = this.playerOne.health === this.playerTwo.health ? this.playerOne.health > 0 : this.playerOne.health > this.playerTwo.health;
    const winner = p1Wins ? this.playerOne : this.playerTwo;
    winner.rounds += 1;

    const message = this.add
      .text(this.scale.width / 2, 170, `${winner.config.displayName} wins the round`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#fff7e6",
        fontStyle: "900",
        backgroundColor: "rgba(12, 25, 23, 0.7)",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      message.destroy();
      if (winner.rounds >= 2) {
        const result: MatchResult = {
          winnerName: winner.config.displayName,
          winnerId: winner.config.id,
          mode: this.selection.mode,
          levelId: this.selection.levelId,
        };
        if (this.isOnlineHost()) {
          onlineSession.sendMatchResult({ ...result, mode: "online-guest" });
        }
        this.scene.start("ResultScene", result);
        return;
      }
      this.roundNumber += 1;
      this.startRound();
    });
  }
}
