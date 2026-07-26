import Phaser from "phaser";
import { getFighter } from "../fighters";
import { getLevel } from "../levels";
import { onlineSession, type MatchNetState } from "../online";
import { drawCharacterSkinOverlay, type CharacterSkinConfig } from "../skins";
import type { AttackKind, FighterConfig, MatchResult, MatchSelection } from "../types";
import { getEquippedCharacterSkin } from "../victory";

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
  spinCharge?: {
    charging: boolean;
    launched: boolean;
    chargeStartedAt: number;
    chargeRatio: number;
    direction: 1 | -1;
  };
  chelanSlam?: {
    direction: 1 | -1;
    grabbed: boolean;
    grabbedAt: number;
    slammed: boolean;
    cutscene?: Phaser.GameObjects.Container;
  };
  ripRapSpikes?: {
    erupted: boolean;
  };
  duckHeavy?: {
    charging: boolean;
    chargeStartedAt: number;
    chargeRatio: number;
    direction: 1 | -1;
    summon?: Phaser.GameObjects.Container;
  };
};
type BeachProjectileKind = "beachBall" | "shovel" | "fish" | "chair" | "towel" | "person";
type OceanWaveKind = "breaker" | "cross" | "sneaker";

interface AbilityCooldownView {
  actor: RuntimeFighter;
  kind: AttackKind;
  overlay: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

interface TouchCooldownView {
  kind: AttackKind;
  overlay: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

interface TouchButtonView {
  action: ControlAction;
  ring: Phaser.GameObjects.Arc;
  button: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
}

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

interface ProposalTrashPrompt {
  object: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  action: ControlAction;
  targetY: number;
  velocityY: number;
  state: "falling" | "waiting";
  landedAt: number;
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

interface RollingRock {
  object: Phaser.GameObjects.Container;
  owner: RuntimeFighter;
  damage: number;
  knockback: number;
  radius: number;
  velocityX: number;
  hitActors: Set<RuntimeFighter>;
}

interface DuckFootball {
  object: Phaser.GameObjects.Container;
  owner: RuntimeFighter;
  damage: number;
  knockback: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  distanceTravelled: number;
  expiresAt: number;
  hit: boolean;
}

interface DuckRunner {
  object: Phaser.GameObjects.Container;
  owner: RuntimeFighter;
  damage: number;
  knockback: number;
  radius: number;
  velocityX: number;
  direction: 1 | -1;
  chargeUntil: number;
  launched: boolean;
  hit: boolean;
}

interface DuckMascotMotorcycle {
  object: Phaser.GameObjects.Container;
  owner: RuntimeFighter;
  centerX: number;
  centerY: number;
  angle: number;
  radiusX: number;
  radiusY: number;
  expiresAt: number;
  nextHitAt: number;
  damage: number;
  knockback: number;
}

interface RuntimeFighter {
  config: FighterConfig;
  sprite: Phaser.Physics.Arcade.Sprite;
  skin?: CharacterSkinConfig;
  skinOverlay?: Phaser.GameObjects.Image;
  nameLabel: Phaser.GameObjects.Text;
  shieldAura: Phaser.GameObjects.Ellipse;
  shieldEdge: Phaser.GameObjects.Ellipse;
  baseScaleX: number;
  baseScaleY: number;
  health: number;
  lives: number;
  respawningUntil: number;
  shield: number;
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

const COOLDOWN_HUD_ATTACK_KINDS: AttackKind[] = ["light", "heavy"];
const PROPOSAL_TRASH_ACTIONS: ControlAction[] = ["left", "right", "up", "down", "block", "light", "heavy", "special"];
const PROPOSAL_TRASH_DAMAGE_TO_BOSS = 18;
const PROPOSAL_TRASH_DAMAGE_TO_PLAYER = 12;
const PROPOSAL_TRASH_RESPONSE_MS = 3000;
const PROPOSAL_SPIN_CHARGE_MAX_MS = 1450;
const PROPOSAL_SPIN_LAUNCH_MS = 620;
const PROPOSAL_SPIN_MIN_RATIO = 0.24;
const DEFAULT_FIGHTER_MAX_VELOCITY_X = 430;
const DEFAULT_FIGHTER_MAX_VELOCITY_Y = 980;
const GROUND_HEIGHT = 34;
const FIGHTER_FOOT_INSET = GROUND_HEIGHT / 2;
const ARENA_CEILING_PADDING = 90;
const ARENA_FLOOR_SNAP_TOLERANCE = 8;
const ARENA_OUT_OF_BOUNDS_RECOVERY_PADDING = 180;
const FIGHTER_STACK_MIN_OVERLAP_X = 18;
const FIGHTER_STACK_CONTACT_TOLERANCE = 42;
const FIGHTER_STACK_SEPARATION = 14;
const FIGHTER_STACK_MAX_POSITION_PUSH = 64;
const FIGHTER_STACK_LOWER_PUSH_SPEED = 540;
const FIGHTER_STACK_UPPER_DRIFT_SPEED = 150;
const FIGHTER_STACK_DOWNWARD_VELOCITY = 190;
const CHELAN_SLAM_CUTSCENE_MS = 920;
const DUCK_HEAVY_CHARGE_MAX_MS = 1500;
const DUCK_HEAVY_MIN_RATIO = 0.18;
const DUCK_RUNNER_CHARGE_MS = 1000;
const DUCK_RUNNER_SPEED = 780;
const DUCK_MASCOT_DURATION_MS = 10000;
const SMASH_STARTING_LIVES = 3;
const SMASH_WORLD_WIDTH = 2100;
const SMASH_WORLD_HEIGHT = 980;
const SMASH_STAGE_FLOOR_Y = 660;
const SMASH_BLAST_PADDING_X = 260;
const SMASH_BLAST_TOP = -210;
const SMASH_BLAST_BOTTOM = 1040;
const SMASH_RESPAWN_MS = 920;
const SMASH_DAMAGE_BAR_CAP = 180;
const SMASH_KNOCKBACK_DAMAGE_SCALE = 0.009;

interface ArenaPlatform {
  x: number;
  y: number;
  width: number;
  height: number;
  tint: number;
  accent: number;
  passThrough?: boolean;
}

export class FightScene extends Phaser.Scene {
  private selection!: MatchSelection;
  private playerOne!: RuntimeFighter;
  private playerTwo!: RuntimeFighter;
  private ground?: Phaser.GameObjects.Rectangle;
  private arenaPlatforms: Phaser.GameObjects.Rectangle[] = [];
  private cameraTarget?: Phaser.GameObjects.Zone;
  private healthBars: Phaser.GameObjects.Rectangle[] = [];
  private shieldBars: Phaser.GameObjects.Rectangle[] = [];
  private healthTexts: Phaser.GameObjects.Text[] = [];
  private lifeTexts: Phaser.GameObjects.Text[] = [];
  private abilityCooldownViews: AbilityCooldownView[] = [];
  private touchCooldownViews: TouchCooldownView[] = [];
  private touchButtonViews: TouchButtonView[] = [];
  private timerText?: Phaser.GameObjects.Text;
  private roundText?: Phaser.GameObjects.Text;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private roundTime = 60;
  private roundStartedAt = 0;
  private roundOver = false;
  private roundNumber = 1;
  private projectiles: BeachProjectile[] = [];
  private starfishMines: StarfishMine[] = [];
  private rollingRocks: RollingRock[] = [];
  private duckFootballs: DuckFootball[] = [];
  private duckRunners: DuckRunner[] = [];
  private duckMascots: DuckMascotMotorcycle[] = [];
  private oceanBossActive = false;
  private oceanBossSprite?: Phaser.GameObjects.Image;
  private oceanBossFoam?: Phaser.GameObjects.Ellipse;
  private oceanWaves: OceanWave[] = [];
  private nextOceanWaveAt = 0;
  private nextSneakerWaveAt = 0;
  private proposalRockBossActive = false;
  private proposalRockBossSprite?: Phaser.GameObjects.Image;
  private proposalRockBossBaseScaleX = 1;
  private proposalRockBossBaseScaleY = 1;
  private proposalTrashPrompt?: ProposalTrashPrompt;
  private nextProposalTrashAt = 0;
  private previousProposalBossControls = blankControls();
  private proposalBossPromptText?: Phaser.GameObjects.Text;
  private proposalBossTimerText?: Phaser.GameObjects.Text;
  private lastOnlineStateAt = 0;
  private onlineStatusText?: Phaser.GameObjects.Text;
  private onlineCleanup?: () => void;

  constructor() {
    super("FightScene");
  }

  init(data: MatchSelection) {
    this.selection = { ...data, levelId: data.levelId ?? "neskowin" };
    this.oceanBossActive = this.selection.levelId === "ocean-boss";
    this.proposalRockBossActive = this.selection.levelId === "proposal-rock-boss";
    this.roundTime = 60;
    this.roundStartedAt = 0;
    this.roundOver = false;
    this.roundNumber = 1;
    this.healthBars = [];
    this.shieldBars = [];
    this.healthTexts = [];
    this.lifeTexts = [];
    this.arenaPlatforms = [];
    this.cameraTarget = undefined;
    this.abilityCooldownViews = [];
    this.touchCooldownViews = [];
    this.touchButtonViews = [];
    this.proposalTrashPrompt = undefined;
    this.previousProposalBossControls = blankControls();
    this.proposalBossPromptText = undefined;
    this.proposalBossTimerText = undefined;
    this.lastOnlineStateAt = 0;
    this.onlineStatusText = undefined;
  }

  create() {
    const { width, height } = this.scale;
    const level = getLevel(this.selection.levelId);
    if (this.isSmashArena()) {
      this.createNeskowinSmashArena(level.textureKey);
    } else {
      this.physics.world.setBounds(0, 0, width, height);
      this.cameras.main.setBounds(0, 0, width, height);
      this.cameras.main.setZoom(1);
      this.cameras.main.stopFollow();
      this.add.image(width / 2, height / 2, level.textureKey).setDisplaySize(width, height);
      this.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        this.oceanBossActive ? 0x071b24 : this.proposalRockBossActive ? 0x122016 : 0x0b1817,
        this.oceanBossActive || this.proposalRockBossActive ? 0.08 : 0.16,
      );
      if (this.oceanBossActive) this.createOceanBossArena();
      if (this.proposalRockBossActive) this.createProposalRockBossArena();

      this.ground = this.add.rectangle(width / 2, this.fightFloorY(height), width, GROUND_HEIGHT, 0x4a594e, 1);
      this.physics.add.existing(this.ground, true);
    }

    const playerOneConfig = getFighter(this.selection.playerOneId);
    const playerTwoConfig = getFighter(this.selection.playerTwoId);
    this.playerOne = this.createFighter(playerOneConfig, this.getSpawnX("left"), this.fighterSpawnY(height, playerOneConfig), 1, "P1");
    this.playerTwo = this.createFighter(
      playerTwoConfig,
      this.oceanBossActive || this.proposalRockBossActive ? width / 2 : this.getSpawnX("right"),
      this.fighterSpawnY(height, playerTwoConfig),
      -1,
      this.oceanBossActive || this.proposalRockBossActive ? "BOSS" : this.isAiBattle() ? "AI" : "P2",
    );
    if (this.oceanBossActive) this.configureOceanBossFighter();
    if (this.proposalRockBossActive) this.configureProposalRockBossFighter();
    if (this.proposalRockBossActive) this.configureProposalRockBossPlayerController();

    if (this.isSmashArena()) {
      this.arenaPlatforms.forEach((platform) => {
        this.physics.add.collider(this.playerOne.sprite, platform, undefined, this.canCollideWithArenaPlatform, this);
        this.physics.add.collider(this.playerTwo.sprite, platform, undefined, this.canCollideWithArenaPlatform, this);
      });
    } else if (!this.proposalRockBossActive && this.ground) this.physics.add.collider(this.playerOne.sprite, this.ground);
    if (!this.oceanBossActive && !this.proposalRockBossActive) {
      if (!this.isSmashArena() && this.ground) this.physics.add.collider(this.playerTwo.sprite, this.ground);
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
    return this.isSmashArena() ? SMASH_STAGE_FLOOR_Y : height - 250;
  }

  private fighterSpawnY(height: number, config: FighterConfig) {
    return this.fighterBaselineY(height) - this.getFighterDisplaySize(config).height / 2;
  }

  private fighterBaselineY(height: number) {
    return this.isSmashArena() ? SMASH_STAGE_FLOOR_Y - GROUND_HEIGHT / 2 : this.fightFloorY(height);
  }

  private isSmashArena() {
    return this.selection.levelId === "neskowin" && !this.oceanBossActive && !this.proposalRockBossActive;
  }

  private getSpawnX(side: "left" | "right") {
    if (!this.isSmashArena()) return side === "left" ? 260 : this.scale.width - 260;
    return SMASH_WORLD_WIDTH / 2 + (side === "left" ? -250 : 250);
  }

  private arenaLeft() {
    return this.isSmashArena() ? 0 : 0;
  }

  private arenaRight() {
    return this.isSmashArena() ? SMASH_WORLD_WIDTH : this.scale.width;
  }

  private createNeskowinSmashArena(textureKey: string) {
    const { width, height } = this.scale;
    this.physics.world.setBounds(-SMASH_BLAST_PADDING_X, SMASH_BLAST_TOP, SMASH_WORLD_WIDTH + SMASH_BLAST_PADDING_X * 2, SMASH_BLAST_BOTTOM - SMASH_BLAST_TOP);
    this.cameras.main.setBounds(0, 0, SMASH_WORLD_WIDTH, SMASH_WORLD_HEIGHT);
    this.cameras.main.setZoom(0.92);

    this.add.image(SMASH_WORLD_WIDTH / 2, height / 2, textureKey).setDisplaySize(SMASH_WORLD_WIDTH, height).setScrollFactor(0.16, 0.08).setDepth(-10);
    this.add.rectangle(SMASH_WORLD_WIDTH / 2, height / 2, SMASH_WORLD_WIDTH, height, 0x071210, 0.18).setScrollFactor(0.2, 0.1).setDepth(-9);
    this.add.rectangle(SMASH_WORLD_WIDTH / 2, SMASH_STAGE_FLOOR_Y + 98, SMASH_WORLD_WIDTH, 260, 0x133337, 0.58).setDepth(-4);

    const water = this.add.rectangle(SMASH_WORLD_WIDTH / 2, SMASH_STAGE_FLOOR_Y + 190, SMASH_WORLD_WIDTH + 600, 150, 0x2b788a, 0.5).setDepth(-3);
    this.tweens.add({ targets: water, alpha: 0.38, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(SMASH_WORLD_WIDTH / 2, 126, "NESKOWIN ARENA", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "38px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#102421",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(-2);

    const platforms: ArenaPlatform[] = [
      { x: SMASH_WORLD_WIDTH / 2, y: SMASH_STAGE_FLOOR_Y, width: 1080, height: 38, tint: 0x34413d, accent: 0xe8c66b },
      { x: SMASH_WORLD_WIDTH / 2 - 360, y: SMASH_STAGE_FLOOR_Y - 178, width: 360, height: 26, tint: 0x40524d, accent: 0x83d2c9, passThrough: true },
      { x: SMASH_WORLD_WIDTH / 2 + 360, y: SMASH_STAGE_FLOOR_Y - 178, width: 360, height: 26, tint: 0x40524d, accent: 0x83d2c9, passThrough: true },
      { x: SMASH_WORLD_WIDTH / 2, y: SMASH_STAGE_FLOOR_Y - 318, width: 430, height: 26, tint: 0x43524d, accent: 0xffef7d, passThrough: true },
    ];

    this.arenaPlatforms = platforms.map((platform) => this.createArenaPlatform(platform));
    this.cameraTarget = this.add.zone(SMASH_WORLD_WIDTH / 2, height / 2, 16, 16).setVisible(false);
    this.cameras.main.startFollow(this.cameraTarget, true, 0.08, 0.08);
  }

  private createArenaPlatform(platform: ArenaPlatform) {
    const base = this.add.rectangle(platform.x, platform.y, platform.width, platform.height, platform.tint, 1).setDepth(2);
    base.setData("passThrough", platform.passThrough === true);
    base.setStrokeStyle(3, platform.accent, 0.88);
    this.add.rectangle(platform.x, platform.y - platform.height / 2 - 5, platform.width - 18, 5, platform.accent, 0.78).setDepth(3);
    this.add.rectangle(platform.x, platform.y + platform.height / 2 + 14, platform.width * 0.92, 20, 0x071210, 0.22).setDepth(1);
    this.physics.add.existing(base, true);
    return base;
  }

  private canCollideWithArenaPlatform(
    fighterObject: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
    platformObject: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
  ) {
    const fighter = fighterObject as Phaser.Physics.Arcade.Sprite;
    const platform = platformObject as Phaser.GameObjects.Rectangle;
    if (!platform.getData("passThrough")) return true;

    const fighterBody = fighter.body as Phaser.Physics.Arcade.Body;
    const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;
    if (!fighterBody || !platformBody) return false;
    if (fighterBody.velocity.y < 0) return false;

    const previousBottom = fighterBody.bottom - Math.max(0, fighterBody.deltaY());
    return previousBottom <= platformBody.top + 8;
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
    this.add.rectangle(width / 2, this.fightFloorY(height) + FIGHTER_FOOT_INSET, width, GROUND_HEIGHT, 0x7a6746, 0.5).setDepth(2);
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
    this.playerTwo.sprite.setPosition(width / 2, this.fighterSpawnY(height, this.playerTwo.config));
    this.playerTwo.sprite.setVisible(false);
    this.playerTwo.sprite.setImmovable(true);
    (this.playerTwo.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.playerTwo.nameLabel.setVisible(false);
    this.playerTwo.skinOverlay?.setVisible(false);
    this.playerTwo.shieldAura.setVisible(false);
    this.playerTwo.shieldEdge.setVisible(false);
  }

  private createProposalRockBossArena() {
    const { width, height } = this.scale;
    const floorY = this.fighterBaselineY(height);
    this.add.rectangle(width / 2, this.fightFloorY(height) + FIGHTER_FOOT_INSET, width, GROUND_HEIGHT, 0x5a5039, 0.56).setDepth(2);
    this.add.ellipse(width / 2, floorY - 10, 600, 86, 0x121914, 0.34).setStrokeStyle(4, 0xf2d37a, 0.22).setDepth(2);
    this.proposalRockBossSprite = this.add.image(width / 2, floorY - 170, "fighter-proposal-rock").setDisplaySize(520, 390).setDepth(3);
    this.proposalRockBossBaseScaleX = this.proposalRockBossSprite.scaleX;
    this.proposalRockBossBaseScaleY = this.proposalRockBossSprite.scaleY;
    this.add
      .text(width / 2, 116, "Large Proposal Rock", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#f8fff4",
        fontStyle: "900",
        stroke: "#102421",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.proposalBossPromptText = this.add
      .text(width / 2, 160, "Pick up the trash when it lands", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#fff7e6",
        fontStyle: "900",
        backgroundColor: "rgba(12, 25, 23, 0.68)",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.proposalBossTimerText = this.add
      .text(width / 2, 198, "", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "30px",
        color: "#7ee889",
        fontStyle: "900",
        stroke: "#102421",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(40);
  }

  private configureProposalRockBossFighter() {
    const { width, height } = this.scale;
    this.playerTwo.sprite.setPosition(width / 2, this.fighterSpawnY(height, this.playerTwo.config));
    this.playerTwo.sprite.setVisible(false);
    this.playerTwo.sprite.setImmovable(true);
    (this.playerTwo.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.playerTwo.nameLabel.setVisible(false);
    this.playerTwo.skinOverlay?.setVisible(false);
    this.playerTwo.shieldAura.setVisible(false);
    this.playerTwo.shieldEdge.setVisible(false);
  }

  private configureProposalRockBossPlayerController() {
    this.playerOne.sprite.setPosition(-400, -400).setVelocity(0, 0).setVisible(false);
    this.playerOne.sprite.setImmovable(true);
    (this.playerOne.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.playerOne.nameLabel.setVisible(false);
    this.playerOne.skinOverlay?.setVisible(false);
    this.playerOne.shieldAura.setVisible(false);
    this.playerOne.shieldEdge.setVisible(false);
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
    else if (this.proposalRockBossActive) this.updateProposalRockBoss(time);
    else if (this.isAiBattle()) this.updateAi(time);

    if (!this.proposalRockBossActive) this.updateFighter(this.playerOne, this.playerTwo, time);
    if (!this.oceanBossActive && !this.proposalRockBossActive) this.updateFighter(this.playerTwo, this.playerOne, time);
    else this.updateOceanBossTarget();
    this.resolveFighterStacking();
    this.rechargeShields(time);
    if (!this.proposalRockBossActive) this.resolveAttacks(this.playerOne, this.playerTwo, time);
    if (!this.oceanBossActive && !this.proposalRockBossActive) this.resolveAttacks(this.playerTwo, this.playerOne, time);
    this.updateProjectiles(time);
    this.updateStarfishMines(time);
    this.updateRollingRocks(time);
    this.updateDuckFootballs(time);
    this.updateDuckRunners(time);
    this.updateDuckMascots(time);
    if (this.isSmashArena()) this.updateSmashArenaCamera();
    if (this.isSmashArena()) this.checkSmashBlastZones(time);
    this.clampActiveFightersToArena();
    this.updateHud(time);
    if (this.isOnlineHost() && time - this.lastOnlineStateAt >= 50) {
      this.lastOnlineStateAt = time;
      onlineSession.sendState(this.createOnlineState(time));
    }

    const elapsed = Math.floor((time - this.roundStartedAt) / 1000);
    const matchOver = this.isSmashArena() ? this.playerOne.lives <= 0 || this.playerTwo.lives <= 0 : this.playerOne.health <= 0 || this.playerTwo.health <= 0;
    if (elapsed >= this.roundTime || matchOver) {
      this.finishRound();
    }
  }

  private createFighter(config: FighterConfig, x: number, y: number, facing: 1 | -1, tag: string): RuntimeFighter {
    const sprite = this.physics.add.sprite(x, y, config.spriteKey);
    const displaySize = this.getFighterDisplaySize(config);
    sprite.setDisplaySize(displaySize.width, displaySize.height);
    sprite.setCollideWorldBounds(!this.isSmashArena());
    sprite.setDragX(1600);
    sprite.setMaxVelocity(DEFAULT_FIGHTER_MAX_VELOCITY_X, DEFAULT_FIGHTER_MAX_VELOCITY_Y);
    if (config.id === "proposal-rock") {
      this.setDisplayedBody(sprite, 188, 138);
    } else if (config.id === "chelan") {
      this.setDisplayedBody(sprite, 210, 118);
    } else if (config.id === "ocean") {
      this.setDisplayedBody(sprite, 198, 104);
    } else {
      this.setDisplayedBody(sprite, 108, 174);
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
    const skin = getEquippedCharacterSkin(config.id);
    const skinOverlay = drawCharacterSkinOverlay(this, skin, config.id, x, y, displaySize.width, sprite.depth + 1);

    return {
      config,
      sprite,
      skin,
      skinOverlay,
      nameLabel,
      shieldAura,
      shieldEdge,
      baseScaleX: sprite.scaleX,
      baseScaleY: sprite.scaleY,
      health: this.isSmashArena() ? 0 : config.maxHealth,
      lives: this.isSmashArena() ? SMASH_STARTING_LIVES : 0,
      respawningUntil: 0,
      shield: config.maxShield,
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

  private setDisplayedBody(sprite: Phaser.Physics.Arcade.Sprite, width: number, height: number) {
    const offsetX = (sprite.displayWidth - width) / 2;
    const offsetY = sprite.displayHeight - FIGHTER_FOOT_INSET - height;
    sprite.setBodySize(width / Math.abs(sprite.scaleX), height / Math.abs(sprite.scaleY), false);
    sprite.setOffset(offsetX / Math.abs(sprite.scaleX), offsetY / Math.abs(sprite.scaleY));
  }

  private getFighterDisplaySize(config: FighterConfig) {
    if (config.id === "proposal-rock") return { width: 230, height: 172 };
    if (config.id === "chelan") return { width: 250, height: 150 };
    if (config.id === "ocean") return { width: 230, height: 150 };
    return { width: 150, height: 190 };
  }

  private getShieldVisualSize(config: FighterConfig) {
    if (config.id === "proposal-rock") return { width: 290, height: 230 };
    if (config.id === "chelan") return { width: 305, height: 210 };
    if (config.id === "ocean") return { width: 305, height: 205 };
    return { width: 215, height: 255 };
  }

  private createHud() {
    const { width } = this.scale;
    this.add.rectangle(256, 39, 432, 24, 0x071210, 0.9).setStrokeStyle(2, 0xe8c66b).setScrollFactor(0).setDepth(80);
    this.add.rectangle(width - 256, 39, 432, 24, 0x071210, 0.9).setStrokeStyle(2, 0xe8c66b).setScrollFactor(0).setDepth(80);
    this.add.rectangle(256, 62, 432, 13, 0x071210, 0.82).setStrokeStyle(1, 0x7ee8ff, 0.72).setScrollFactor(0).setDepth(80);
    this.add.rectangle(width - 256, 62, 432, 13, 0x071210, 0.82).setStrokeStyle(1, 0x7ee8ff, 0.72).setScrollFactor(0).setDepth(80);
    this.healthBars = [
      this.add.rectangle(40, 39, 420, 16, this.isSmashArena() ? 0xffb84d : 0x56c271).setOrigin(0, 0.5).setScrollFactor(0).setDepth(81),
      this.add.rectangle(width - 40, 39, 420, 16, this.isSmashArena() ? 0xffb84d : 0x56c271).setOrigin(1, 0.5).setScrollFactor(0).setDepth(81),
    ];
    this.shieldBars = [
      this.add.rectangle(40, 62, 420, 7, 0x7ee8ff).setOrigin(0, 0.5).setScrollFactor(0).setDepth(81),
      this.add.rectangle(width - 40, 62, 420, 7, 0x7ee8ff).setOrigin(1, 0.5).setScrollFactor(0).setDepth(81),
    ];
    this.healthTexts = [
      this.add
        .text(42, 30, "0%", {
          fontFamily: "Impact, system-ui, sans-serif",
          fontSize: "31px",
          color: "#fff7e6",
          fontStyle: "900",
          stroke: "#102421",
          strokeThickness: 5,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(82),
      this.add
        .text(width - 42, 30, "0%", {
          fontFamily: "Impact, system-ui, sans-serif",
          fontSize: "31px",
          color: "#fff7e6",
          fontStyle: "900",
          stroke: "#102421",
          strokeThickness: 5,
        })
        .setOrigin(1, 0.5)
        .setScrollFactor(0)
        .setDepth(82),
    ];
    this.lifeTexts = [
      this.add.text(42, 82, "", { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: "#fff7e6", fontStyle: "900" }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(82),
      this.add.text(width - 42, 82, "", { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: "#fff7e6", fontStyle: "900" }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(82),
    ];
    if (this.proposalRockBossActive) {
      this.shieldBars.forEach((bar) => bar.setVisible(false));
      this.add
        .text(40, 82, "BEACH", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "15px",
          color: "#fff7e6",
          fontStyle: "900",
        })
        .setOrigin(0, 0.5);
      this.add
        .text(width - 40, 82, "BOSS", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "15px",
          color: "#fff7e6",
          fontStyle: "900",
        })
        .setOrigin(1, 0.5);
    } else {
      this.createAbilityCooldownHud(this.playerOne, 44, 82, 1);
      this.createAbilityCooldownHud(this.playerTwo, width - 44, 82, -1);
    }
    this.timerText = this.add
      .text(width / 2, 36, "60", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#fff7e6",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(82);
    this.roundText = this.add
      .text(width / 2, 84, "Round 1", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#dbe9df",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(82);
  }

  private createAbilityCooldownHud(actor: RuntimeFighter, startX: number, y: number, direction: 1 | -1) {
    const radius = 22;
    COOLDOWN_HUD_ATTACK_KINDS.forEach((kind, index) => {
      const x = startX + direction * index * 54;
      const slot = this.add.circle(x, y, radius, kind === "special" ? 0xffb84d : kind === "heavy" ? 0xf2d37a : 0xdbe9df, 0.94).setStrokeStyle(3, 0x102421, 0.95);
      slot.setScrollFactor(0);
      this.createTouchButtonIcon(x, y, kind, actor.config.id).setScale(0.58).setScrollFactor(0);
      const overlay = this.add.graphics().setScrollFactor(0);
      const text = this.add
        .text(x, y, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "17px",
          color: "#fff7e6",
          fontStyle: "900",
          stroke: "#102421",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
      this.abilityCooldownViews.push({ actor, kind, overlay, text });
    });
  }

  private createOnlineHud() {
    if (!this.isOnlineHost() && !this.isOnlineGuest()) return;
    const roomCode = onlineSession.roomCode || this.selection.roomCode || "----";
    const label = this.isOnlineHost() ? `Online host room ${roomCode}` : `Online remote room ${roomCode}`;
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
      .setScrollFactor(0)
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
    this.playerOne.keyboardControls.heavy =
      this.playerOne.config.id === "duck-flag" ? this.keys.p1Heavy.isDown : Phaser.Input.Keyboard.JustDown(this.keys.p1Heavy);
    this.playerOne.keyboardControls.special =
      this.playerOne.config.id === "proposal-rock" ? this.keys.p1Special.isDown : Phaser.Input.Keyboard.JustDown(this.keys.p1Special);
    this.playerOne.controls = this.mergeControls(this.playerOne.keyboardControls, this.playerOne.touchControls);

    if (this.selection.mode === "local") {
      this.playerTwo.keyboardControls.left = this.keys.p2Left.isDown;
      this.playerTwo.keyboardControls.right = this.keys.p2Right.isDown;
      this.playerTwo.keyboardControls.up = Phaser.Input.Keyboard.JustDown(this.keys.p2Up);
      this.playerTwo.keyboardControls.down = this.keys.p2Down.isDown;
      this.playerTwo.keyboardControls.block = this.keys.p2Block.isDown;
      this.playerTwo.keyboardControls.light = Phaser.Input.Keyboard.JustDown(this.keys.p2Light);
      this.playerTwo.keyboardControls.heavy =
        this.playerTwo.config.id === "duck-flag" ? this.keys.p2Heavy.isDown : Phaser.Input.Keyboard.JustDown(this.keys.p2Heavy);
      this.playerTwo.keyboardControls.special =
        this.playerTwo.config.id === "proposal-rock" ? this.keys.p2Special.isDown : Phaser.Input.Keyboard.JustDown(this.keys.p2Special);
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
    this.addTouchButton(136, height - 68, "", this.playerOne.touchControls, "block", "BLOCK");

    this.addTouchButton(width - 276, height - 102, "L", this.playerOne.touchControls, "light", "LIGHT", true);
    this.addTouchButton(width - 170, height - 102, "H", this.playerOne.touchControls, "heavy", "HEAVY", this.playerOne.config.id !== "duck-flag");
    this.addTouchButton(width - 64, height - 102, "S", this.playerOne.touchControls, "special", "SPECIAL", this.playerOne.config.id !== "proposal-rock");

    if (this.selection.mode === "local") {
      this.add
        .text(width / 2, height - 26, "Local keyboard controls enabled for Player 2", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: "#fff7e6",
          backgroundColor: "rgba(12, 25, 23, 0.55)",
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(82);
    } else if (this.isOnlineGuest()) {
      this.add
        .text(width / 2, height - 26, "Remote controls connected for this match", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: "#fff7e6",
          backgroundColor: "rgba(12, 25, 23, 0.55)",
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(82);
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
    const icon =
      isAttack || action === "block"
        ? this.createTouchButtonIcon(x, y, action)
        : this.add
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
      this.tweens.add({ targets: [button, icon], scale: 1, duration: 70, ease: "Back.Out" });
      this.tweens.add({ targets: ring, scale: 1, alpha: 1, duration: 90, ease: "Sine.Out" });
    };

    button.on("pointerdown", () => {
      controls[action] = true;
      button.setFillStyle(activeColor, 1);
      this.input.manager.canvas.style.cursor = "pointer";
      this.triggerHaptic(action);
      this.tweens.add({ targets: [button, icon], scale: 0.88, duration: 55, ease: "Sine.Out" });
      this.tweens.add({ targets: ring, scale: 1.22, alpha: 0.42, duration: 120, ease: "Sine.Out" });
      this.popTouchFeedback(x, y - 64, caption, isAttack ? 0xffef7d : 0xd4e7ff);
      if (pulse) this.time.delayedCall(125, release);
    });
    button.on("pointerup", release);
    button.on("pointerupoutside", release);
    button.on("pointerout", release);

    captionText.setInteractive({ useHandCursor: true });
    if (isAttack) {
      const overlay = this.add.graphics().setScrollFactor(0);
      const cooldownText = this.add
        .text(x, y, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "21px",
          color: "#fff7e6",
          fontStyle: "900",
          stroke: "#102421",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
      this.touchCooldownViews.push({ kind: action as AttackKind, overlay, text: cooldownText });
    }
    this.touchButtonViews.push({ action, ring, button, icon });
  }

  private createTouchButtonIcon(x: number, y: number, action: ControlAction, fighterId = this.playerOne.config.id) {
    const icon = this.add.graphics().setScrollFactor(0);
    icon.setPosition(x, y);
    if (action === "block") {
      icon.fillStyle(0x102421, 1);
      icon.fillRoundedRect(-15, -21, 30, 38, 8);
      icon.fillStyle(0xd4e7ff, 1);
      icon.fillTriangle(0, -13, 11, -4, -11, -4);
      icon.fillRect(-8, -1, 16, 11);
      return icon;
    }

    const kind = action as AttackKind;
    icon.lineStyle(4, 0x102421, 1);
    icon.fillStyle(0x102421, 1);

    switch (`${fighterId}:${kind}`) {
      case "proposal-rock:light":
        icon.fillStyle(0xffef7d, 1);
        icon.fillPoints(this.makeStarPoints(0, 0, 5, 7, 21), true);
        icon.lineStyle(3, 0x102421, 1);
        icon.strokePoints(this.makeStarPoints(0, 0, 5, 7, 21), true);
        break;
      case "proposal-rock:heavy":
        icon.fillTriangle(-17, 11, 17, 11, 0, -22);
        icon.strokeLineShape(new Phaser.Geom.Line(-22, 19, 22, 19));
        break;
      case "proposal-rock:special":
        icon.strokeCircle(0, 0, 18);
        icon.beginPath();
        icon.arc(0, 0, 22, Phaser.Math.DegToRad(212), Phaser.Math.DegToRad(18), false);
        icon.strokePath();
        icon.fillTriangle(19, -12, 24, 4, 8, -2);
        icon.strokeLineShape(new Phaser.Geom.Line(-19, 12, 19, -12));
        break;
      case "chelan:light":
        icon.strokeCircle(0, 0, 15);
        icon.strokeLineShape(new Phaser.Geom.Line(-20, 0, 20, 0));
        icon.strokeLineShape(new Phaser.Geom.Line(0, -20, 0, 20));
        break;
      case "chelan:heavy":
        icon.fillStyle(0x7ee8ff, 1);
        icon.fillCircle(0, 0, 17);
        icon.lineStyle(3, 0x102421, 1);
        icon.strokeCircle(0, 0, 17);
        icon.strokeLineShape(new Phaser.Geom.Line(-17, 0, 17, 0));
        icon.strokeLineShape(new Phaser.Geom.Line(0, -17, 0, 17));
        break;
      case "chelan:special":
        icon.fillStyle(0xffef7d, 1);
        icon.fillPoints(this.makeStarPoints(0, -2, 5, 8, 22), true);
        icon.lineStyle(3, 0x102421, 1);
        icon.strokePoints(this.makeStarPoints(0, -2, 5, 8, 22), true);
        icon.strokeLineShape(new Phaser.Geom.Line(-18, 20, 18, 20));
        break;
      case "ocean:light":
        icon.fillCircle(0, 6, 13);
        icon.fillTriangle(0, -22, -12, 5, 12, 5);
        break;
      case "ocean:heavy":
        icon.strokeLineShape(new Phaser.Geom.Line(-24, 8, -10, -5));
        icon.strokeLineShape(new Phaser.Geom.Line(-10, -5, 4, 8));
        icon.strokeLineShape(new Phaser.Geom.Line(4, 8, 22, -6));
        break;
      case "ocean:special":
        icon.strokeCircle(-8, 3, 13);
        icon.strokeCircle(9, -3, 13);
        icon.strokeLineShape(new Phaser.Geom.Line(-21, 17, 21, 17));
        break;
      case "rip-rap:light":
        icon.fillTriangle(-15, 16, -2, -20, 10, 16);
        icon.fillTriangle(2, 16, 16, -8, 23, 16);
        break;
      case "rip-rap:heavy":
        icon.fillTriangle(-19, 17, -7, -19, 4, 17);
        icon.fillTriangle(-2, 17, 9, -24, 21, 17);
        icon.strokeLineShape(new Phaser.Geom.Line(-23, 18, 23, 18));
        break;
      case "rip-rap:special":
        icon.fillCircle(0, 1, 18);
        icon.lineStyle(3, 0xdbe9df, 1);
        icon.strokeLineShape(new Phaser.Geom.Line(-12, -3, 11, 8));
        icon.strokeLineShape(new Phaser.Geom.Line(-2, -14, 13, -4));
        break;
      case "the-house:light":
        icon.strokeRect(-17, -9, 34, 24);
        icon.strokeLineShape(new Phaser.Geom.Line(-20, -9, 0, -24));
        icon.strokeLineShape(new Phaser.Geom.Line(20, -9, 0, -24));
        break;
      case "the-house:heavy":
        icon.strokeLineShape(new Phaser.Geom.Line(-20, 8, 8, -20));
        icon.fillRect(6, -23, 15, 9);
        icon.fillRect(-23, 8, 10, 12);
        break;
      case "the-house:special":
        icon.strokeCircle(0, 0, 19);
        icon.strokeLineShape(new Phaser.Geom.Line(-17, 5, 17, -5));
        icon.fillCircle(18, -6, 5);
        break;
      case "duck-flag:light":
        icon.fillStyle(0x154733, 1);
        icon.fillCircle(-8, 7, 12);
        icon.fillRect(-5, -14, 9, 30);
        icon.fillCircle(9, -9, 9);
        icon.lineStyle(3, 0xffef7d, 1);
        icon.strokeLineShape(new Phaser.Geom.Line(-22, 17, 20, 17));
        break;
      case "duck-flag:heavy":
        icon.fillStyle(0x8b5a2b, 1);
        icon.fillEllipse(0, 1, 28, 18);
        icon.lineStyle(3, 0x102421, 1);
        icon.strokeEllipse(0, 1, 28, 18);
        icon.lineStyle(2, 0xffffff, 1);
        icon.strokeLineShape(new Phaser.Geom.Line(-8, 1, 8, 1));
        break;
      case "duck-flag:special":
        icon.fillStyle(0x154733, 1);
        icon.fillCircle(-12, 11, 7);
        icon.fillCircle(13, 11, 7);
        icon.strokeLineShape(new Phaser.Geom.Line(-18, 4, 18, 4));
        icon.fillRect(-5, -15, 16, 13);
        break;
      default:
        icon.fillCircle(0, 0, 15);
        icon.lineStyle(3, 0xffef7d, 1);
        icon.strokeCircle(0, 0, 8);
    }

    return icon;
  }

  private makeStarPoints(x: number, y: number, points: number, innerRadius: number, outerRadius: number) {
    const result: Phaser.Math.Vector2[] = [];
    const total = points * 2;
    for (let index = 0; index < total; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
      result.push(new Phaser.Math.Vector2(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
    }
    return result;
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
    this.playerOne.health = this.isSmashArena() ? 0 : this.playerOne.config.maxHealth;
    this.playerTwo.health = this.isSmashArena() ? 0 : this.playerTwo.config.maxHealth;
    this.playerOne.lives = this.isSmashArena() ? SMASH_STARTING_LIVES : 0;
    this.playerTwo.lives = this.isSmashArena() ? SMASH_STARTING_LIVES : 0;
    this.playerOne.respawningUntil = 0;
    this.playerTwo.respawningUntil = 0;
    this.playerOne.shield = this.playerOne.config.maxShield;
    this.playerTwo.shield = this.playerTwo.config.maxShield;
    this.playerOne.shieldRechargePausedUntil = 0;
    this.playerTwo.shieldRechargePausedUntil = 0;
    this.playerOne.sprite.setPosition(this.oceanBossActive || this.proposalRockBossActive ? 290 : this.getSpawnX("left"), this.fighterSpawnY(height, this.playerOne.config)).setVelocity(0, 0);
    this.playerOne.sprite.setAlpha(1).setRotation(0).setAngularVelocity(0);
    this.setFighterScale(this.playerOne, this.playerOne.baseScaleX, this.playerOne.baseScaleY);
    this.playerOne.sprite.setMaxVelocity(DEFAULT_FIGHTER_MAX_VELOCITY_X, DEFAULT_FIGHTER_MAX_VELOCITY_Y);
    (this.playerOne.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    this.playerTwo.sprite.setPosition(this.oceanBossActive || this.proposalRockBossActive ? width / 2 : this.getSpawnX("right"), this.fighterSpawnY(height, this.playerTwo.config)).setVelocity(0, 0);
    this.playerTwo.sprite.setAlpha(1).setRotation(0).setAngularVelocity(0);
    this.setFighterScale(this.playerTwo, this.playerTwo.baseScaleX, this.playerTwo.baseScaleY);
    this.playerTwo.sprite.setMaxVelocity(DEFAULT_FIGHTER_MAX_VELOCITY_X, DEFAULT_FIGHTER_MAX_VELOCITY_Y);
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
    this.clearActiveAttack(this.playerOne);
    this.clearActiveAttack(this.playerTwo);
    this.updateShieldVisual(this.playerOne);
    this.updateShieldVisual(this.playerTwo);
    this.projectiles.forEach((projectile) => projectile.object.destroy());
    this.projectiles = [];
    this.starfishMines.forEach((mine) => mine.object.destroy());
    this.starfishMines = [];
    this.rollingRocks.forEach((rock) => rock.object.destroy());
    this.rollingRocks = [];
    this.duckFootballs.forEach((football) => football.object.destroy());
    this.duckFootballs = [];
    this.duckRunners.forEach((runner) => runner.object.destroy());
    this.duckRunners = [];
    this.duckMascots.forEach((mascot) => mascot.object.destroy());
    this.duckMascots = [];
    this.oceanWaves.forEach((wave) => this.destroyOceanWave(wave));
    this.oceanWaves = [];
    this.nextOceanWaveAt = this.time.now + 900;
    this.nextSneakerWaveAt = this.time.now + Phaser.Math.Between(16000, 23000);
    this.destroyProposalTrashPrompt();
    this.nextProposalTrashAt = this.time.now + 850;
    this.previousProposalBossControls = { ...this.playerOne.controls };
    this.updateProposalTouchButtonGlow();
    this.proposalBossTimerText?.setText("");
    if (this.oceanBossActive) {
      this.playerTwo.sprite.setVisible(false);
      this.playerTwo.nameLabel.setVisible(false);
      this.playerTwo.skinOverlay?.setVisible(false);
      this.flashMoveLabel(width / 2, 176, "DODGE THE BREAKERS");
    } else if (this.proposalRockBossActive) {
      this.configureProposalRockBossPlayerController();
      this.playerTwo.sprite.setVisible(false);
      this.playerTwo.nameLabel.setVisible(false);
      this.playerTwo.skinOverlay?.setVisible(false);
      this.proposalRockBossSprite?.clearTint();
      this.flashMoveLabel(width / 2, 176, "CLEAN THE BEACH");
    } else if (this.isSmashArena()) {
      this.cameras.main.centerOn(SMASH_WORLD_WIDTH / 2, this.scale.height / 2);
      this.flashMoveLabel(SMASH_WORLD_WIDTH / 2, 244, "3 STOCK BATTLE");
    }
  }

  private updateFighter(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (this.isSmashArena() && time < actor.respawningUntil) {
      actor.sprite.setVelocity(0, 0);
      actor.sprite.setAlpha(0.52 + Math.sin(time / 65) * 0.18);
      this.syncFighterAttachments(actor);
      return;
    }
    if (this.isSmashArena() && actor.sprite.alpha < 1) actor.sprite.setAlpha(1);
    const controls = actor.controls;
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;
    actor.facing = actor.sprite.x <= opponent.sprite.x ? 1 : -1;
    actor.sprite.setFlipX(actor.facing === -1);
    this.syncFighterAttachments(actor);
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

    const attacksDisabled = this.proposalRockBossActive && actor === this.playerOne;
    if (!attacksDisabled && controls.light) this.tryAttack(actor, "light", time);
    if (!attacksDisabled && controls.heavy) this.tryAttack(actor, "heavy", time);
    if (!attacksDisabled && controls.special) this.tryAttack(actor, "special", time);
    if (actor.attack?.spinCharge?.charging) {
      actor.sprite.setVelocityX(0);
    }
    if (actor.attack?.duckHeavy?.charging) {
      actor.sprite.setVelocityX(0);
    }

    actor.sprite.setTint(actor.isBlocking ? 0xa8c6ff : actor.config.tint);
    this.updateShieldVisual(actor);
    this.syncFighterAttachments(actor);
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
    this.playerTwo.sprite.setPosition(width / 2, this.fighterSpawnY(height, this.playerTwo.config));
    this.playerTwo.sprite.setVelocity(0, 0);
    this.playerTwo.facing = this.playerOne.sprite.x <= width / 2 ? -1 : 1;
    this.playerTwo.isBlocking = false;
  }

  private updateProposalRockBoss(time: number) {
    const pulse = 1 + Math.sin(time / 520) * 0.018;
    this.proposalRockBossSprite?.setScale(this.proposalRockBossBaseScaleX * pulse, this.proposalRockBossBaseScaleY * (1 + Math.sin(time / 680) * 0.012));

    if (!this.proposalTrashPrompt && time >= this.nextProposalTrashAt) {
      this.spawnProposalTrashPrompt(time);
    }

    this.updateProposalTrashPrompt(time);
    this.updateProposalTouchButtonGlow();
    this.previousProposalBossControls = { ...this.playerOne.controls };
  }

  private spawnProposalTrashPrompt(time: number) {
    const { width, height } = this.scale;
    const kind = this.pickBeachProjectileKind();
    const config = this.getBeachProjectileConfig(kind);
    const x = Phaser.Math.Between(170, width - 170);
    const targetY = this.fightFloorY(height) - 45;
    const shadow = this.add.ellipse(x, targetY + 18, 42, 12, 0x071210, 0.18).setDepth(4);
    const warning = this.add.circle(0, 0, 34, 0xffef7d, 0.16).setStrokeStyle(3, 0xffef7d, 0.48);
    const trash = this.add.image(0, 0, config.texture).setDisplaySize(config.size, config.size).setAngle(config.startAngle);
    const object = this.add.container(x, -70, [warning, trash]).setDepth(12);

    this.proposalTrashPrompt = {
      object,
      shadow,
      action: Phaser.Utils.Array.GetRandom(PROPOSAL_TRASH_ACTIONS),
      targetY,
      velocityY: Phaser.Math.Between(360, 460),
      state: "falling",
      landedAt: 0,
      expiresAt: time + 6200,
    };
    this.proposalBossPromptText?.setText("Trash incoming");
  }

  private updateProposalTrashPrompt(time: number) {
    const prompt = this.proposalTrashPrompt;
    if (!prompt) {
      this.proposalBossTimerText?.setText("");
      return;
    }

    const delta = this.game.loop.delta / 1000;
    if (prompt.state === "falling") {
      prompt.velocityY += 520 * delta;
      prompt.object.y += prompt.velocityY * delta;
      prompt.object.rotation += delta * 3.8;
      const shadowScale = Phaser.Math.Clamp(prompt.object.y / prompt.targetY, 0.18, 1);
      prompt.shadow.setScale(0.55 + shadowScale * 0.8, 0.55 + shadowScale * 0.42).setAlpha(0.1 + shadowScale * 0.28);

      if (prompt.object.y >= prompt.targetY) {
        prompt.object.y = prompt.targetY;
        prompt.object.rotation = 0;
        prompt.state = "waiting";
        prompt.landedAt = time;
        prompt.expiresAt = time + PROPOSAL_TRASH_RESPONSE_MS;
        this.proposalBossPromptText?.setText(`Press ${this.getActionLabel(prompt.action)} to pick up trash`);
        this.flashMoveLabel(prompt.object.x, prompt.object.y - 74, this.getActionLabel(prompt.action));
      }
      return;
    }

    const remaining = Math.max(0, prompt.expiresAt - time);
    this.proposalBossTimerText?.setText(`${(remaining / 1000).toFixed(1)}s`);
    prompt.object.setScale(1 + Math.sin(time / 70) * 0.055);

    const pressedAction = PROPOSAL_TRASH_ACTIONS.find((action) => this.playerOne.controls[action] && !this.previousProposalBossControls[action]);
    if (pressedAction === prompt.action) {
      this.resolveProposalTrashPrompt(true, "PICKED UP");
    } else if (pressedAction) {
      this.resolveProposalTrashPrompt(false, "WRONG BUTTON");
    } else if (time >= prompt.expiresAt) {
      this.resolveProposalTrashPrompt(false, "TOO LATE");
    }
  }

  private resolveProposalTrashPrompt(success: boolean, label: string) {
    const prompt = this.proposalTrashPrompt;
    if (!prompt) return;
    const color = success ? 0x6ff06f : 0xff4f45;
    if (success) {
      this.playerTwo.health = Math.max(0, this.playerTwo.health - PROPOSAL_TRASH_DAMAGE_TO_BOSS);
      this.proposalRockBossSprite?.setTint(0x96ff8d);
      this.time.delayedCall(110, () => this.proposalRockBossSprite?.clearTint());
      this.cameras.main.flash(90, 126, 232, 111, false);
      this.cameras.main.shake(105, 0.006);
    } else {
      this.playerOne.health = Math.max(0, this.playerOne.health - PROPOSAL_TRASH_DAMAGE_TO_PLAYER);
      this.cameras.main.flash(100, 255, 72, 60, false);
      this.cameras.main.shake(150, 0.01);
    }
    this.createProposalTrashEffect(prompt.object.x, prompt.object.y, color, success);
    this.flashMoveLabel(prompt.object.x, prompt.object.y - 82, label);
    this.destroyProposalTrashPrompt();
    this.nextProposalTrashAt = this.time.now + Phaser.Math.Between(650, 1150);
    this.proposalBossPromptText?.setText(success ? "Trash cleaned" : "Trash hit the beach");
    this.proposalBossTimerText?.setText("");
  }

  private createProposalTrashEffect(x: number, y: number, color: number, success: boolean) {
    const ring = this.add.circle(x, y, 18, color, 0.28).setStrokeStyle(5, color, 0.88).setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      radius: success ? 86 : 66,
      alpha: 0,
      duration: 360,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    for (let index = 0; index < (success ? 14 : 9); index += 1) {
      const spark = this.add.circle(x, y, Phaser.Math.Between(4, 8), color, 0.9).setDepth(17);
      this.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-120, 120),
        y: y - Phaser.Math.Between(24, 120),
        alpha: 0,
        duration: Phaser.Math.Between(260, 520),
        ease: "Cubic.Out",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private destroyProposalTrashPrompt() {
    if (!this.proposalTrashPrompt) return;
    this.proposalTrashPrompt.object.destroy();
    this.proposalTrashPrompt.shadow.destroy();
    this.proposalTrashPrompt = undefined;
    this.updateProposalTouchButtonGlow();
  }

  private updateProposalTouchButtonGlow() {
    const activeAction = this.proposalTrashPrompt?.state === "waiting" ? this.proposalTrashPrompt.action : undefined;
    for (const view of this.touchButtonViews) {
      const active = view.action === activeAction;
      const isAttack = view.action === "light" || view.action === "heavy" || view.action === "special";
      view.ring.setStrokeStyle(active ? 7 : 3, active ? 0x7ee889 : 0xfff2ba, active ? 0.95 : 0.42);
      view.ring.setFillStyle(active ? 0x7ee889 : 0x102421, active ? 0.25 : 0.42);
      view.button.setStrokeStyle(active ? 6 : 3, active ? 0x7ee889 : 0x102421, 1);
      if (active) {
        view.button.setFillStyle(0xf8fff4, 1);
        view.icon.setScale(1.12 + Math.sin(this.time.now / 92) * 0.05);
      } else {
        view.button.setFillStyle(isAttack ? 0xffb84d : view.action === "block" ? 0x9bc2ff : 0xf2d37a, 0.9);
        view.icon.setScale(1);
      }
    }
  }

  private getActionLabel(action: ControlAction) {
    const labels: Record<ControlAction, string> = {
      left: "LEFT",
      right: "RIGHT",
      up: "UP",
      down: "DOWN",
      block: "BLOCK",
      light: "LIGHT",
      heavy: "HEAVY",
      special: "SPECIAL",
    };
    return labels[action];
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
    const attack = actor.config.attacks[kind];
    const isProposalSlam = actor.config.id === "proposal-rock" && kind === "heavy";
    const isProposalMine = actor.config.id === "proposal-rock" && kind === "light";
    const isProposalSpinCharge = actor.config.id === "proposal-rock" && kind === "special";
    const isChelanBeachThrow = actor.config.id === "chelan" && kind === "heavy";
    const isChelanSlam = actor.config.id === "chelan" && kind === "special";
    const isRipRapTopSpikes = actor.config.id === "rip-rap" && kind === "heavy";
    const isRipRapRollingRock = actor.config.id === "rip-rap" && kind === "special";
    const isDuckLightRush = actor.config.id === "duck-flag" && kind === "light";
    const isDuckHeavyThrow = actor.config.id === "duck-flag" && kind === "heavy";
    const isDuckMascotSpecial = actor.config.id === "duck-flag" && kind === "special";
    actor.attack = isProposalSlam
      ? { kind, startedAt: time, hit: false, slam: { launched: false, impacted: false } }
      : isProposalSpinCharge
        ? {
            kind,
            startedAt: time,
            hit: false,
            spinCharge: {
              charging: true,
              launched: false,
              chargeStartedAt: time,
              chargeRatio: 0,
              direction: actor.facing,
            },
          }
        : isChelanSlam
          ? {
              kind,
              startedAt: time,
              hit: false,
              chelanSlam: {
                direction: actor.facing,
                grabbed: false,
                grabbedAt: 0,
                slammed: false,
              },
            }
          : isRipRapTopSpikes
            ? { kind, startedAt: time, hit: false, ripRapSpikes: { erupted: false } }
            : isDuckHeavyThrow
              ? {
                  kind,
                  startedAt: time,
                  hit: false,
                  duckHeavy: {
                    charging: true,
                    chargeStartedAt: time,
                    chargeRatio: 0,
                    direction: actor.facing,
                  },
                }
              : { kind, startedAt: time, hit: false };
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
      this.spawnStarfishMine(actor, time, kind);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 132, "STARFISH MINE");
      this.time.delayedCall(180, () => {
        if (actor.attack?.kind === "light" && actor.config.id === "proposal-rock") actor.attack = undefined;
      });
      return;
    }
    if (isProposalSpinCharge) {
      actor.sprite.setVelocityX(0);
      actor.sprite.setAngularVelocity(actor.facing * 260);
      actor.sprite.setTint(0xffef7d);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, "CHARGE");
      return;
    }
    if (isChelanBeachThrow) {
      actor.attack.hit = true;
      actor.sprite.setVelocityX(-actor.facing * 65);
      this.spawnChelanBeachThrow(actor, time);
      this.time.delayedCall(120, () => {
        if (actor.attack?.kind === "heavy" && actor.config.id === "chelan") actor.attack = undefined;
      });
      return;
    }
    if (isChelanSlam) {
      actor.sprite.setVelocityX(actor.facing * 360);
      actor.sprite.setTint(0xffef7d);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, "SHOWTIME");
      this.cameras.main.shake(70, 0.004);
      return;
    }
    if (isRipRapTopSpikes) {
      actor.sprite.setVelocityX(0);
      actor.sprite.setTint(0xd9ded1);
      this.setFighterScale(actor, actor.baseScaleX * 1.08, actor.baseScaleY * 0.95);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 142, "SPIKE CROWN");
      return;
    }
    if (isRipRapRollingRock) {
      actor.attack.hit = true;
      actor.sprite.setVelocityX(-actor.facing * 70);
      actor.sprite.setTint(0xd9ded1);
      this.spawnRipRapRollingRock(actor);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, "ROCK ROLL");
      this.time.delayedCall(180, () => {
        if (actor.attack?.kind === "special" && actor.config.id === "rip-rap") this.clearActiveAttack(actor);
      });
      return;
    }
    if (isDuckLightRush) {
      actor.attack.hit = true;
      actor.sprite.setVelocityX(-actor.facing * 52);
      this.spawnDuckRunner(actor, time);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, "LAMICHAEL");
      this.time.delayedCall(140, () => {
        if (actor.attack?.kind === "light" && actor.config.id === "duck-flag") this.clearActiveAttack(actor);
      });
      return;
    }
    if (isDuckHeavyThrow) {
      actor.sprite.setVelocityX(0);
      actor.sprite.setTint(0xffef7d);
      actor.attack.duckHeavy!.summon = this.createDuckJoeySummon(actor);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, "SET THE ARC");
      return;
    }
    if (isDuckMascotSpecial) {
      actor.attack.hit = true;
      actor.sprite.setVelocityX(-actor.facing * 46);
      actor.sprite.setTint(0xffef7d);
      this.spawnDuckMascot(actor, time);
      this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, "MOTO DUCK");
      this.time.delayedCall(240, () => {
        if (actor.attack?.kind === "special" && actor.config.id === "duck-flag") this.clearActiveAttack(actor);
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
    if (actor.attack.spinCharge) {
      this.resolveProposalSpinCharge(actor, opponent, time);
      return;
    }
    if (actor.attack.chelanSlam) {
      this.resolveChelanSlam(actor, opponent, time);
      return;
    }
    if (actor.attack.ripRapSpikes) {
      this.resolveRipRapTopSpikes(actor, opponent, time);
      return;
    }
    if (actor.attack.duckHeavy) {
      this.resolveDuckHeavy(actor, time);
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
      this.clearActiveAttack(actor);
      actor.sprite.setAlpha(1);
    }
  }

  private clearActiveAttack(actor: RuntimeFighter) {
    actor.attack?.chelanSlam?.cutscene?.destroy();
    actor.attack?.duckHeavy?.summon?.destroy();
    actor.attack = undefined;
    actor.sprite.setAlpha(1);
    this.setFighterScale(actor, actor.baseScaleX, actor.baseScaleY);
    actor.sprite.setRotation(0);
    actor.sprite.setAngularVelocity(0);
    actor.sprite.setMaxVelocity(DEFAULT_FIGHTER_MAX_VELOCITY_X, DEFAULT_FIGHTER_MAX_VELOCITY_Y);
    actor.sprite.clearTint();
  }

  private setFighterScale(actor: RuntimeFighter, scaleX: number, scaleY: number) {
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;
    const previousBottom = body.bottom;
    actor.sprite.setScale(scaleX, scaleY);
    const nextBottom = body.bottom;
    if (actor.sprite.visible && Number.isFinite(previousBottom) && Number.isFinite(nextBottom)) {
      actor.sprite.y += previousBottom - nextBottom;
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
    if (this.oceanBossActive && target === this.playerTwo) {
      this.createOceanSplash(target.sprite.x + attacker.facing * Phaser.Math.Between(24, 90), target.sprite.y - 70, kind === "special" ? "cross" : "breaker");
      this.flashMoveLabel(target.sprite.x, target.sprite.y - 158, kind === "special" ? "TIDE BROKEN" : "SPLASH");
      this.oceanBossSprite?.setTint(0xd7fbff);
      this.time.delayedCall(90, () => this.oceanBossSprite?.clearTint());
      this.cameras.main.shake(kind === "special" ? 120 : 60, kind === "special" ? 0.008 : 0.004);
      return;
    }
    this.applyKnockback(target, attacker.facing, attack.knockback, shielded ? -70 : -180, shielded ? 0.34 : 1);
    this.cameras.main.shake(kind === "special" ? 90 : 45, kind === "special" ? 0.006 : 0.003);
  }

  private applyKnockback(target: RuntimeFighter, direction: number, baseKnockback: number, baseVelocityY: number, multiplier = 1) {
    const percentScale = this.isSmashArena() ? 1 + target.health * SMASH_KNOCKBACK_DAMAGE_SCALE : 1;
    target.sprite.setVelocityX(direction * baseKnockback * multiplier * percentScale);
    target.sprite.setVelocityY(baseVelocityY * (this.isSmashArena() && baseVelocityY < 0 ? Phaser.Math.Clamp(percentScale, 1, 2.35) : 1));
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
        if (this.isSmashArena()) target.health += Math.round(overflow);
        else target.health = Math.max(0, target.health - Math.round(overflow));
        this.flashMoveLabel(target.sprite.x, target.sprite.y - 118, "BREAK");
      }
      return true;
    }

    if (this.isSmashArena()) target.health += Math.round(defendedDamage);
    else target.health = Math.max(0, target.health - Math.round(defendedDamage));
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

  private spawnStarfishMine(actor: RuntimeFighter, time: number, kind: AttackKind) {
    const attack = actor.config.attacks[kind];
    const x = Phaser.Math.Clamp(actor.sprite.x - actor.facing * 58, this.arenaLeft() + 88, this.arenaRight() - 88);
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
        const pushDirection = target.sprite.x < mine.object.x ? -1 : 1;
        this.applyKnockback(target, pushDirection, mine.knockback, shielded ? -190 : -330, shielded ? 0.34 : 1);
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

  private spawnChelanBeachThrow(actor: RuntimeFighter, time: number) {
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
        this.applyKnockback(target, Math.sign(projectile.velocityX), projectile.knockback, shielded ? -90 : -250, shielded ? 0.35 : 1);
        this.createProjectilePop(projectile.object.x, projectile.object.y, projectile.kind);
        projectile.object.destroy();
        return false;
      }

      if (projectile.object.x < this.arenaLeft() - 220 || projectile.object.x > this.arenaRight() + 220 || projectile.object.y > SMASH_BLAST_BOTTOM) {
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

  private resolveRipRapTopSpikes(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (!actor.attack?.ripRapSpikes) return;
    const state = actor.attack.ripRapSpikes;
    const attack = actor.config.attacks.heavy;
    const age = time - actor.attack.startedAt;
    const pulse = 1 + Math.sin(age / 42) * 0.035;

    actor.sprite.setVelocityX(0);
    actor.sprite.setAlpha(0.92);
    this.setFighterScale(actor, actor.baseScaleX * (1.08 + pulse * 0.025), actor.baseScaleY * 0.94);

    if (!state.erupted && age >= attack.windup) {
      state.erupted = true;
      actor.attack.hit = true;
      this.createRipRapSpikeBurst(actor.sprite.x, actor.sprite.y - 94);
      if (this.inRipRapSpikeRange(actor, opponent, attack.range)) {
        this.applyDamage(opponent, actor, "heavy");
        opponent.sprite.setVelocityY(-360);
        this.flashMoveLabel(opponent.sprite.x, opponent.sprite.y - 138, "SPIKED");
      }
      this.cameras.main.shake(95, 0.006);
    }

    if (age > attack.windup + attack.active + 120) {
      this.clearActiveAttack(actor);
    }
  }

  private inRipRapSpikeRange(actor: RuntimeFighter, opponent: RuntimeFighter, range: number) {
    const xDistance = Math.abs(actor.sprite.x - opponent.sprite.x);
    const yDistance = Math.abs((actor.sprite.y - 78) - opponent.sprite.y);
    return xDistance <= range && yDistance < 150;
  }

  private createRipRapSpikeBurst(x: number, y: number) {
    const ring = this.add.ellipse(x, y + 72, 82, 18, 0xd9ded1, 0.3).setStrokeStyle(4, 0xffffff, 0.62).setDepth(14);
    this.tweens.add({
      targets: ring,
      scaleX: 2.1,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });

    for (let index = 0; index < 9; index += 1) {
      const offset = Phaser.Math.Linear(-78, 78, index / 8);
      const height = Phaser.Math.Between(64, 116);
      const spike = this.add
        .triangle(x + offset, y + 64, 0, 0, 14, height, -14, height, 0xd9ded1, 0.98)
        .setStrokeStyle(2, 0x3d453d, 0.95)
        .setDepth(15)
        .setAngle(Phaser.Math.Between(-12, 12));
      this.tweens.add({
        targets: spike,
        y: y - Phaser.Math.Between(22, 54),
        scaleX: 1.08,
        scaleY: 1.2,
        yoyo: true,
        hold: 110,
        duration: 135,
        ease: "Back.Out",
        onComplete: () => spike.destroy(),
      });
    }
  }

  private spawnRipRapRollingRock(actor: RuntimeFighter) {
    const attack = actor.config.attacks.special;
    const startX = actor.sprite.x + actor.facing * 92;
    const floorY = this.fightFloorY(this.scale.height) - 32;
    const core = this.add.circle(0, 0, 34, 0x5f665c, 0.98).setStrokeStyle(4, 0x2f362f, 1);
    const chipA = this.add.circle(-10, -8, 8, 0x8e9689, 0.72);
    const chipB = this.add.circle(12, 10, 6, 0x3f473f, 0.75);
    const groove = this.add.rectangle(5, -2, 52, 5, 0x2f362f, 0.35).setAngle(-24);
    const object = this.add.container(startX, floorY, [core, chipA, chipB, groove]).setDepth(8);

    this.rollingRocks.push({
      object,
      owner: actor,
      damage: attack.damage,
      knockback: attack.knockback,
      radius: attack.range,
      velocityX: actor.facing * 175,
      hitActors: new Set(),
    });
    this.cameras.main.shake(55, 0.0035);
  }

  private updateRollingRocks(time: number) {
    const delta = this.game.loop.delta / 1000;
    this.rollingRocks = this.rollingRocks.filter((rock) => {
      rock.object.x += rock.velocityX * delta;
      rock.object.rotation += (rock.velocityX > 0 ? 1 : -1) * delta * 4.4;
      rock.object.y = this.fightFloorY(this.scale.height) - 32 + Math.sin(time / 78 + rock.object.x * 0.03) * 2;

      const target = rock.owner === this.playerOne ? this.playerTwo : this.playerOne;
      const targetBody = target.sprite.body as Phaser.Physics.Arcade.Body;
      const xDistance = Math.abs(rock.object.x - targetBody.center.x);
      const yDistance = Math.abs(rock.object.y - targetBody.center.y);

      if (!rock.hitActors.has(target) && xDistance <= rock.radius && yDistance <= 126) {
        rock.hitActors.add(target);
        const shielded = this.absorbDamageWithShield(target, rock.damage);
        this.applyKnockback(target, Math.sign(rock.velocityX), rock.knockback, shielded ? -100 : -260, shielded ? 0.34 : 1);
        this.createRollingRockHit(rock.object.x, rock.object.y);
        this.flashMoveLabel(target.sprite.x, target.sprite.y - 128, "BOWLED");
      }

      if (rock.object.x < this.arenaLeft() - 180 || rock.object.x > this.arenaRight() + 180) {
        rock.object.destroy();
        return false;
      }
      return true;
    });
  }

  private createRollingRockHit(x: number, y: number) {
    const burst = this.add.circle(x, y, 14, 0xd9ded1, 0.42).setStrokeStyle(4, 0xffffff, 0.66).setDepth(16);
    this.tweens.add({
      targets: burst,
      radius: 62,
      alpha: 0,
      duration: 300,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
    for (let index = 0; index < 8; index += 1) {
      const pebble = this.add.circle(x, y - 6, Phaser.Math.Between(3, 7), 0x5f665c, 0.9).setDepth(17);
      this.tweens.add({
        targets: pebble,
        x: x + Phaser.Math.Between(-90, 90),
        y: y - Phaser.Math.Between(18, 76),
        alpha: 0,
        duration: Phaser.Math.Between(240, 460),
        ease: "Cubic.Out",
        onComplete: () => pebble.destroy(),
      });
    }
    this.cameras.main.shake(90, 0.006);
  }

  private createDuckJoeySummon(actor: RuntimeFighter) {
    const summonX = Phaser.Math.Clamp(actor.sprite.x, this.arenaLeft() + 86, this.arenaRight() - 86);
    const summonY = actor.sprite.y;
    const glow = this.add.ellipse(0, 44, 96, 24, 0xf8ff65, 0.22).setBlendMode(Phaser.BlendModes.ADD);
    const joey = this.add.image(0, 0, "duck-flag-joey").setDisplaySize(62, 132).setFlipX(actor.facing < 0);
    const container = this.add.container(summonX, summonY, [glow, joey]).setDepth(18).setAlpha(0.95);
    this.tweens.add({ targets: container, y: summonY - 8, duration: 220, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    return container;
  }

  private resolveDuckHeavy(actor: RuntimeFighter, time: number) {
    if (!actor.attack?.duckHeavy) return;
    const charge = actor.attack.duckHeavy;
    const controls = actor.controls;
    const rawRatio = Phaser.Math.Clamp((time - charge.chargeStartedAt) / DUCK_HEAVY_CHARGE_MAX_MS, 0, 1);
    charge.chargeRatio = rawRatio;
    charge.direction = actor.facing;

    if (charge.charging) {
      actor.sprite.setVelocityX(0);
      actor.sprite.setTint(rawRatio > 0.75 ? 0xffef7d : 0xd7ff4f);
      this.setFighterScale(actor, actor.baseScaleX * (1 + rawRatio * 0.08), actor.baseScaleY * (1 - rawRatio * 0.05));
      charge.summon?.setPosition(Phaser.Math.Clamp(actor.sprite.x, this.arenaLeft() + 86, this.arenaRight() - 86), actor.sprite.y);
      charge.summon?.setScale(1 + rawRatio * 0.08);

      if (!controls.heavy || rawRatio >= 1) {
        const launchRatio = Math.max(rawRatio, DUCK_HEAVY_MIN_RATIO);
        charge.charging = false;
        actor.attack.hit = true;
        this.spawnDuckFootball(actor, time, launchRatio, charge.summon);
        this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 138, launchRatio >= 0.98 ? "DEEP BALL" : "DUCK PASS");
        this.time.delayedCall(220, () => {
          if (actor.attack?.kind === "heavy" && actor.config.id === "duck-flag") this.clearActiveAttack(actor);
        });
      }
    }
  }

  private spawnDuckFootball(actor: RuntimeFighter, time: number, ratio: number, summon?: Phaser.GameObjects.Container) {
    const attack = actor.config.attacks.heavy;
    const direction = actor.facing;
    const startX = (summon?.x ?? actor.sprite.x) + direction * 34;
    const startY = (summon?.y ?? actor.sprite.y) - 16;
    const trail = this.add.ellipse(0, 0, 26, 12, 0xf8ff65, 0.2).setBlendMode(Phaser.BlendModes.ADD);
    const ball = this.add.ellipse(0, 0, 24, 15, 0x8b5a2b, 1).setStrokeStyle(3, 0xffffff, 0.9);
    const lace = this.add.rectangle(0, 0, 13, 2, 0xffffff, 1);
    const object = this.add.container(startX, startY, [trail, ball, lace]).setDepth(20).setRotation(direction > 0 ? -0.22 : 0.22);
    const speed = Phaser.Math.Linear(480, 820, ratio);
    const lift = -Phaser.Math.Linear(120, 520, ratio);

    this.duckFootballs.push({
      object,
      owner: actor,
      damage: attack.damage,
      knockback: attack.knockback,
      radius: 36,
      velocityX: direction * speed,
      velocityY: lift,
      distanceTravelled: 0,
      expiresAt: time + Phaser.Math.Linear(1300, 2100, ratio),
      hit: false,
    });
    this.cameras.main.shake(55 + ratio * 65, 0.003 + ratio * 0.004);
  }

  private updateDuckFootballs(time: number) {
    const delta = this.game.loop.delta / 1000;
    this.duckFootballs = this.duckFootballs.filter((football) => {
      if (football.hit || time >= football.expiresAt) {
        football.object.destroy();
        return false;
      }

      football.velocityY += 760 * delta;
      const moveX = football.velocityX * delta;
      football.object.x += moveX;
      football.object.y += football.velocityY * delta;
      football.object.rotation += Math.sign(football.velocityX) * delta * 9;
      football.distanceTravelled += Math.abs(moveX);

      const target = football.owner === this.playerOne ? this.playerTwo : this.playerOne;
      const xDistance = Math.abs(football.object.x - target.sprite.x);
      const yDistance = Math.abs(football.object.y - target.sprite.y);
      if (xDistance <= football.radius && yDistance <= football.radius + 64) {
        football.hit = true;
        const travelRatio = Phaser.Math.Clamp(football.distanceTravelled / 720, 0, 1);
        const damage = Math.round(football.damage + travelRatio * 13);
        const knockback = football.knockback + travelRatio * 260;
        const shielded = this.absorbDamageWithShield(target, damage);
        this.applyKnockback(target, Math.sign(football.velocityX), knockback, shielded ? -120 : -300, shielded ? 0.35 : 1);
        this.createDuckFootballHit(football.object.x, football.object.y, travelRatio);
        this.flashMoveLabel(target.sprite.x, target.sprite.y - 132, travelRatio > 0.72 ? "BOMB" : "COMPLETE");
        football.object.destroy();
        return false;
      }

      if (football.object.x < this.arenaLeft() - 220 || football.object.x > this.arenaRight() + 220 || football.object.y > SMASH_BLAST_BOTTOM) {
        football.object.destroy();
        return false;
      }
      return true;
    });
  }

  private createDuckFootballHit(x: number, y: number, ratio: number) {
    const burst = this.add.circle(x, y, 12, 0xffef7d, 0.45).setStrokeStyle(4, 0xffffff, 0.76).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: burst,
      radius: 48 + ratio * 44,
      alpha: 0,
      duration: 320,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
    this.cameras.main.shake(80 + ratio * 80, 0.005 + ratio * 0.006);
  }

  private spawnDuckRunner(actor: RuntimeFighter, time: number) {
    const attack = actor.config.attacks.light;
    const direction = actor.facing;
    const startX = actor.sprite.x;
    const startY = actor.sprite.y - 126;
    const glow = this.add.ellipse(0, 58, 92, 24, 0xd7ff4f, 0.22).setBlendMode(Phaser.BlendModes.ADD);
    const dust = this.add.ellipse(-12, 72, 88, 22, 0xffef7d, 0).setBlendMode(Phaser.BlendModes.ADD);
    const runner = this.add.image(0, 0, "duck-flag-lamichael").setDisplaySize(72, 112).setFlipX(direction < 0);
    const object = this.add.container(startX, startY, [glow, dust, runner]).setDepth(18).setAlpha(0.92);

    this.duckRunners.push({
      object,
      owner: actor,
      damage: attack.damage,
      knockback: attack.knockback,
      radius: attack.range,
      velocityX: direction * DUCK_RUNNER_SPEED,
      direction,
      chargeUntil: time + DUCK_RUNNER_CHARGE_MS,
      launched: false,
      hit: false,
    });
    this.tweens.add({
      targets: object,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 160,
      yoyo: true,
      repeat: 2,
      ease: "Sine.InOut",
      onComplete: () => object.setScale(1),
    });
  }

  private updateDuckRunners(time: number) {
    const delta = this.game.loop.delta / 1000;
    this.duckRunners = this.duckRunners.filter((runner) => {
      if (time < runner.chargeUntil) {
        const chargeRatio = Phaser.Math.Clamp((time - (runner.chargeUntil - DUCK_RUNNER_CHARGE_MS)) / DUCK_RUNNER_CHARGE_MS, 0, 1);
        runner.object.x = Phaser.Math.Clamp(runner.owner.sprite.x, this.arenaLeft() + 76, this.arenaRight() - 76);
        runner.object.y = runner.owner.sprite.y - 126 + Math.sin(time / 72) * 6;
        runner.object.setAlpha(0.72 + chargeRatio * 0.28);
        runner.object.setRotation(Math.sin(time / 52) * 0.035);
        return true;
      }

      if (!runner.launched) {
        runner.launched = true;
        runner.object.setAlpha(1);
        runner.object.setRotation(0);
        (runner.object.getAt(0) as Phaser.GameObjects.Ellipse).setAlpha(0.16);
        (runner.object.getAt(1) as Phaser.GameObjects.Ellipse).setAlpha(0.22);
        this.createDuckRunnerLaunch(runner.object.x, this.fightFloorY(this.scale.height) - 44);
      }

      runner.object.x += runner.velocityX * delta;
      runner.object.y = this.fightFloorY(this.scale.height) - 78 + Math.sin(time / 52) * 5;

      const target = runner.owner === this.playerOne ? this.playerTwo : this.playerOne;
      const xDistance = Math.abs(runner.object.x - target.sprite.x);
      const yDistance = Math.abs(runner.object.y - target.sprite.y);
      if (!runner.hit && xDistance <= 66 && yDistance <= 116) {
        runner.hit = true;
        const shielded = this.absorbDamageWithShield(target, runner.damage);
        this.applyKnockback(target, Math.sign(runner.velocityX), runner.knockback, shielded ? -90 : -230, shielded ? 0.34 : 1);
        this.createDuckRunnerHit(runner.object.x, runner.object.y + 32);
        this.flashMoveLabel(target.sprite.x, target.sprite.y - 132, "TRUCKED");
      }

      if ((runner.direction < 0 && runner.object.x < this.arenaLeft() - 180) || (runner.direction > 0 && runner.object.x > this.arenaRight() + 180)) {
        runner.object.destroy();
        return false;
      }
      return true;
    });
  }

  private createDuckRunnerLaunch(x: number, y: number) {
    const burst = this.add.ellipse(x, y, 92, 26, 0xffef7d, 0.26).setStrokeStyle(3, 0xd7ff4f, 0.72);
    this.tweens.add({
      targets: burst,
      scaleX: 1.8,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
  }

  private createDuckRunnerHit(x: number, y: number) {
    const burst = this.add.circle(x, y - 20, 12, 0xffef7d, 0.5).setStrokeStyle(4, 0xffffff, 0.82).setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.add.ellipse(x, y, 76, 22, 0xd7ff4f, 0.34).setStrokeStyle(4, 0xffef7d, 0.72);
    this.tweens.add({
      targets: burst,
      radius: 58,
      alpha: 0,
      duration: 300,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
    this.tweens.add({
      targets: ring,
      scaleX: 2.6,
      scaleY: 1.25,
      alpha: 0,
      duration: 320,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    for (let index = 0; index < 7; index += 1) {
      const spark = this.add.rectangle(x, y - 18, Phaser.Math.Between(10, 18), 4, index % 2 === 0 ? 0xffef7d : 0xd7ff4f, 0.86).setDepth(19);
      this.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-82, 82),
        y: y - Phaser.Math.Between(26, 86),
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-1.8, 1.8),
        duration: Phaser.Math.Between(220, 380),
        ease: "Cubic.Out",
        onComplete: () => spark.destroy(),
      });
    }
    this.cameras.main.shake(130, 0.009);
  }

  private spawnDuckMascot(actor: RuntimeFighter, time: number) {
    const attack = actor.config.attacks.special;
    const target = actor === this.playerOne ? this.playerTwo : this.playerOne;
    const centerX = Phaser.Math.Clamp(target.sprite.x, this.arenaLeft() + 190, this.arenaRight() - 190);
    const centerY = this.fightFloorY(this.scale.height) - 104;
    const glow = this.add.ellipse(0, 42, 136, 34, 0xd7ff4f, 0.24).setBlendMode(Phaser.BlendModes.ADD);
    const mascot = this.add.image(0, 0, "duck-flag-mascot-motorcycle").setDisplaySize(164, 104).setFlipX(actor.facing < 0);
    const object = this.add.container(centerX + 150, centerY, [glow, mascot]).setDepth(16);

    this.duckMascots.push({
      object,
      owner: actor,
      centerX,
      centerY,
      angle: 0,
      radiusX: 168,
      radiusY: 54,
      expiresAt: time + DUCK_MASCOT_DURATION_MS,
      nextHitAt: time + 250,
      damage: attack.damage,
      knockback: attack.knockback,
    });
    this.sound.play("duck-flag-motorcycle-sfx", { volume: 0.72 });
    this.cameras.main.flash(90, 215, 255, 79, false);
  }

  private updateDuckMascots(time: number) {
    const delta = this.game.loop.delta / 1000;
    this.duckMascots = this.duckMascots.filter((mascot) => {
      if (time >= mascot.expiresAt) {
        mascot.object.destroy();
        return false;
      }

      const target = mascot.owner === this.playerOne ? this.playerTwo : this.playerOne;
      mascot.centerX = Phaser.Math.Linear(mascot.centerX, Phaser.Math.Clamp(target.sprite.x, this.arenaLeft() + 190, this.arenaRight() - 190), 0.025);
      mascot.centerY = this.fightFloorY(this.scale.height) - 104;
      mascot.angle += delta * 3.2;
      const nextX = mascot.centerX + Math.cos(mascot.angle) * mascot.radiusX;
      const nextY = mascot.centerY + Math.sin(mascot.angle) * mascot.radiusY;
      const previousX = mascot.object.x;
      mascot.object.setPosition(nextX, nextY);
      mascot.object.setScale(nextX < previousX ? -1 : 1, 1);

      const xDistance = Math.abs(mascot.object.x - target.sprite.x);
      const yDistance = Math.abs(mascot.object.y - target.sprite.y);
      if (time >= mascot.nextHitAt && xDistance <= 92 && yDistance <= 112) {
        mascot.nextHitAt = time + 850;
        const shielded = this.absorbDamageWithShield(target, mascot.damage);
        const pushDirection = mascot.object.x < target.sprite.x ? 1 : -1;
        this.applyKnockback(target, pushDirection, mascot.knockback, shielded ? -80 : -190, shielded ? 0.32 : 1);
        this.createDuckMascotHit(mascot.object.x, mascot.object.y + 22);
        this.flashMoveLabel(target.sprite.x, target.sprite.y - 132, "MOTO HIT");
      }

      return true;
    });
  }

  private createDuckMascotHit(x: number, y: number) {
    const burst = this.add.circle(x, y, 14, 0xd7ff4f, 0.42).setStrokeStyle(4, 0xffef7d, 0.86).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: burst,
      radius: 62,
      alpha: 0,
      duration: 280,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
    this.cameras.main.shake(70, 0.0045);
  }

  private resolveChelanSlam(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (!actor.attack?.chelanSlam) return;
    const state = actor.attack.chelanSlam;
    const attack = actor.config.attacks.special;
    const age = time - actor.attack.startedAt;
    const direction = state.direction;

    actor.sprite.setAlpha(0.95);
    actor.sprite.setTint(0xffef7d);
    actor.sprite.setVelocityX(state.grabbed ? 0 : direction * 360);

    if (!state.grabbed) {
      if (age >= attack.windup && this.inAttackRange(actor, opponent, attack.range)) {
        state.grabbed = true;
        state.grabbedAt = time;
        actor.attack.hit = true;
        actor.sprite.setVelocity(0, 0);
        opponent.sprite.setVelocity(0, 0);
        this.clearActiveAttack(opponent);
        opponent.isBlocking = false;
        state.cutscene = this.createChelanSlamCutscene(actor, opponent);
        this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 148, "CHELANMANIA");
        this.cameras.main.flash(110, 255, 239, 125, false);
        this.cameras.main.shake(130, 0.008);
        return;
      }

      if (age > attack.windup + attack.active + 160) {
        this.clearActiveAttack(actor);
      }
      return;
    }

    const grabAge = time - state.grabbedAt;
    const centerX = Phaser.Math.Clamp((actor.sprite.x + opponent.sprite.x) / 2, this.arenaLeft() + 170, this.arenaRight() - 170);
    const actorY = this.fighterSpawnY(this.scale.height, actor.config);
    const opponentY = this.fighterSpawnY(this.scale.height, opponent.config);
    const liftRatio = Phaser.Math.Clamp(grabAge / 360, 0, 1);
    const slamRatio = Phaser.Math.Clamp((grabAge - 360) / 260, 0, 1);
    const lift = Math.sin(liftRatio * Math.PI * 0.72) * 110;

    actor.facing = direction;
    opponent.facing = direction < 0 ? 1 : -1;
    actor.sprite.setFlipX(direction === -1);
    opponent.sprite.setFlipX(opponent.facing === -1);
    actor.sprite.setPosition(centerX - direction * 60, actorY - lift * 0.16);
    opponent.sprite.setPosition(centerX + direction * 54, opponentY - lift + slamRatio * 76);
    opponent.sprite.setRotation(direction * Phaser.Math.DegToRad(Phaser.Math.Linear(-18, 245, Math.max(liftRatio, slamRatio))));
    opponent.sprite.setAlpha(0.94 + Math.sin(grabAge / 38) * 0.05);
    this.setFighterScale(actor, actor.baseScaleX * (1.08 + Math.sin(grabAge / 45) * 0.025), actor.baseScaleY * 0.96);

    if (!state.slammed && grabAge >= 620) {
      state.slammed = true;
      this.applyDamage(opponent, actor, "special");
      this.applyKnockback(opponent, direction, attack.knockback, -410);
      this.createChelanSlamImpact(centerX + direction * 64, opponentY + 72, direction);
      this.flashMoveLabel(centerX, opponentY - 138, "RING BREAKER");
    }

    if (grabAge >= CHELAN_SLAM_CUTSCENE_MS) {
      this.finishChelanSlam(actor, opponent);
    }
  }

  private finishChelanSlam(actor: RuntimeFighter, opponent: RuntimeFighter) {
    this.clearActiveAttack(actor);
    opponent.sprite.setAlpha(1);
    this.setFighterScale(opponent, opponent.baseScaleX, opponent.baseScaleY);
    opponent.sprite.setRotation(0);
    opponent.sprite.clearTint();
    this.clampFighterToArena(actor);
    this.clampFighterToArena(opponent);
  }

  private createChelanSlamCutscene(actor: RuntimeFighter, opponent: RuntimeFighter) {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x071210, 0.46);
    const topBar = this.add.rectangle(width / 2, 58, width, 116, 0x071210, 0.94);
    const bottomBar = this.add.rectangle(width / 2, height - 58, width, 116, 0x071210, 0.94);
    const title = this.add
      .text(width / 2, 82, "CHELANMANIA DRIVER", {
        fontFamily: "Impact, system-ui, sans-serif",
        fontSize: "52px",
        color: "#ffef7d",
        fontStyle: "900",
        stroke: "#102421",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90);
    const tag = this.add
      .text(width / 2, height - 80, `${actor.config.displayName} turns ${opponent.config.displayName} inside out`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#fff7e6",
        fontStyle: "900",
        stroke: "#102421",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const container = this.add.container(0, 0, [shade, topBar, bottomBar, title, tag]).setDepth(90).setScrollFactor(0);

    for (let index = 0; index < 18; index += 1) {
      const y = Phaser.Math.Between(150, height - 160);
      const line = this.add.rectangle(width / 2 + Phaser.Math.Between(-80, 80), y, Phaser.Math.Between(180, 420), 5, 0xffef7d, 0.28);
      line.setAngle(Phaser.Math.Between(-16, 16));
      container.add(line);
      this.tweens.add({
        targets: line,
        x: line.x + (actor.facing > 0 ? 260 : -260),
        alpha: 0,
        duration: Phaser.Math.Between(360, 720),
        ease: "Cubic.Out",
      });
    }

    this.tweens.add({ targets: title, scale: 1.12, yoyo: true, repeat: 2, duration: 110, ease: "Sine.InOut" });
    this.tweens.add({ targets: container, alpha: 0, delay: CHELAN_SLAM_CUTSCENE_MS - 170, duration: 170, ease: "Quad.In" });
    return container;
  }

  private createChelanSlamImpact(x: number, y: number, direction: 1 | -1) {
    this.cameras.main.shake(220, 0.018);
    this.cameras.main.flash(130, 255, 246, 184, false);
    const ring = this.add.ellipse(x, y, 92, 24, 0xffef7d, 0.42).setStrokeStyle(6, 0xffffff, 0.8).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scaleX: 3.4,
      scaleY: 2.2,
      alpha: 0,
      duration: 420,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    for (let index = 0; index < 16; index += 1) {
      const spark = this.add.star(x, y - 18, 5, 4, Phaser.Math.Between(10, 18), 0xffef7d, 0.96).setDepth(31);
      this.tweens.add({
        targets: spark,
        x: x + direction * Phaser.Math.Between(24, 220) + Phaser.Math.Between(-110, 110),
        y: y - Phaser.Math.Between(28, 180),
        angle: Phaser.Math.Between(-260, 260),
        alpha: 0,
        duration: Phaser.Math.Between(360, 700),
        ease: "Cubic.Out",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private resolveProposalSpinCharge(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (!actor.attack?.spinCharge) return;
    const charge = actor.attack.spinCharge;
    const attack = actor.config.attacks.special;
    const controls = actor.controls;
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;

    if (charge.charging) {
      const rawRatio = Phaser.Math.Clamp((time - charge.chargeStartedAt) / PROPOSAL_SPIN_CHARGE_MAX_MS, 0, 1);
      charge.chargeRatio = rawRatio;
      const spinSpeed = Phaser.Math.Linear(260, 1280, rawRatio);
      const pulse = 1 + rawRatio * 0.18 + Math.sin(time / 34) * rawRatio * 0.035;
      actor.sprite.setVelocityX(0);
      actor.sprite.setAngularVelocity(charge.direction * spinSpeed);
      this.setFighterScale(actor, actor.baseScaleX * pulse, actor.baseScaleY * (1 - rawRatio * 0.16));
      actor.sprite.setAlpha(0.88 + rawRatio * 0.12);
      actor.sprite.setTint(rawRatio > 0.72 ? 0xffef7d : 0xf3d98c);

      if (!controls.special || rawRatio >= 1) {
        const launchRatio = Math.max(Phaser.Math.Clamp(rawRatio, 0, 1), PROPOSAL_SPIN_MIN_RATIO);
        charge.charging = false;
        charge.launched = true;
        charge.chargeRatio = launchRatio;
        charge.direction = actor.facing;
        actor.attack.startedAt = time;
        actor.sprite.setMaxVelocity(1100, DEFAULT_FIGHTER_MAX_VELOCITY_Y);
        actor.sprite.setVelocity(charge.direction * Phaser.Math.Linear(620, 1040, launchRatio), body.blocked.down ? -95 : body.velocity.y * 0.35);
        actor.sprite.setAngularVelocity(charge.direction * Phaser.Math.Linear(900, 1720, launchRatio));
        this.createSpinLaunchBurst(actor.sprite.x, actor.sprite.y, charge.direction, launchRatio);
        this.flashMoveLabel(actor.sprite.x, actor.sprite.y - 140, launchRatio >= 0.98 ? "MAX LAUNCH" : "LAUNCH");
        this.cameras.main.shake(80 + launchRatio * 90, 0.004 + launchRatio * 0.005);
      }
      return;
    }

    if (!charge.launched) return;
    const launchAge = time - actor.attack.startedAt;
    const launchRatio = Math.max(charge.chargeRatio, PROPOSAL_SPIN_MIN_RATIO);
    actor.sprite.setAlpha(0.96);
    actor.sprite.setVelocityX(charge.direction * Phaser.Math.Linear(620, 1040, launchRatio));
    actor.sprite.setAngularVelocity(charge.direction * Phaser.Math.Linear(900, 1720, launchRatio));

    if (!actor.attack.hit && this.inSpinLaunchRange(actor, opponent, attack.range)) {
      actor.attack.hit = true;
      this.applyDamage(opponent, actor, "special");
      this.applyKnockback(opponent, charge.direction, attack.knockback, -Phaser.Math.Linear(210, 390, launchRatio), Phaser.Math.Linear(0.82, 1.18, launchRatio));
      this.createSpinHitBurst(opponent.sprite.x, opponent.sprite.y - 34, launchRatio);
      this.flashMoveLabel(opponent.sprite.x, opponent.sprite.y - 132, "LAUNCHED");
    }

    if (launchAge >= PROPOSAL_SPIN_LAUNCH_MS || this.isFighterPushingArenaEdge(actor, charge.direction)) {
      this.finishProposalSpinCharge(actor);
    }
  }

  private inSpinLaunchRange(actor: RuntimeFighter, opponent: RuntimeFighter, range: number) {
    const xDistance = Math.abs(actor.sprite.x - opponent.sprite.x);
    const yDistance = Math.abs(actor.sprite.y - opponent.sprite.y);
    return xDistance <= range && yDistance < 140;
  }

  private isFighterPushingArenaEdge(actor: RuntimeFighter, direction: 1 | -1) {
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;
    const edgePadding = 2;
    return direction < 0 ? body.left <= this.arenaLeft() + edgePadding : body.right >= this.arenaRight() - edgePadding;
  }

  private finishProposalSpinCharge(actor: RuntimeFighter) {
    actor.attack = undefined;
    actor.sprite.setAlpha(1);
    this.setFighterScale(actor, actor.baseScaleX, actor.baseScaleY);
    actor.sprite.setRotation(0);
    actor.sprite.setAngularVelocity(0);
    actor.sprite.setMaxVelocity(DEFAULT_FIGHTER_MAX_VELOCITY_X, DEFAULT_FIGHTER_MAX_VELOCITY_Y);
    actor.sprite.clearTint();
    this.clampFighterToArena(actor);
  }

  private resolveFighterStacking() {
    if (this.oceanBossActive || this.proposalRockBossActive) return;
    if (!this.playerOne.sprite.visible || !this.playerTwo.sprite.visible) return;

    const oneBody = this.playerOne.sprite.body as Phaser.Physics.Arcade.Body;
    const twoBody = this.playerTwo.sprite.body as Phaser.Physics.Arcade.Body;
    const overlapX = Math.min(oneBody.right, twoBody.right) - Math.max(oneBody.left, twoBody.left);
    const overlapY = Math.min(oneBody.bottom, twoBody.bottom) - Math.max(oneBody.top, twoBody.top);
    if (overlapX < FIGHTER_STACK_MIN_OVERLAP_X || overlapY <= 0) return;

    const oneCenterY = oneBody.top + oneBody.height / 2;
    const twoCenterY = twoBody.top + twoBody.height / 2;
    const upper = oneCenterY <= twoCenterY ? this.playerOne : this.playerTwo;
    const lower = upper === this.playerOne ? this.playerTwo : this.playerOne;
    const upperBody = upper.sprite.body as Phaser.Physics.Arcade.Body;
    const lowerBody = lower.sprite.body as Phaser.Physics.Arcade.Body;

    if (upperBody.bottom > lowerBody.top + FIGHTER_STACK_CONTACT_TOLERANCE) return;

    const pushDirection: 1 | -1 = lower.sprite.x >= upper.sprite.x ? 1 : -1;
    const desiredSeparation = Math.min(overlapX + FIGHTER_STACK_SEPARATION, FIGHTER_STACK_MAX_POSITION_PUSH);
    const lowerRoom = pushDirection > 0 ? this.arenaRight() - lowerBody.right : lowerBody.left - this.arenaLeft();
    const lowerShift = Math.min(desiredSeparation, Math.max(0, lowerRoom));
    const upperShift = desiredSeparation - lowerShift;

    if (lowerShift > 0) lower.sprite.setX(lower.sprite.x + pushDirection * lowerShift);
    if (upperShift > 0) upper.sprite.setX(upper.sprite.x - pushDirection * upperShift);

    lower.sprite.setVelocityX(pushDirection * FIGHTER_STACK_LOWER_PUSH_SPEED);
    upper.sprite.setVelocityX(-pushDirection * FIGHTER_STACK_UPPER_DRIFT_SPEED);
    if (upperBody.velocity.y < FIGHTER_STACK_DOWNWARD_VELOCITY) {
      upper.sprite.setVelocityY(FIGHTER_STACK_DOWNWARD_VELOCITY);
    }
  }

  private updateSmashArenaCamera() {
    if (!this.cameraTarget) return;
    const p1Active = this.playerOne.sprite.visible && this.playerOne.lives > 0;
    const p2Active = this.playerTwo.sprite.visible && this.playerTwo.lives > 0;
    const focusX =
      p1Active && p2Active
        ? (this.playerOne.sprite.x + this.playerTwo.sprite.x) / 2
        : p1Active
          ? this.playerOne.sprite.x
          : p2Active
            ? this.playerTwo.sprite.x
            : SMASH_WORLD_WIDTH / 2;
    const focusY =
      p1Active && p2Active
        ? (this.playerOne.sprite.y + this.playerTwo.sprite.y) / 2 - 70
        : p1Active
          ? this.playerOne.sprite.y - 70
          : p2Active
            ? this.playerTwo.sprite.y - 70
            : this.scale.height / 2;
    this.cameraTarget.setPosition(
      Phaser.Math.Clamp(focusX, this.scale.width * 0.42, SMASH_WORLD_WIDTH - this.scale.width * 0.42),
      Phaser.Math.Clamp(focusY, 280, 620),
    );
  }

  private checkSmashBlastZones(time: number) {
    this.checkSmashBlastZone(this.playerOne, this.playerTwo, time);
    this.checkSmashBlastZone(this.playerTwo, this.playerOne, time);
  }

  private checkSmashBlastZone(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (actor.lives <= 0 || time < actor.respawningUntil || this.roundOver) return;
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;
    const out =
      body.right < -SMASH_BLAST_PADDING_X ||
      body.left > SMASH_WORLD_WIDTH + SMASH_BLAST_PADDING_X ||
      body.bottom < SMASH_BLAST_TOP ||
      body.top > SMASH_BLAST_BOTTOM;
    if (!out) return;

    actor.lives = Math.max(0, actor.lives - 1);
    this.clearActiveAttack(actor);
    this.flashMoveLabel(Phaser.Math.Clamp(actor.sprite.x, 120, SMASH_WORLD_WIDTH - 120), Phaser.Math.Clamp(actor.sprite.y, 120, 760), "KO");
    this.cameras.main.flash(120, 255, 246, 184, false);
    this.cameras.main.shake(260, 0.015);

    if (actor.lives <= 0) {
      actor.health = 999;
      actor.sprite.setVisible(false);
      actor.nameLabel.setVisible(false);
      actor.skinOverlay?.setVisible(false);
      actor.shieldAura.setVisible(false);
      actor.shieldEdge.setVisible(false);
      return;
    }

    this.respawnSmashFighter(actor, actor === this.playerOne ? "left" : "right", time);
    opponent.sprite.setVelocityX(opponent.sprite.x < SMASH_WORLD_WIDTH / 2 ? -70 : 70);
  }

  private respawnSmashFighter(actor: RuntimeFighter, side: "left" | "right", time: number) {
    actor.health = 0;
    actor.shield = actor.config.maxShield;
    actor.respawningUntil = time + SMASH_RESPAWN_MS;
    actor.sprite
      .setVisible(true)
      .setAlpha(0.55)
      .setPosition(this.getSpawnX(side), this.fighterSpawnY(this.scale.height, actor.config) - 210)
      .setVelocity(0, 0)
      .setRotation(0)
      .setAngularVelocity(0);
    this.setFighterScale(actor, actor.baseScaleX, actor.baseScaleY);
    this.syncFighterAttachments(actor);
  }

  private clampActiveFightersToArena() {
    this.clampFighterToArena(this.playerOne);
    this.clampFighterToArena(this.playerTwo);
  }

  private clampFighterToArena(actor: RuntimeFighter) {
    if (!actor.sprite.visible) return;
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.isSmashArena()) {
      if (!Number.isFinite(actor.sprite.x) || !Number.isFinite(actor.sprite.y)) {
        this.respawnSmashFighter(actor, actor === this.playerOne ? "left" : "right", this.time.now);
      } else if (body.top < SMASH_BLAST_TOP - 80 && body.velocity.y < 0) {
        actor.sprite.setVelocityY(0);
      }
      this.syncFighterAttachments(actor);
      return;
    }
    let nextX = actor.sprite.x;
    let nextY = actor.sprite.y;
    let blockedDirection: 1 | -1 | 0 = 0;
    let recovered = false;

    if (!Number.isFinite(actor.sprite.x) || !Number.isFinite(actor.sprite.y)) {
      actor.sprite.setPosition(this.getSafeFighterX(actor), this.fighterSpawnY(this.scale.height, actor.config));
      actor.sprite.setVelocity(0, 0);
      this.clearActiveAttack(actor);
      this.syncFighterAttachments(actor);
      return;
    }

    if (body.left < 0) {
      nextX += -body.left;
      blockedDirection = -1;
    } else if (body.right > this.scale.width) {
      nextX -= body.right - this.scale.width;
      blockedDirection = 1;
    }

    if (nextX !== actor.sprite.x) {
      actor.sprite.setX(nextX);
      if (blockedDirection < 0 && body.velocity.x < 0) actor.sprite.setVelocityX(0);
      if (blockedDirection > 0 && body.velocity.x > 0) actor.sprite.setVelocityX(0);
    }

    const floorTop = this.fightFloorY(this.scale.height) - GROUND_HEIGHT / 2;
    const ceiling = -ARENA_CEILING_PADDING;
    if (body.bottom > floorTop + ARENA_FLOOR_SNAP_TOLERANCE) {
      nextY -= body.bottom - floorTop;
      recovered = true;
    } else if (body.top < ceiling) {
      nextY += ceiling - body.top;
      recovered = true;
    }

    const badlyOutsideArena =
      body.right < -ARENA_OUT_OF_BOUNDS_RECOVERY_PADDING ||
      body.left > this.scale.width + ARENA_OUT_OF_BOUNDS_RECOVERY_PADDING ||
      body.top > this.scale.height + ARENA_OUT_OF_BOUNDS_RECOVERY_PADDING;
    if (badlyOutsideArena) {
      actor.sprite.setPosition(this.getSafeFighterX(actor), this.fighterSpawnY(this.scale.height, actor.config));
      actor.sprite.setVelocity(0, 0);
      this.clearActiveAttack(actor);
      this.syncFighterAttachments(actor);
      return;
    }

    if (nextY !== actor.sprite.y) {
      actor.sprite.setY(nextY);
      if (body.velocity.y > 0 || recovered) actor.sprite.setVelocityY(0);
      if (recovered) this.clearActiveAttack(actor);
    }
    this.syncFighterAttachments(actor);
  }

  private getSafeFighterX(actor: RuntimeFighter) {
    if (this.isSmashArena()) return this.getSpawnX(actor === this.playerOne ? "left" : "right");
    const fallbackX =
      actor === this.playerOne
        ? this.oceanBossActive || this.proposalRockBossActive
          ? 290
          : 260
        : this.oceanBossActive || this.proposalRockBossActive
          ? this.scale.width / 2
          : this.scale.width - 260;
    return Phaser.Math.Clamp(Number.isFinite(actor.sprite.x) ? actor.sprite.x : fallbackX, 80, this.scale.width - 80);
  }

  private syncFighterAttachments(actor: RuntimeFighter) {
    actor.nameLabel.setPosition(actor.sprite.x, actor.sprite.y - 132);
    if (actor.skin && actor.skinOverlay) {
      const visible = actor.sprite.visible;
      const offsetX = actor.skin.placement.offsetX * actor.sprite.displayWidth * (actor.sprite.flipX ? -1 : 1);
      actor.skinOverlay
        .setPosition(actor.sprite.x + offsetX, actor.sprite.y + actor.skin.placement.offsetY * actor.sprite.displayWidth)
        .setDisplaySize(actor.sprite.displayWidth * actor.skin.placement.widthRatio, actor.sprite.displayWidth * actor.skin.placement.widthRatio * 0.67)
        .setFlipX(actor.sprite.flipX)
        .setRotation(actor.sprite.rotation)
        .setAlpha(actor.sprite.alpha)
        .setVisible(visible)
        .setDepth(actor.sprite.depth + 1);
    }
    this.updateShieldVisual(actor);
  }

  private createSpinLaunchBurst(x: number, y: number, direction: 1 | -1, ratio: number) {
    const ring = this.add.ellipse(x - direction * 22, y, 54, 76, 0xffef7d, 0.24).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scaleX: 1.2 + ratio * 1.7,
      scaleY: 0.6 + ratio * 0.6,
      x: x - direction * (90 + ratio * 70),
      alpha: 0,
      duration: 310,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    for (let index = 0; index < 8; index += 1) {
      const spark = this.add.circle(x - direction * Phaser.Math.Between(12, 42), y + Phaser.Math.Between(-48, 44), Phaser.Math.Between(4, 8), 0xffef7d, 0.9);
      this.tweens.add({
        targets: spark,
        x: spark.x - direction * Phaser.Math.Between(80, 180),
        y: spark.y + Phaser.Math.Between(-36, 36),
        alpha: 0,
        duration: Phaser.Math.Between(220, 420),
        ease: "Cubic.Out",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private createSpinHitBurst(x: number, y: number, ratio: number) {
    const burst = this.add.circle(x, y, 16, 0xffef7d, 0.38).setStrokeStyle(5, 0xfff6b8, 0.82).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: burst,
      radius: 68 + ratio * 42,
      alpha: 0,
      duration: 360,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });
  }

  private resolveProposalSlam(actor: RuntimeFighter, opponent: RuntimeFighter, time: number) {
    if (!actor.attack?.slam) return;
    const slam = actor.attack.slam;
    const attack = actor.config.attacks[actor.attack.kind];
    const age = time - actor.attack.startedAt;
    const body = actor.sprite.body as Phaser.Physics.Arcade.Body;

    slam.launched = slam.launched || age > 110 || body.velocity.y < -80;
    actor.sprite.setAlpha(0.94);
    const slamScale = 1.08 + Math.sin(age / 55) * 0.035;
    this.setFighterScale(actor, actor.baseScaleX * slamScale, actor.baseScaleY * slamScale);
    actor.sprite.setAngularVelocity(actor.facing * (body.velocity.y < 0 ? 105 : 170));

    if (!slam.impacted && slam.launched && age > 300 && body.blocked.down) {
      slam.impacted = true;
      actor.attack.hit = true;
      actor.sprite.setAngularVelocity(0);
      actor.sprite.setRotation(0);
      this.setFighterScale(actor, actor.baseScaleX * 1.18, actor.baseScaleY * 0.82);
      actor.sprite.setVelocityX(0);
      this.createSlamImpact(actor.sprite.x, actor.sprite.y + 72);

      if (this.inSlamRange(actor, opponent, attack.range)) {
        this.applyDamage(opponent, actor, actor.attack.kind);
        this.applyKnockback(opponent, actor.facing, attack.knockback, -360);
        this.flashMoveLabel(opponent.sprite.x, opponent.sprite.y - 130, "CRUSHED");
      }
    }

    if (slam.impacted && age > 680) {
      actor.attack = undefined;
      actor.sprite.setAlpha(1);
      this.setFighterScale(actor, actor.baseScaleX, actor.baseScaleY);
      actor.sprite.setRotation(0);
    }

    if (!slam.impacted && age > 1400) {
      actor.attack = undefined;
      actor.sprite.setAlpha(1);
      this.setFighterScale(actor, actor.baseScaleX, actor.baseScaleY);
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
    else if (absDistance < 188 && this.playerTwo.cooldowns.special <= time && Math.random() < 0.36) plan.special = true;
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
      lives: actor.lives,
      shield: actor.shield,
      cooldowns: actor.cooldowns,
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
    this.clampActiveFightersToArena();
    this.updateHud(this.time.now);
  }

  private applyFighterNetState(actor: RuntimeFighter, state: MatchNetState["playerOne"]) {
    actor.health = state.health;
    actor.lives = state.lives ?? actor.lives;
    actor.shield = state.shield;
    actor.cooldowns = state.cooldowns;
    actor.rounds = state.rounds;
    actor.facing = state.facing;
    actor.isBlocking = state.isBlocking;
    actor.sprite.setPosition(state.x, state.y);
    actor.sprite.setVelocity(state.velocityX, state.velocityY);
    actor.sprite.setFlipX(state.facing === -1);
    this.syncFighterAttachments(actor);
    actor.sprite.setTint(actor.isBlocking ? 0xa8c6ff : actor.config.tint);
    this.updateShieldVisual(actor);
  }

  private updateHud(time: number) {
    const p1Ratio = this.isSmashArena()
      ? Phaser.Math.Clamp(this.playerOne.health / SMASH_DAMAGE_BAR_CAP, 0, 1)
      : Phaser.Math.Clamp(this.playerOne.health / this.playerOne.config.maxHealth, 0, 1);
    const p2Ratio = this.isSmashArena()
      ? Phaser.Math.Clamp(this.playerTwo.health / SMASH_DAMAGE_BAR_CAP, 0, 1)
      : Phaser.Math.Clamp(this.playerTwo.health / this.playerTwo.config.maxHealth, 0, 1);
    const p1ShieldRatio =
      this.playerOne.config.maxShield > 0 ? Phaser.Math.Clamp(this.playerOne.shield / this.playerOne.config.maxShield, 0, 1) : 0;
    const p2ShieldRatio =
      this.playerTwo.config.maxShield > 0 ? Phaser.Math.Clamp(this.playerTwo.shield / this.playerTwo.config.maxShield, 0, 1) : 0;
    this.healthBars[0].displayWidth = 420 * p1Ratio;
    this.healthBars[1].displayWidth = 420 * p2Ratio;
    this.shieldBars[0].displayWidth = 420 * p1ShieldRatio;
    this.shieldBars[1].displayWidth = 420 * p2ShieldRatio;
    this.shieldBars[0].setFillStyle(this.playerOne.isBlocking ? 0xcaf8ff : 0x7ee8ff);
    this.shieldBars[1].setFillStyle(this.playerTwo.isBlocking ? 0xcaf8ff : 0x7ee8ff);
    this.healthBars[0].setFillStyle(this.isSmashArena() && this.playerOne.health >= 100 ? 0xff684f : this.isSmashArena() ? 0xffb84d : 0x56c271);
    this.healthBars[1].setFillStyle(this.isSmashArena() && this.playerTwo.health >= 100 ? 0xff684f : this.isSmashArena() ? 0xffb84d : 0x56c271);
    this.healthTexts[0]?.setText(this.isSmashArena() ? `${Math.round(this.playerOne.health)}%` : `${Math.max(0, Math.round(this.playerOne.health))}`);
    this.healthTexts[1]?.setText(this.isSmashArena() ? `${Math.round(this.playerTwo.health)}%` : `${Math.max(0, Math.round(this.playerTwo.health))}`);
    this.lifeTexts[0]?.setText(this.isSmashArena() ? `STOCKS ${"x".repeat(Math.max(0, this.playerOne.lives))}` : "");
    this.lifeTexts[1]?.setText(this.isSmashArena() ? `${"x".repeat(Math.max(0, this.playerTwo.lives))} STOCKS` : "");
    this.updateAbilityCooldownViews(time);
    this.updateTouchCooldownViews(time);
    const remaining = Math.max(0, this.roundTime - Math.floor((time - this.roundStartedAt) / 1000));
    this.timerText?.setText(String(remaining));
    this.roundText?.setText(
      this.proposalRockBossActive
        ? "Cleanup Boss"
        : this.isSmashArena()
          ? "Neskowin 3 Stock"
          : `Round ${this.roundNumber}    ${this.playerOne.rounds}-${this.playerTwo.rounds}`,
    );
  }

  private updateAbilityCooldownViews(time: number) {
    for (const view of this.abilityCooldownViews) {
      const radius = 22;
      const ratio = this.getCooldownRemainingRatio(view.actor, view.kind, time);
      this.drawCooldownMask(view.overlay, view.text.x, view.text.y, radius, ratio);
      this.updateCooldownText(view.text, view.actor, view.kind, time);
    }
  }

  private updateTouchCooldownViews(time: number) {
    for (const view of this.touchCooldownViews) {
      const ratio = this.getCooldownRemainingRatio(this.playerOne, view.kind, time);
      this.drawCooldownMask(view.overlay, view.text.x, view.text.y, 39, ratio);
      this.updateCooldownText(view.text, this.playerOne, view.kind, time);
    }
  }

  private getCooldownRemainingRatio(actor: RuntimeFighter, kind: AttackKind, time: number) {
    const cooldown = actor.config.attacks[kind].cooldown;
    const remaining = Math.max(0, actor.cooldowns[kind] - time);
    return cooldown > 0 ? Phaser.Math.Clamp(remaining / cooldown, 0, 1) : 0;
  }

  private updateCooldownText(text: Phaser.GameObjects.Text, actor: RuntimeFighter, kind: AttackKind, time: number) {
    const remaining = Math.max(0, actor.cooldowns[kind] - time);
    text.setText(remaining > 0 ? Math.ceil(remaining / 1000).toFixed(0) : "");
  }

  private drawCooldownMask(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, ratio: number) {
    graphics.clear();
    if (ratio <= 0) return;
    graphics.fillStyle(0x071210, 0.68);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.slice(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(2, 0xffef7d, 0.72);
    graphics.strokeCircle(x, y, radius - 1);
  }

  private finishRound() {
    this.roundOver = true;
    const p1Wins = this.isSmashArena()
      ? this.playerOne.lives === this.playerTwo.lives
        ? this.playerOne.health <= this.playerTwo.health
        : this.playerOne.lives > this.playerTwo.lives
      : this.playerOne.health === this.playerTwo.health
        ? this.playerOne.health > 0
        : this.playerOne.health > this.playerTwo.health;
    const winner = p1Wins ? this.playerOne : this.playerTwo;
    const winnerName = this.proposalRockBossActive && p1Wins ? "Beach Cleanup Crew" : winner.config.displayName;
    winner.rounds += 1;

    const message = this.add
      .text(this.scale.width / 2, 170, this.proposalRockBossActive ? `${winnerName} clears the boss` : this.isSmashArena() ? `${winnerName} wins` : `${winnerName} wins the round`, {
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
      if (winner.rounds >= 2 || this.proposalRockBossActive || this.isSmashArena()) {
        const result: MatchResult = {
          matchKey: `${this.selection.mode}:${this.selection.levelId}:${this.selection.playerOneId}:${this.selection.playerTwoId}:${Date.now()}`,
          winnerName,
          winnerId: winner.config.id,
          mode: this.selection.mode,
          levelId: this.selection.levelId,
          playerOneId: this.selection.playerOneId,
          playerTwoId: this.selection.playerTwoId,
          campaignLevelId: this.selection.campaignLevelId,
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

  private isAiBattle() {
    return this.selection.mode === "ai" || this.selection.mode === "campaign";
  }
}
