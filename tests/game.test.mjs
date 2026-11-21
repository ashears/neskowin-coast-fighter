import assert from 'node:assert/strict';
import test from 'node:test';
import { Button, createMatch, createRecording, playRecording, snapshotChecksum } from '@ashears/2d-fighter-framework';
import { bouts, campaign, recordBout, normalizeProgress, shellBalance, equipPalette } from '../dist-server/campaign.js';
import { playBout } from './tournament-player.mjs';
import { coastConfig, fighterIds, stageIds, ruleIds, supportsMatch } from '../dist-server/content.js';

test('every supported roster and arena combination runs on the packaged core', () => {
  for (const stage of stageIds) for (const rule of ruleIds) {
    if (!supportsMatch(stage, rule)) continue;
    for (const first of fighterIds) for (const second of fighterIds) {
      const { definition, rules } = coastConfig([first, second], stage, rule, 1961);
      const match = createMatch(definition, rules);
      for (let index = 0; index < 95; index++) {
        match.step([index === 4 ? Button.Special : index < 22 ? Button.Right : 0,
          index === 18 ? Button.Heavy : index < 18 ? Button.Left : 0]);
      }
      const { fighters, tick } = match.snapshot();
      assert.equal(tick, 95);
      for (const fighter of fighters) {
        assert(Number.isFinite(fighter.position.x));
        assert(Number.isFinite(fighter.position.y));
      }
    }
  }
});

const qualifier = bouts[0];
const kingTide = bouts.at(-1);
const win = { phase: 'finished', winner: 0 };

test('the tournament validates progression and pays each prize once', () => {
  const initial = normalizeProgress(null);
  assert.equal(campaign.status(initial.completed, bouts[1].id), 'locked');
  assert.equal(recordBout(initial, kingTide.id, win), initial);
  assert.equal(recordBout(initial, qualifier.id, { ...win, winner: 1 }), initial);
  const cleared = recordBout(initial, qualifier.id, win);
  assert.equal(recordBout(cleared, qualifier.id, win), cleared);
  assert.equal(campaign.status(cleared.completed, bouts[1].id), 'available');
  assert.deepEqual(normalizeProgress({ completed: [qualifier.id, kingTide.id] }), cleared);
  assert.deepEqual(normalizeProgress({ completed: ['proposal-rock-cleanup'] }), initial);
  const completed = bouts.reduce((progress, { id }) => recordBout(progress, id, win), initial);
  assert.deepEqual(completed.completed, bouts.map(({ id }) => id));
  assert.equal(shellBalance(completed), 240);
});

test('all five bouts are winnable through combat and introduce their signature attacks', () => {
  for (const bout of bouts) {
    const cleared = bouts.slice(0, bouts.indexOf(bout)).map(({ id }) => id);
    const { match } = campaign.startBout(cleared, bout.id, 17);
    assert.deepEqual(match.definition.fighters.map(({ id }) => id), [bout.player, bout.opponent]);
    const result = playBout(bout);
    assert.equal(result.state.winner, 0, bout.title);
    assert(result.playerHits > 0, bout.title);
    if (bout.rule === 'stock') assert.equal(result.state.fighters[1].stocks, 0);
    else assert(result.wins.every(({ health }) => health === 0), bout.title);
    if (bout !== qualifier) assert(result.attacks.has('special'), bout.title);
  }
});

test('the assigned fighters can knock out The Chelan and The Ocean across seeds', () => {
  for (const seed of [1, 17, 867]) {
    for (const [bout, rounds] of [[qualifier, 1], [kingTide, 2]]) {
      const { state, wins } = playBout(bout, seed);
      assert.equal(state.winner, 0, bout.title);
      assert.equal(wins.length, rounds);
      assert(wins.every(({ health, ticks }) => health === 0 && ticks < 50 * 60));
    }
  }
});

test('King Tide launches both waves and the second round starts its next attack sooner', () => {
  const result = playBout(kingTide);
  assert(result.firstWaveWarning > 0);
  assert(result.attacks.has('heavy') && result.attacks.has('special'));
  assert.equal(playBout(kingTide, 17, true).state.winner, 1);
  const cleared = bouts.slice(0, -1).map(({ id }) => id);
  const { match, opponent } = campaign.startBout(cleared, kingTide.id, 17);
  const sample = (round) => {
    const snapshot = structuredClone(match.snapshot());
    snapshot.fighters[1].position.x = 560;
    return opponent({ ...snapshot, round, roundTick: 74, tick: 74 });
  };
  assert.equal(sample(1), 0);
  assert.equal(sample(2), Button.Special);
});

test('normal matches replay exactly', () => {
  const { definition, rules } = coastConfig(['proposal-rock', 'chelan'], 'proposal-rock', 'stock', 42);
  const match = createMatch(definition, rules);
  const frames = [];
  for (let tick = 0; tick < definition.timeLimit && match.snapshot().phase === 'playing'; tick++) {
    const frame = [Button.Left, 0];
    frames.push(frame);
    match.step(frame);
  }
  const replay = playRecording(definition, rules, createRecording(match, frames));
  assert.equal(snapshotChecksum(replay.snapshot), snapshotChecksum(match.snapshot()));
});

test('shell purchases are affordable, idempotent, and compatible with persisted campaign clears', () => {
  const fresh = normalizeProgress(null);
  assert.equal(shellBalance(fresh), 0);
  assert.equal(equipPalette(fresh, 'daybreak'), fresh);
  const cleared = recordBout(fresh, qualifier.id, win);
  assert.equal(shellBalance(cleared), 60);
  const bought = equipPalette(cleared, 'daybreak');
  assert.deepEqual(bought.owned, ['daybreak']);
  assert.equal(bought.equipped, 'daybreak');
  assert.equal(shellBalance(bought), 0);
  assert.equal(equipPalette(bought, 'daybreak'), bought);
  assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(bought))), bought);
  assert.equal(normalizeProgress({ ...cleared, owned: ['spruce'], equipped: 'spruce' }).equipped, null);
});
