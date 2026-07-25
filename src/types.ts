export type GameMode = "ai" | "local" | "online-host" | "online-guest";

export type AttackKind = "light" | "heavy" | "special";

export interface AttackConfig {
  damage: number;
  range: number;
  knockback: number;
  cooldown: number;
  windup: number;
  active: number;
}

export interface FighterConfig {
  id: string;
  displayName: string;
  spriteKey: string;
  maxHealth: number;
  maxShield: number;
  shieldRechargePerSecond: number;
  speed: number;
  jumpPower: number;
  defense: number;
  tint: number;
  specialName: string;
  aiProfile: "steady" | "aggressive" | "defensive" | "zoning";
  attacks: Record<AttackKind, AttackConfig>;
}

export interface LevelConfig {
  id: string;
  displayName: string;
  textureKey: string;
  assetPath: string;
  accent: number;
}

export interface MatchSelection {
  mode: GameMode;
  playerOneId: string;
  playerTwoId: string;
  levelId: string;
  roomCode?: string;
}

export interface MatchResult {
  winnerName: string;
  winnerId: string;
  mode: GameMode;
  levelId: string;
}
