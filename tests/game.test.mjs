import assert from 'node:assert/strict';
import test from 'node:test';
import { Button, createMatch, createRecording, playRecording, snapshotChecksum } from '@ashears/2d-fighter-framework';
import { campaignFight, completeStop, normalizeProgress, stops, unlockedFighters, available, cleanupStatus, shellBalance, equipPalette } from '../dist-server/campaign.js';
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

test('campaign save migration validates sequential clears and unlocks exactly once', () => {
  const initial = normalizeProgress(null);
  assert.deepEqual(unlockedFighters(initial), ['proposal-rock', 'duck-flag']);
  assert.equal(available(initial, 'chelan-opener'), false);
  assert.equal(completeStop(initial, 'ocean-boss', true), initial);
  assert.equal(completeStop(initial, 'proposal-rock-cleanup', false), initial);
  const cleared = completeStop(initial, 'proposal-rock-cleanup', true);
  assert.equal(completeStop(cleared, 'proposal-rock-cleanup', true), cleared);
  assert(available(cleared, 'chelan-opener'));
  assert.deepEqual(unlockedFighters(cleared), ['proposal-rock', 'duck-flag', 'chelan']);
  assert.deepEqual(normalizeProgress({ completedLevelIds: ['ocean-boss', 'proposal-rock-cleanup', 'unknown', 'proposal-rock-cleanup'] }), cleared);
  const completed = stops.reduce((progress, { id }) => completeStop(progress, id, true), initial);
  assert.equal(new Set(unlockedFighters(completed)).size, fighterIds.length);
});

function runCleanup(seed) {
  const { match } = campaignFight('proposal-rock-cleanup', 'proposal-rock', seed);
  const commands = [Button.Light, Button.Heavy, Button.Special, Button.Light, Button.Heavy];
  for (const command of commands) {
    const { item } = cleanupStatus(match.snapshot());
    while (Math.abs(match.snapshot().fighters[0].position.x - item.x) > 15) {
      const current = match.snapshot().fighters[0].position.x;
      match.step([current < item.x ? Button.Right : Button.Left, 0]);
      assert(match.snapshot().phase === 'playing');
    }
    match.step([command, 0]);
    match.step([0, 0]);
  }
  return match.snapshot();
}

test('beach cleanup tracks exact fresh attacks and fails after three mistakes', () => {
  const solved = runCleanup(8);
  assert.equal(solved.winner, 0);
  assert.equal(cleanupStatus(solved).collected, 5);
  assert.deepEqual(runCleanup(8), solved);
  const { match } = campaignFight('proposal-rock-cleanup', 'duck-flag', 8);
  for (let mistake = 1; mistake <= 3; mistake++) {
    match.step([Button.Heavy, 0]);
    assert.equal(cleanupStatus(match.snapshot()).mistakes, mistake);
    if (mistake < 3) {
      match.step([Button.Heavy, 0]);
      assert.equal(cleanupStatus(match.snapshot()).mistakes, mistake);
      match.step([0, 0]);
    }
  }
  assert.equal(match.snapshot().winner, 1);
});

test('King Tide telegraphs and launches waves and rewards surviving the timer', () => {
  const { match, opponent } = campaignFight('ocean-boss', 'proposal-rock', 1);
  let telegraphs = 0;
  let waves = 0;
  for (let tick = 0; tick <= 32 * 60 && match.snapshot().phase === 'playing'; tick++) {
    const snapshot = match.snapshot();
    const me = snapshot.fighters[0];
    const approaching = snapshot.projectiles.some(({ position }) => position.x > me.position.x && position.x - me.position.x < 188);
    const frame = approaching && me.surface ? Button.Jump : 0;
    for (const event of match.step([frame, opponent(snapshot)]).events) {
      if (event.type === 'attack' && event.seat === 1) telegraphs++;
      if (event.type === 'projectile' && event.seat === 1) waves++;
    }
  }
  assert(telegraphs > 5);
  assert.equal(waves, telegraphs);
  assert.equal(match.snapshot().winner, 0);
  assert.equal(match.snapshot().roundTick, 32 * 60);
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
  const cleared = completeStop(fresh, 'proposal-rock-cleanup', true);
  assert.equal(shellBalance(cleared), 60);
  const bought = equipPalette(cleared, 'daybreak');
  assert.deepEqual(bought.owned, ['daybreak']);
  assert.equal(bought.equipped, 'daybreak');
  assert.equal(shellBalance(bought), 0);
  assert.equal(equipPalette(bought, 'daybreak'), bought);
  assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(bought))), bought);
  assert.equal(normalizeProgress({ ...cleared, owned: ['spruce'], equipped: 'spruce' }).equipped, null);
});
