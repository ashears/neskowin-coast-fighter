import { healthRules, stockRules, TICK_RATE } from '@ashears/2d-fighter-framework';
import type { FighterDefinition, Impact, MatchDefinition, MoveAction, MoveDefinition, ReadonlyDeep, StageDefinition } from '@ashears/2d-fighter-framework';

export const fighterIds = ['proposal-rock', 'chelan', 'rip-rap', 'the-house', 'duck-flag', 'ocean'] as const;
export const stageIds = ['ghost-forest', 'proposal-rock', 'breakwater', 'beach-access', 'king-tide'] as const;
export const ruleIds = ['health', 'stock'] as const;
export type FighterId = typeof fighterIds[number];
export type StageId = typeof stageIds[number];
export type RuleId = typeof ruleIds[number];

const impact = (damage: number, guardDamage: number, hitstun: number, x: number, y = 0): Impact =>
  ({ damage, guardDamage, hitstun, knockback: { x, y } });
const strike = (frame: number, duration: number, reach: number, hit: Impact, y = -74): MoveAction =>
  ({ type: 'hitbox', frame, duration, box: { x: 13, y, width: reach, height: 48 }, impact: hit });
const move = (name: string, startup: number, active: number, recovery: number, ...actions: MoveAction[]): MoveDefinition =>
  ({ name, startup, active, recovery, actions });
const projectile = (frame: number, velocity: number, height: number, size: number, hit: Impact, gravity = 0): MoveAction =>
  ({ type: 'projectile', frame, offset: { x: 40, y: height }, projectile: {
    box: { x: -size / 2, y: -size / 2, width: size, height: size },
    velocity: { x: velocity, y: gravity ? -3 : 0 }, gravity, lifetime: 92, impact: hit,
  } });

export const roster: ReadonlyDeep<Record<FighterId, FighterDefinition>> = {
  'proposal-rock': {
    id: 'proposal-rock', name: 'Proposal Rock', maxHealth: 118, maxGuard: 70, guardRegen: .34,
    walkSpeed: 4.25, jumpSpeed: 13.3, airJumps: 1, hurtbox: { x: -27, y: -100, width: 54, height: 100 },
    moves: {
      light: move('Basalt Jab', 6, 4, 11, strike(6, 4, 60, impact(12, 14, 15, 4))),
      heavy: move('Seastack Slam', 17, 6, 25, strike(17, 6, 86, impact(25, 34, 25, 8, -6))),
      special: move('Proposal Spin', 12, 11, 25, { type: 'impulse', frame: 12, velocity: { x: 19, y: 0 } },
        strike(12, 11, 78, impact(27, 42, 25, 12, -8))),
    },
  },
  chelan: {
    id: 'chelan', name: 'The Chelan', maxHealth: 97, maxGuard: 54, guardRegen: .54,
    walkSpeed: 5.65, jumpSpeed: 14.4, airJumps: 1, hurtbox: { x: -23, y: -93, width: 46, height: 93 },
    moves: {
      light: move('Poolside Pop', 4, 3, 10, strike(4, 3, 49, impact(9, 11, 12, 3))),
      heavy: move('Beach Ball', 12, 1, 21, projectile(12, 9, -53, 28, impact(15, 18, 17, 7), .08)),
      special: move('Chelanmania', 14, 7, 25, { type: 'impulse', frame: 9, velocity: { x: 13, y: -4 } },
        strike(14, 7, 79, impact(26, 34, 26, 11, -9))),
    },
  },
  'rip-rap': {
    id: 'rip-rap', name: 'Rip Rap', maxHealth: 112, maxGuard: 76, guardRegen: .26,
    walkSpeed: 4.85, jumpSpeed: 13.1, airJumps: 1, hurtbox: { x: -25, y: -91, width: 50, height: 91 },
    moves: {
      light: move('Stone Chip', 5, 4, 12, strike(5, 4, 47, impact(11, 13, 14, 3))),
      heavy: move('Breakwater Spikes', 15, 8, 22, strike(15, 8, 96, impact(20, 30, 24, 8, -8), -60)),
      special: move('Rolling Boulder', 19, 1, 26, projectile(19, 7.4, -24, 40, impact(23, 35, 23, 12, -5))),
    },
  },
  'the-house': {
    id: 'the-house', name: 'The House', maxHealth: 105, maxGuard: 60, guardRegen: .38,
    walkSpeed: 5.25, jumpSpeed: 14.8, airJumps: 1, hurtbox: { x: -25, y: -98, width: 50, height: 98 },
    moves: {
      light: move('Porch Knock', 4, 4, 9, strike(4, 4, 52, impact(10, 12, 13, 4))),
      heavy: move('Rafter Hook', 11, 6, 17, strike(11, 6, 66, impact(18, 23, 19, 8, -8), -88)),
      special: move('Porch Swing', 10, 10, 22, { type: 'impulse', frame: 10, velocity: { x: 14, y: 0 } },
        strike(10, 5, 62, impact(10, 14, 10, 3)), strike(15, 5, 72, impact(15, 22, 19, 9, -5))),
    },
  },
  'duck-flag': {
    id: 'duck-flag', name: 'Duck Flag', maxHealth: 94, maxGuard: 53, guardRegen: .44,
    walkSpeed: 5.55, jumpSpeed: 15.3, airJumps: 1, hurtbox: { x: -19, y: -99, width: 38, height: 99 },
    moves: {
      light: move('Pennant Snap', 5, 4, 10, strike(5, 4, 58, impact(8, 11, 13, 4))),
      heavy: move('Pocket Pass', 15, 1, 19, projectile(15, 11, -65, 24, impact(14, 18, 18, 7), .16)),
      special: move('Sideline Rush', 18, 8, 24, projectile(18, 12, -32, 37, impact(17, 22, 18, 8)),
        projectile(25, 10, -79, 25, impact(10, 17, 20, 9, -5))),
    },
  },
  ocean: {
    id: 'ocean', name: 'The Ocean', maxHealth: 123, maxGuard: 40, guardRegen: .28,
    walkSpeed: 4.15, jumpSpeed: 13.9, airJumps: 1, hurtbox: { x: -30, y: -99, width: 60, height: 99 },
    moves: {
      light: move('Foam Lash', 7, 4, 13, strike(7, 4, 68, impact(12, 15, 15, 5))),
      heavy: move('Breaker', 19, 1, 21, projectile(19, 7.2, -24, 46, impact(19, 26, 24, 11, -7))),
      special: move('Sneaker Wave', 30, 1, 22, projectile(30, 13, -31, 60, impact(35, 67, 32, 16, -8))),
    },
  },
};

const enclosed = (id: StageId, y = 442): StageDefinition => ({
  id, gravity: .67, fallSpeed: 19, walls: { left: 42, right: 918 },
  spawns: [{ x: 335, y }, { x: 625, y }],
  surfaces: [{ id: 'beach', x: 42, y, width: 876, oneWay: false }],
});

const platforms = (id: StageId, x: number, width: number, heights: [number, number, number]): StageDefinition => ({
  id, gravity: .67, fallSpeed: 19, blastZone: { x: -35, y: -90, width: 1030, height: 706 },
  spawns: [{ x: 335, y: 427 }, { x: 625, y: 427 }],
  surfaces: [
    { id: 'shore', x, y: 427, width, oneWay: false },
    { id: 'west-ledge', x: 223, y: heights[0], width: 174, oneWay: true },
    { id: 'east-ledge', x: 562, y: heights[1], width: 175, oneWay: true },
    { id: 'ridge', x: 417, y: heights[2], width: 125, oneWay: true },
  ],
});

export const arenas: ReadonlyDeep<Record<StageId, StageDefinition>> = {
  'ghost-forest': enclosed('ghost-forest'),
  'proposal-rock': platforms('proposal-rock', 156, 648, [323, 323, 227]),
  breakwater: platforms('breakwater', 140, 680, [345, 291, 215]),
  'beach-access': enclosed('beach-access', 439),
  'king-tide': enclosed('king-tide', 418),
};

export const stageInfo = {
  'ghost-forest': { name: 'Ghost Forest', description: 'An enclosed shoreline at low tide.', accent: '#f3ae82' },
  'proposal-rock': { name: 'Proposal Rock', description: 'A sea stack ringed by raised platforms.', accent: '#bce1a3' },
  breakwater: { name: 'Breakwater Ridge', description: 'Open edges and staggered landing spots.', accent: '#d5dcae' },
  'beach-access': { name: 'Beach Access', description: 'A short run-up and space to trade.', accent: '#e4b878' },
  'king-tide': { name: 'King Tide', description: 'An exposed beach under a rising tide.', accent: '#92dde1' },
} as const;

export const fighterInfo = {
  'proposal-rock': { role: 'Bruiser', range: 64, color: '#bce1a3', description: 'Hold the line, then close in with Proposal Spin.' },
  chelan: { role: 'Skirmisher', range: 126, color: '#b1e4ef', description: 'Use beach balls to force movement, then dash in with Chelanmania.' },
  'rip-rap': { role: 'Defender', range: 85, color: '#d1c4a8', description: 'Guard patiently and control the ground with a rolling boulder.' },
  'the-house': { role: 'Pressure', range: 57, color: '#ffc58e', description: 'Quick strings and a two-hit Porch Swing punish loose guard.' },
  'duck-flag': { role: 'Zoner', range: 138, color: '#e4db88', description: 'Make space for arcing passes and a staggered Sideline Rush.' },
  ocean: { role: 'Heavy zoner', range: 110, color: '#86e4de', description: 'Break guards with the telegraphed Sneaker Wave.' },
} as const;

export function supportsMatch(stage: string, rule: string) {
  return rule !== 'stock' || (stage === 'proposal-rock' || stage === 'breakwater');
}

export function coastConfig(fighters: readonly [FighterId, FighterId], stage: StageId, rule: RuleId, seed: number) {
  return {
    definition: {
      fighters: [roster[fighters[0]], roster[fighters[1]]], stage: arenas[stage], seed,
      timeLimit: (rule === 'health' ? 55 : 120) * TICK_RATE, intermissionTicks: 74,
    } satisfies ReadonlyDeep<MatchDefinition>,
    rules: rule === 'health' ? healthRules : stockRules,
  };
}
