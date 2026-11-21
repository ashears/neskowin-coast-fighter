import { createCampaign, createCpu, createMatch, healthRules, TICK_RATE } from '@ashears/2d-fighter-framework';
import type { CampaignFight, RivalProfile, RuleSet, Snapshot } from '@ashears/2d-fighter-framework';
import { coastConfig, roster } from './content.js';
import type { FighterId, RuleId, StageId } from './content.js';
import { normalizeCollection, palettes } from './cosmetics.js';
import type { Collection, PaletteId } from './cosmetics.js';

interface Bout {
  id: string;
  title: string;
  stage: StageId;
  player: FighterId;
  opponent: FighterId;
  story: string;
  rule: RuleId;
  format: string;
  tip: string;
  range: number;
  cadence: number;
  rival: RivalProfile;
}

export const bouts = [
  {
    id: 'ghost-forest-qualifier', title: 'Ghost Forest Qualifier', stage: 'ghost-forest', player: 'proposal-rock', opponent: 'chelan',
    story: 'Proposal Rock meets The Chelan among the fallen spruces. Whoever takes the round earns a place in the coastal tournament.',
    rule: 'health', format: 'Empty your opponent’s health bar to win the bout.',
    tip: 'Jump over Beach Throw, then attack while The Chelan recovers.',
    range: 220, cadence: 104, rival: { attacks: [{ within: 75, slots: ['light'] }, { within: 480, slots: ['heavy'] }] },
  },
  {
    id: 'beach-access-showdown', title: 'Beach Access Showdown', stage: 'beach-access', player: 'chelan', opponent: 'duck-flag',
    story: 'The Chelan takes the challenge down to the beach access, where Duck Flag has claimed the boardwalk.',
    rule: 'health', format: 'Empty your opponent’s health bar to take a round. Win two rounds.',
    tip: 'Jump the runner and get close. Guard when the motorcycle swings back.',
    range: 260, cadence: 83, rival: {
      retreatRange: 165, guardChance: 12, chargeTicks: { heavy: 20 },
      attacks: [{ within: 190, slots: ['light', 'heavy'] }, { within: 760, slots: ['special', 'heavy', 'light'] }],
    },
  },
  {
    id: 'breakwater-semifinal', title: 'Breakwater Semifinal', stage: 'breakwater', player: 'duck-flag', opponent: 'rip-rap',
    story: 'Duck Flag pushes out onto the breakwater. Rip Rap holds the ridge, with open water on both sides.',
    rule: 'stock', format: 'Knock Rip Rap out of the arena three times.',
    tip: 'Use the ledges to clear the boulder. Wait out Spike Crown before dropping in.',
    range: 112, cadence: 64, rival: {
      guardChance: 18,
      attacks: [
        { within: 115, slots: ['heavy'], airborneTarget: true },
        { within: 80, slots: ['light', 'heavy'] },
        { within: 480, slots: ['special'] },
      ],
    },
  },
  {
    id: 'proposal-rock-final', title: 'Proposal Rock Final', stage: 'proposal-rock', player: 'rip-rap', opponent: 'the-house',
    story: 'Rip Rap crosses to Proposal Rock for the final. The House is waiting above the tide.',
    rule: 'stock', format: 'Knock The House out of the arena three times.',
    tip: 'Porch Swing hits twice. Guard both hits, then strike during recovery.',
    range: 64, cadence: 48, rival: {
      guardChance: 16,
      attacks: [{ within: 72, slots: ['special', 'light', 'heavy'] }, { within: 165, slots: ['special'] }],
    },
  },
  {
    id: 'king-tide-championship', title: 'King Tide Championship', stage: 'king-tide', player: 'the-house', opponent: 'ocean',
    story: 'The tournament ends as the king tide reaches the beach. The House faces The Ocean to defend the shoreline.',
    rule: 'health', format: 'Empty The Ocean’s health bar to take a round. Win two rounds.',
    tip: 'Jump Sneaker Wave when it breaks. Land close and hit before the next swell.',
    range: 245, cadence: 116, rival: {
      attacks: [{ within: 90, slots: ['light'] }, { within: 700, slots: ['heavy', 'special'] }],
    },
  },
] as const satisfies readonly Bout[];

export type BoutId = typeof bouts[number]['id'];
export interface Progress extends Collection { completed: BoutId[] }

export const campaignKey = 'neskowin-coast-championship-v1';

const qualifierRules: RuleSet<null> = {
  ...healthRules,
  id: 'neskowin-qualifier-v1',
  evaluate(context) {
    const decision = healthRules.evaluate(context);
    return { ...decision, matchWinner: decision.roundWinner };
  },
};

function createBout(bout: Bout, seed: number): CampaignFight {
  const { definition: base, rules } = coastConfig([bout.player, bout.opponent], bout.stage, bout.rule, seed);
  const qualifier = bout.id === 'ghost-forest-qualifier';
  if (qualifier) {
    // Keep the first projectile off the starting frame so the player can read the fight.
    base.stage = { ...base.stage, spawns: [{ x: 385, y: 442 }, { x: 575, y: 442 }] };
  }
  const definition = {
    ...base,
    fighters: qualifier ? [base.fighters[0], { ...base.fighters[1], maxHealth: 70 }] as typeof base.fighters : base.fighters,
    timeLimit: (bout.rule === 'stock' ? 90 : 50) * TICK_RATE,
  };
  const dial = { seed, stage: definition.stage, preferredRange: bout.range, rival: bout.rival, recovery: true };
  const cpu = createCpu({ ...dial, reactionTicks: bout.cadence });
  const surge = bout.id === 'king-tide-championship'
    ? createCpu({
      ...dial, reactionTicks: 74, preferredRange: 170,
      rival: { ...bout.rival, projectileGuardRange: 100 },
    })
    : cpu;
  return {
    match: createMatch(definition, qualifier ? qualifierRules : rules),
    opponent: (snapshot) => {
      if (qualifier && snapshot.roundTick < 60) return 0;
      return (snapshot.round > 1 ? surge : cpu)(snapshot, 1);
    },
  };
}

const bracket = createCampaign<BoutId, undefined>(bouts.map((bout) => ({
  id: bout.id,
  createFight: (_player, seed) => createBout(bout, seed),
})));

export const campaign = {
  ...bracket,
  startBout(completed: readonly BoutId[], id: BoutId, seed: number) {
    return bracket.startBout(completed, id, undefined, seed);
  },
};

export function normalizeProgress(data: unknown): Progress {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const completed = campaign.normalize(record.completed);
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

export function recordBout(progress: Progress, id: BoutId, result: Pick<Snapshot, 'phase' | 'winner'>): Progress {
  const completed = campaign.recordResult(progress.completed, id, result);
  return completed === progress.completed ? progress : { ...progress, completed };
}

function earnedShells(completed: readonly BoutId[]) {
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
