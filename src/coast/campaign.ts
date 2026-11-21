import { Button, createMatch, createCpu, healthRules, TICK_RATE } from '@ashears/2d-fighter-framework';
import type { Json, Match, MatchDefinition, ReadonlyDeep, RuleSet, Snapshot } from '@ashears/2d-fighter-framework';
import { coastConfig, fighterInfo, roster } from './content.js';
import type { FighterId, RuleId, StageId } from './content.js';
import { normalizeCollection, palettes } from './cosmetics.js';
import type { Collection, PaletteId } from './cosmetics.js';

interface Stop {
  id: string;
  title: string;
  stage: StageId;
  opponent: FighterId;
  rule: RuleId;
  objective: string;
  unlock?: FighterId;
}

export const stops = [
  { id: 'proposal-rock-cleanup', title: 'Beach Cleanup', stage: 'ghost-forest', opponent: 'proposal-rock', rule: 'health',
    objective: 'Reach each piece of debris and use the marked attack. Collect five before the tide comes in.', unlock: 'chelan' },
  { id: 'chelan-opener', title: 'Chelan Shore', stage: 'beach-access', opponent: 'chelan', rule: 'health',
    objective: 'Win two rounds against The Chelan. Jump over beach balls to close the distance.' },
  { id: 'rip-rap-ridge', title: 'Rip Rap Ridge', stage: 'breakwater', opponent: 'rip-rap', rule: 'stock',
    objective: 'Take Rip Rap’s three stocks. Use the ledges to avoid rolling boulders.', unlock: 'rip-rap' },
  { id: 'the-house-steps', title: 'House Steps', stage: 'proposal-rock', opponent: 'the-house', rule: 'stock',
    objective: 'Keep your footing against The House and its two-hit Porch Swing.', unlock: 'the-house' },
  { id: 'ocean-boss', title: 'King Tide', stage: 'king-tide', opponent: 'ocean', rule: 'health',
    objective: 'Survive 32 seconds of breakers. Watch for the long Sneaker Wave windup.', unlock: 'ocean' },
] as const satisfies readonly Stop[];
export type StopId = typeof stops[number]['id'];

export interface Progress extends Collection { completed: StopId[] }

export const campaignKey = 'neskowin-coast-fighter-progress-v2';
export const legacyKey = 'neskowin-coast-fighter-campaign';

export function normalizeProgress(data: unknown): Progress {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const ids = record.completed ?? record.completedLevelIds;
  if (!Array.isArray(ids)) return { completed: [], owned: [], equipped: null };
  const completed: StopId[] = [];
  for (const stop of stops) {
    if (!ids.includes(stop.id)) break;
    completed.push(stop.id);
  }
  const collection = normalizeCollection(record);
  const budget = earnedShells(completed);
  let spent = 0;
  const owned = collection.owned.filter((id) => {
    const price = palettes.find((palette) => palette.id === id)!.price;
    if (price + spent > budget) return false;
    spent += price;
    return true;
  });
  return { completed, owned, equipped: collection.equipped && owned.includes(collection.equipped) ? collection.equipped : null };
}

export function unlockedFighters(progress: Progress): FighterId[] {
  const fighters: FighterId[] = ['proposal-rock', 'duck-flag'];
  for (const stop of stops satisfies readonly Stop[]) {
    if ('unlock' in stop && progress.completed.includes(stop.id)) fighters.push(stop.unlock);
  }
  return fighters;
}

export function available(progress: Progress, stop: StopId) {
  const index = stops.findIndex(({ id }) => id === stop);
  return index >= 0 && index <= progress.completed.length;
}

export function completeStop(progress: Progress, stop: StopId, victory: boolean): Progress {
  if (!victory || !available(progress, stop) || progress.completed.includes(stop)) return progress;
  return { ...progress, completed: [...progress.completed, stop] };
}

function earnedShells(completed: readonly StopId[]) {
  return completed.length ? 60 + (completed.length - 1) * 45 : 0;
}

export function shellBalance(progress: Progress) {
  const spent = palettes.reduce((sum, palette) => sum + (progress.owned.includes(palette.id) ? palette.price : 0), 0);
  return earnedShells(progress.completed) - spent;
}

export function equipPalette(progress: Progress, id: PaletteId | null): Progress {
  if (progress.equipped === id) return progress;
  if (id === null || progress.owned.includes(id)) return { ...progress, equipped: id };
  const palette = palettes.find((option) => option.id === id);
  if (!palette || palette.price > shellBalance(progress)) return progress;
  return { ...progress, owned: [...progress.owned, id], equipped: id };
}

const cleanups = [
  { x: 310, input: Button.Light, label: 'Light · F', debris: 'Bottle' },
  { x: 535, input: Button.Heavy, label: 'Heavy · G', debris: 'Tangled rope' },
  { x: 355, input: Button.Special, label: 'Special · H', debris: 'Broken crate' },
  { x: 605, input: Button.Light, label: 'Light · F', debris: 'Can' },
  { x: 430, input: Button.Heavy, label: 'Heavy · G', debris: 'Drift net' },
] as const;
const cleanupKeys = Button.Light | Button.Heavy | Button.Special;
export const cleanupRadius = 95;
type Cleanup = { collected: number; mistakes: number; previousInput: number };

function blankMove(name: string, startup = 2) {
  return { name, startup, active: 1, recovery: 6, actions: [] };
}

const cleanupRules: RuleSet<Cleanup> = {
  ...healthRules,
  id: 'beach-cleanup-v2',
  initialize: () => ({ collected: 0, mistakes: 0, previousInput: 0 }),
  evaluate({ fighters, state, timedOut }) {
    const current = cleanups[state.collected];
    const player = fighters[0];
    const pressed = player.previousInput & ~state.previousInput & cleanupKeys;
    const attempted = !!current && !!pressed && Math.abs(player.position.x - current.x) <= cleanupRadius;
    const correct = attempted && pressed === current.input;
    const next = {
      collected: state.collected + Number(correct), mistakes: state.mistakes + Number(attempted && !correct),
      previousInput: player.previousInput,
    };
    const matchWinner = next.collected === cleanups.length ? 0 : next.mistakes >= 3 || timedOut ? 1 : undefined;
    return { state: next, matchWinner };
  },
};

const tideRules: RuleSet<null> = {
  ...healthRules, id: 'king-tide-v2',
  evaluate({ fighters, timedOut }) {
    return { state: null, matchWinner: fighters[0].health === 0 ? 1 : timedOut ? 0 : undefined };
  },
};

export function cleanupStatus(snapshot: Snapshot) {
  const cleanup = snapshot.ruleState as Cleanup;
  return { ...cleanup, total: cleanups.length, item: cleanups[cleanup.collected] };
}

export interface CampaignFight {
  match: Match<Json>;
  opponent: (snapshot: Snapshot) => number;
}

export function campaignFight(id: StopId, player: FighterId, seed: number): CampaignFight {
  const stop = stops.find((candidate) => candidate.id === id)!;
  const { definition, rules } = coastConfig([player, stop.opponent], stop.stage, stop.rule, seed);
  if (id === 'proposal-rock-cleanup') {
    const base = roster[player];
    const cleanup: ReadonlyDeep<MatchDefinition> = {
      ...definition,
      timeLimit: 28 * TICK_RATE,
      fighters: [
        { ...base, moves: { light: blankMove('Pick up'), heavy: blankMove('Gather'), special: blankMove('Clear debris') } },
        { ...roster['proposal-rock'], pushbox: { x: -12, y: -250, width: 24, height: 50 } },
      ],
      stage: { ...definition.stage, spawns: [{ x: 235, y: 442 }, { x: 830, y: 442 }] },
    };
    return { match: createMatch(cleanup, cleanupRules), opponent: () => 0 };
  }
  if (id === 'ocean-boss') {
    const ocean = roster.ocean;
    const tide: ReadonlyDeep<MatchDefinition> = {
      ...definition,
      timeLimit: 32 * TICK_RATE,
      fighters: [roster[player], { ...ocean, maxHealth: 2000, maxGuard: 0, walkSpeed: 0, jumpSpeed: 8 }],
      stage: { ...definition.stage, spawns: [{ x: 330, y: 418 }, { x: 843, y: 418 }] },
    };
    return {
      match: createMatch(tide, tideRules),
      opponent: ({ tick }) => {
        if (tick < 55) return 0;
        const beat = (tick - 55) % 510;
        if (beat === 0 || beat === 130) return Button.Heavy;
        if (beat === 278 || beat === 400) return Button.Special;
        return 0;
      },
    };
  }
  const cpu = createCpu({
    seed, preferredRange: fighterInfo[stop.opponent].range, stage: definition.stage,
    reactionTicks: id === 'chelan-opener' ? 20 : id === 'rip-rap-ridge' ? 15 : 11,
  });
  return { match: createMatch(definition, rules), opponent: (snapshot) => cpu(snapshot, 1) };
}
