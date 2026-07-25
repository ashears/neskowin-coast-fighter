import type { FighterConfig } from "./types";

const baseAttacks = {
  light: { damage: 7, range: 88, knockback: 260, cooldown: 340, windup: 70, active: 120 },
  heavy: { damage: 13, range: 104, knockback: 430, cooldown: 720, windup: 130, active: 150 },
  special: { damage: 16, range: 138, knockback: 540, cooldown: 1550, windup: 170, active: 180 },
};

export const fighters: FighterConfig[] = [
  {
    id: "proposal-rock",
    displayName: "Proposal Rock",
    spriteKey: "fighter-proposal-rock",
    maxHealth: 118,
    maxShield: 78,
    shieldRechargePerSecond: 18,
    speed: 230,
    jumpPower: 670,
    defense: 0.82,
    tint: 0xffffff,
    specialName: "Proposal Body Slam",
    aiProfile: "defensive",
    attacks: {
      light: { ...baseAttacks.light, damage: 8, range: 86 },
      heavy: { ...baseAttacks.heavy, damage: 18, range: 92, knockback: 610, cooldown: 1180, windup: 90, active: 120 },
      special: { ...baseAttacks.special, damage: 25, range: 210, knockback: 760, cooldown: 2100, windup: 260, active: 260 },
    },
  },
  {
    id: "chelan",
    displayName: "The Chelan",
    spriteKey: "fighter-chelan",
    maxHealth: 108,
    maxShield: 54,
    shieldRechargePerSecond: 24,
    speed: 270,
    jumpPower: 650,
    defense: 0.92,
    tint: 0xffffff,
    specialName: "Beach Toy Zap",
    aiProfile: "steady",
    attacks: {
      light: { ...baseAttacks.light },
      heavy: { ...baseAttacks.heavy, range: 112 },
      special: { ...baseAttacks.special, damage: 13, range: 520, knockback: 430, cooldown: 860, windup: 80, active: 520 },
    },
  },
  {
    id: "ocean",
    displayName: "The Ocean",
    spriteKey: "fighter-ocean",
    maxHealth: 155,
    maxShield: 0,
    shieldRechargePerSecond: 0,
    speed: 0,
    jumpPower: 700,
    defense: 0.78,
    tint: 0xffffff,
    specialName: "Sneaker Wave",
    aiProfile: "zoning",
    attacks: {
      light: { ...baseAttacks.light, range: 120 },
      heavy: { ...baseAttacks.heavy, range: 150 },
      special: { ...baseAttacks.special, range: 190, cooldown: 1250 },
    },
  },
  {
    id: "rip-rap",
    displayName: "Rip Rap",
    spriteKey: "fighter-rip-rap",
    maxHealth: 112,
    maxShield: 70,
    shieldRechargePerSecond: 16,
    speed: 245,
    jumpPower: 620,
    defense: 0.86,
    tint: 0x6f766d,
    specialName: "Jagged Counter",
    aiProfile: "defensive",
    attacks: {
      light: { ...baseAttacks.light, damage: 9, range: 78 },
      heavy: { ...baseAttacks.heavy, damage: 14, knockback: 520 },
      special: { ...baseAttacks.special, damage: 19, range: 112, knockback: 620, cooldown: 1500 },
    },
  },
  {
    id: "the-house",
    displayName: "The House",
    spriteKey: "fighter-the-house",
    maxHealth: 110,
    maxShield: 60,
    shieldRechargePerSecond: 21,
    speed: 260,
    jumpPower: 640,
    defense: 0.9,
    tint: 0xd1ba84,
    specialName: "Porch Swing",
    aiProfile: "aggressive",
    attacks: {
      light: { ...baseAttacks.light, damage: 8 },
      heavy: { ...baseAttacks.heavy, damage: 15 },
      special: { ...baseAttacks.special, damage: 18, range: 146, knockback: 590 },
    },
  },
];

export function getFighter(id: string): FighterConfig {
  const fighter = fighters.find((candidate) => candidate.id === id);
  if (!fighter) {
    throw new Error(`Unknown fighter: ${id}`);
  }
  return fighter;
}
