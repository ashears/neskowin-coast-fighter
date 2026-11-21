import { surfaceSpawn, healthRules, stockRules, TICK_RATE } from '@ashears/2d-fighter-framework';
import type { FighterDefinition, Impact, MatchDefinition, MoveAction, MoveDefinition, MoveId, ProjectileDefinition, ReadonlyDeep, StageDefinition } from '@ashears/2d-fighter-framework';

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
const aerial = (name: string, startup: number, active: number, lag: number, action: MoveAction): MoveDefinition =>
  ({ ...move(name, startup, active, 12, action), airControl: .26, landingLag: lag });
const recovery = (name: string, x: number, y: number, control: number, lag: number): MoveDefinition =>
  ({ ...move(name, 0, 9, 23, { type: 'impulse', frame: 0, velocity: { x, y } }), airControl: control, landingLag: lag });
const wave = (frame: number, velocity: number, width: number, height: number, appearance: string, hit: Impact): MoveAction =>
  ({ type: 'projectile', frame, offset: { x: 40, y: -height / 2 }, projectile: {
    appearance, box: { x: -width / 2, y: -height / 2, width, height },
    velocity: { x: velocity, y: 0 }, lifetime: 92, impact: hit,
  } });

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const beachItem = (appearance: string, speed: number, lift: number, size: number, hit: Impact): ProjectileDefinition => ({
  appearance, box: box(-size / 2, -size / 2, size, size),
  velocity: { x: speed, y: lift }, gravity: .22, lifetime: 84, impact: hit,
});
const beachBall = beachItem('beach-ball', 9.5, -2.2, 35, impact(12, 15, 16, 6, -3));
const beachItems = [
  { weight: 19, projectile: beachBall },
  { weight: 19, projectile: beachItem('shovel', 11.5, -1.6, 36, impact(15, 19, 18, 7, -4)) },
  { weight: 19, projectile: beachItem('fish', 12.1, -2.4, 34, impact(13, 16, 16, 7, -3)) },
  { weight: 19, projectile: beachItem('chair', 8.7, -2.8, 43, impact(17, 23, 20, 9, -5)) },
  { weight: 19, projectile: beachItem('towel', 10.5, -3.2, 39, impact(10, 13, 15, 5, -2)) },
  { weight: 5, projectile: beachItem('tourist', 8.1, -3.4, 49, impact(20, 27, 22, 10, -6)) },
];

export const roster: ReadonlyDeep<Record<FighterId, FighterDefinition>> = {
  'proposal-rock': {
    id: 'proposal-rock', name: 'Proposal Rock', maxHealth: 118, maxGuard: 70, guardRegen: .34,
    airDrift: .30, fastFallSpeed: 19, walkSpeed: 4.25, jumpSpeed: 13.3, airJumps: 1, stockWeight: 1.15, hurtbox: { x: -27, y: -100, width: 54, height: 100 },
    moves: {
      light: { ...move('Starfish Mine', 6, 1, 15, {
        type: 'projectile', frame: 6, offset: { x: -62, y: -19 }, projectile: {
          appearance: 'starfish', motion: { type: 'ground' }, armTicks: 25, lifetime: 360,
          box: box(-55, -22, 110, 28), velocity: { x: 0, y: 0 },
          impact: { ...impact(15, 18, 19, 8, -7), knockbackFromContact: true },
        },
      }), cooldownTicks: 110 },
      heavy: { ...move('Body Slam', 9, 51, 19,
        { type: 'impulse', frame: 0, velocity: { x: 6.4, y: -10.8 } },
        { type: 'hitbox', frame: 9, duration: 51, onLanding: true, box: box(-99, -100, 198, 100),
          impact: { ...impact(25, 31, 24, 10, -8), knockbackFromContact: true } }),
      cooldownTicks: 95 },
      special: { ...move('Proposal Spin Charge', 0, 16, 20,
        { type: 'impulse', frame: 0, velocity: { x: 9.7, y: -3.8 }, chargedVelocity: { x: 17.2, y: -5 } },
        strike(0, 16, 84, impact(28, 39, 25, 13, -8))), chargeTicks: 56, cooldownTicks: 110 },
      downLight: move('Rock Chip', 4, 4, 10, strike(4, 4, 48, impact(8, 9, 11, 4))),
      airLight: aerial('Rock Chip', 4, 4, 9, strike(4, 4, 48, impact(8, 9, 11, 4), -50)),
      recovery: recovery('Sea Stack Rise', 4.2, -13.8, .21, 15),
    },
  },
  chelan: {
    id: 'chelan', name: 'The Chelan', maxHealth: 97, maxGuard: 54, guardRegen: .54,
    walkSpeed: 5.65, airDrift: .50, fastFallSpeed: 16, jumpSpeed: 14.4, airJumps: 1, stockWeight: .93, hurtbox: { x: -23, y: -93, width: 46, height: 93 },
    moves: {
      light: move('Poolside Pop', 4, 3, 10, strike(4, 3, 49, impact(9, 11, 12, 3))),
      heavy: { ...move('Beach Throw', 9, 1, 16, {
        type: 'projectile', frame: 9, offset: { x: 45, y: -56 }, projectile: beachBall, variants: beachItems, previewVariant: true,
      }), cooldownTicks: 39 },
      special: { ...move('Chelanmania Driver', 10, 7, 33,
        { type: 'impulse', frame: 9, velocity: { x: 12, y: 0 } },
        { type: 'hitbox', frame: 10, duration: 7, box: box(15, -82, 55, 60),
          impact: { ...impact(0, 0, 20, 0, -3.2), unblockable: true },
          followup: { delay: 17, impact: impact(28, 0, 24, 10, -8) } }),
      cooldownTicks: 110 },
      recovery: recovery('Pool Spring', 5, -13.5, .3, 11),
    },
  },
  'rip-rap': {
    id: 'rip-rap', name: 'Rip Rap', maxHealth: 112, maxGuard: 76, guardRegen: .26,
    walkSpeed: 4.85, airDrift: .26, fastFallSpeed: 19, jumpSpeed: 13.1, airJumps: 1, stockWeight: 1.12, hurtbox: { x: -25, y: -91, width: 50, height: 91 },
    moves: {
      light: move('Stone Chip', 5, 4, 12, strike(5, 4, 47, impact(11, 13, 14, 3))),
      heavy: move('Spike Crown', 12, 6, 22, {
        type: 'hitbox', frame: 12, duration: 6, box: box(-89, -165, 178, 132),
        impact: { ...impact(20, 30, 24, 7, -9), knockbackFromContact: true },
      }),
      special: { ...move('Breakwater Boulder', 10, 1, 17, {
        type: 'projectile', frame: 10, offset: { x: 49, y: -30 }, projectile: {
          appearance: 'boulder', motion: { type: 'ground' }, lifetime: 265, rehitTicks: 265,
          box: box(-29, -29, 58, 58), velocity: { x: 3.35, y: 0 }, impact: impact(21, 31, 23, 11, -6),
        },
      }), cooldownTicks: 95 },
      airHeavy: aerial('Ballast Drop', 9, 6, 15, {
        type: 'hitbox', frame: 9, duration: 6, box: box(-22, -29, 70, 48), impact: impact(16, 17, 16, 4, 8),
      }),
      recovery: recovery('Stone Step', 2.8, -12.8, .17, 15),
    },
  },
  'the-house': {
    id: 'the-house', name: 'The House', maxHealth: 105, maxGuard: 60, guardRegen: .38,
    walkSpeed: 5.25, airDrift: .40, fastFallSpeed: 18, jumpSpeed: 14.8, airJumps: 1, stockWeight: 1.04, hurtbox: { x: -25, y: -98, width: 50, height: 98 },
    moves: {
      light: move('Porch Knock', 4, 4, 9, strike(4, 4, 52, impact(10, 12, 13, 4))),
      heavy: move('Rafter Hook', 11, 6, 17, strike(11, 6, 66, impact(18, 23, 19, 8, -8), -88)),
      special: move('Porch Swing', 10, 10, 22, { type: 'impulse', frame: 10, velocity: { x: 14, y: 0 } },
        strike(10, 5, 62, impact(10, 14, 10, 3)), strike(15, 5, 72, impact(15, 22, 19, 9, -5))),
      airHeavy: aerial('Rafter Hook Up', 7, 5, 11, {
        type: 'hitbox', frame: 7, duration: 5, box: box(-25, -155, 69, 68), impact: impact(15, 19, 18, 4, -10),
      }),
      recovery: recovery('Awning Spring', 4.7, -14.3, .25, 12),
    },
  },
  'duck-flag': {
    id: 'duck-flag', name: 'Duck Flag', maxHealth: 94, maxGuard: 53, guardRegen: .44,
    walkSpeed: 5.55, airDrift: .60, fastFallSpeed: 17, jumpSpeed: 15.3, airJumps: 1, stockWeight: .9, hurtbox: { x: -19, y: -99, width: 38, height: 99 },
    moves: {
      light: { ...move('LaMichael Rush', 23, 1, 12, {
        type: 'projectile', frame: 23, offset: { x: 29, y: -34 }, projectile: {
          appearance: 'runner', motion: { type: 'ground' }, lifetime: 62,
          box: box(-26, -42, 52, 56), velocity: { x: 13, y: 0 }, impact: impact(11, 14, 15, 7, -4),
        },
      }), cooldownTicks: 49 },
      heavy: { ...move('Joey Harrington Pass', 2, 1, 23, {
        type: 'projectile', frame: 2, offset: { x: 37, y: -67 }, projectile: {
          appearance: 'football', lifetime: 113, box: box(-17, -10, 34, 20), gravity: .23,
          velocity: { x: 8.2, y: -2.1 }, chargedVelocity: { x: 13.5, y: -8.1 },
          impact: impact(15, 19, 18, 8, -5),
        },
      }), chargeTicks: 66, cooldownTicks: 65 },
      special: { ...move('Mascot Moto Loop', 17, 1, 23, {
        type: 'projectile', frame: 17, offset: { x: 0, y: -50 }, projectile: {
          appearance: 'mascot', motion: { type: 'orbit', radius: { x: 142, y: 25 }, period: 116, trackX: .009 },
          armTicks: 19, rehitTicks: 89, lifetime: 385, box: box(-48, -28, 96, 56), velocity: { x: 0, y: 0 },
          impact: { ...impact(8, 12, 15, 5, -3), knockbackFromContact: true },
        },
      }), cooldownTicks: 402 },
      downLight: move('Flagpole Poke', 4, 4, 10, strike(4, 4, 53, impact(8, 10, 12, 4))),
      recovery: recovery('Coastal Updraft', 7, -12.5, .31, 10),
    },
  },
  ocean: {
    id: 'ocean', name: 'The Ocean', maxHealth: 123, maxGuard: 40, guardRegen: .28,
    walkSpeed: 4.15, airDrift: .24, fastFallSpeed: 17, jumpSpeed: 13.9, airJumps: 1, stockWeight: 1.16, hurtbox: { x: -30, y: -99, width: 60, height: 99 },
    moves: {
      light: move('Foam Lash', 7, 4, 13, strike(7, 4, 68, impact(12, 15, 15, 5))),
      heavy: move('Breaker', 19, 1, 21, wave(19, 7.2, 52, 35, 'breaker', impact(19, 26, 24, 11, -7))),
      special: move('Sneaker Wave', 30, 1, 24, wave(30, 13, 60, 65, 'sneaker-wave', {
        ...impact(35, 67, 32, 16, -8), stock: { guardDamage: 30, hitstun: 19, knockback: { x: 8.4, y: -7 }, scaling: 1.45 },
      })),
      airLight: aerial('Foam Flick', 4, 4, 7, strike(4, 4, 52, impact(8, 8, 10, 4, -2), -58)),
      recovery: recovery('Crest Lift', 3.8, -13.3, .23, 14),
    },
  },
};

type Terrain = StageDefinition['surfaces'][number];
function ledge(id: string, x: number, y: number, width: number, material: string, endY = y): Terrain {
  return { id, x, y, endY, width, material, oneWay: true };
}

function enclosed(id: StageId, y: number, shelves: Terrain[] = []): StageDefinition {
  return {
    id, gravity: .67, fallSpeed: 19, walls: { left: 42, right: 918 },
    spawns: [{ x: 335, y }, { x: 625, y }],
    surfaces: [{ id: 'beach', x: 42, y, width: 876, oneWay: false, material: 'sand' }, ...shelves],
  };
}

function headland(id: StageId, surfaces: Terrain[], left: [string, number], right: [string, number]): StageDefinition {
  return {
    id, gravity: .67, fallSpeed: 19, blastZone: { x: -35, y: -90, width: 1030, height: 706 },
    spawns: [surfaceSpawn(surfaces, ...left), surfaceSpawn(surfaces, ...right)],
    surfaces,
  };
}

export const arenas: ReadonlyDeep<Record<StageId, StageDefinition>> = {
  'ghost-forest': enclosed('ghost-forest', 442, [
    ledge('driftwood', 112, 350, 145, 'timber', 338), ledge('fallen-spruce', 690, 318, 142, 'timber', 332),
  ]),
  'proposal-rock': headland('proposal-rock', [
    { id: 'shore', x: 156, y: 427, width: 648, oneWay: false, material: 'basalt' },
    ledge('west-ledge', 223, 323, 174, 'moss'), ledge('east-ledge', 562, 323, 175, 'moss'),
    ledge('ridge', 417, 227, 125, 'moss'),
  ], ['shore', 179], ['shore', 469]),
  breakwater: headland('breakwater', [
    { id: 'west-bank', x: 124, y: 446, endY: 395, width: 248, oneWay: false, material: 'basalt' },
    { id: 'crest', x: 372, y: 395, width: 168, oneWay: false, material: 'moss' },
    { id: 'east-bank', x: 540, y: 395, endY: 451, width: 282, oneWay: false, material: 'basalt' },
    ledge('jetty', 180, 328, 168, 'timber', 307), ledge('lookout', 460, 245, 148, 'moss'),
    ledge('outer-reef', 702, 351, 142, 'basalt', 331),
  ], ['west-bank', 211], ['east-bank', 85]),
  'beach-access': enclosed('beach-access', 439, [ledge('boardwalk', 380, 332, 264, 'timber')]),
  'king-tide': enclosed('king-tide', 418),
};

export const stageInfo = {
  'ghost-forest': { name: 'Ghost Forest', description: 'Jump between the fallen spruces above the beach.', accent: '#f3ae82' },
  'proposal-rock': { name: 'Proposal Rock', description: 'A sea stack ringed by raised platforms.', accent: '#bce1a3' },
  breakwater: { name: 'Breakwater Ridge', description: 'Race up the basalt banks or take the high lookout.', accent: '#d5dcae' },
  'beach-access': { name: 'Beach Access', description: 'Fight beneath the boardwalk or drop through it from above.', accent: '#e4b878' },
  'king-tide': { name: 'King Tide', description: 'An exposed beach under a rising tide.', accent: '#92dde1' },
} as const;

export const fighterInfo = {
  'proposal-rock': { role: 'Bruiser', range: 64, color: '#bce1a3', description: 'Set a mine behind you, then close in with a charged spin or a landing slam.' },
  chelan: { role: 'Skirmisher', range: 126, color: '#b1e4ef', description: 'Throw beach gear to force movement, then punish a defender with a grab.' },
  'rip-rap': { role: 'Defender', range: 85, color: '#d1c4a8', description: 'Catch jump-ins with overhead spikes and control the ground with a slow boulder.' },
  'the-house': { role: 'Pressure', range: 57, color: '#ffc58e', description: 'Quick strings and a two-hit Porch Swing punish loose guard.' },
  'duck-flag': { role: 'Zoner', range: 138, color: '#e4db88', description: 'Send a runner down the beach, charge a deep pass, or call in the mascot.' },
  ocean: { role: 'Heavy zoner', range: 110, color: '#86e4de', description: 'Control the shore with Breaker and launch opponents with Sneaker Wave.' },
} as const;

export const moveNotes: Partial<Record<FighterId, Partial<Record<MoveId, string>>>> = {
  'proposal-rock': {
    light: 'Plants a mine behind you. It arms after a short delay.',
    heavy: 'Leap forward and hit both sides when you land.',
    special: 'Hold to charge. Release to spin forward. More charge carries you farther.',
  },
  chelan: {
    heavy: 'Watch the windup to see which beach item is coming. Each item has its own arc and impact.',
    special: 'Dash in for a close grab that beats guard. The slam follows on contact.',
  },
  'rip-rap': {
    heavy: 'Spikes erupt above you and catch opponents on either side.',
    special: 'Send a slow boulder along the ground.',
  },
  'duck-flag': {
    light: 'Summon LaMichael James for a rush along the ground.',
    heavy: 'Hold to charge. Release for a pass from Joey Harrington. More charge sends it higher and farther.',
    special: 'Call the motorcycle mascot. Watch the marked route for its next pass.',
  },
};

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
