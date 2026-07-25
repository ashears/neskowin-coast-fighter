export type GameMode = "ai" | "campaign" | "local" | "online-host" | "online-guest";

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
  title: string;
  role: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Boss";
  bio: string;
  strengths: string[];
  weaknesses: string[];
  passiveName: string;
  passiveDescription: string;
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
  campaignLevelId?: string;
  roomCode?: string;
}

export interface MatchResult {
  matchKey?: string;
  winnerName: string;
  winnerId: string;
  mode: GameMode;
  levelId: string;
  playerOneId?: string;
  playerTwoId?: string;
  campaignLevelId?: string;
}
