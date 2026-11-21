import assert from 'node:assert/strict';
import test from 'node:test';
import { Button, createMatch, createRecording, getProjectileDefinition, playRecording, serializeSnapshot } from '@ashears/2d-fighter-framework';
import { coastConfig } from '../dist-server/content.js';

function fight(attacker, { positions, stage = 'ghost-forest', rule = 'health', seed = 19 } = {}) {
  const { definition, rules } = coastConfig([attacker, 'the-house'], stage, rule, seed);
  if (positions) definition.stage = { ...definition.stage, spawns: positions };
  return { match: createMatch(definition, rules), rules };
}

function step(match, count, frame = [0, 0]) {
  return Array.from({ length: count }, () => match.step(frame));
}

function hitEvents(results) {
  return results.flatMap(({ events }) => events.filter(({ type }) => type === 'hit'));
}

test('Starfish Mine plants behind Proposal Rock, arms in place, and pushes away from either side', () => {
  const { match, rules } = fight('proposal-rock');
  const { snapshot } = step(match, 7, [Button.Light, 0]).at(-1);
  const mine = snapshot.projectiles[0];
  const shape = getProjectileDefinition(match.definition, mine);
  assert.equal(shape.appearance, 'starfish');
  assert(mine.position.x < snapshot.fighters[0].position.x);
  assert.equal(mine.position.y + shape.box.y + shape.box.height, 442);
  for (const direction of [-1, 1]) {
    const saved = JSON.parse(serializeSnapshot(snapshot));
    saved.fighters[1].position.x = mine.position.x + direction * 28;
    const restored = createMatch(match.definition, rules, saved);
    assert.equal(hitEvents(step(restored, shape.armTicks - 1)).length, 0);
    const armed = restored.step([0, 0]);
    assert.equal(hitEvents([armed])[0].damage, 15);
    assert.equal(Math.sign(armed.snapshot.fighters[1].velocity.x), direction);
    assert.equal(armed.snapshot.projectiles.length, 0);
  }
});

test('Body Slam only hits on landing and launches the opponent on either side', () => {
  for (const x of [245, 625]) {
    const { match, rules } = fight('proposal-rock', { positions: [{ x: 335, y: 442 }, { x, y: 442 }] });
    const launch = match.step([Button.Heavy, 0]);
    assert(launch.snapshot.fighters[0].position.y < 442);
    assert.equal(launch.snapshot.fighters[0].surface, null);
    assert.equal(hitEvents([launch]).length, 0);
    const flight = step(match, 18);
    assert.equal(hitEvents(flight).length, 0);
    const restored = createMatch(match.definition, rules, JSON.parse(serializeSnapshot(match.snapshot())));
    const outcome = step(match, 25);
    assert.deepEqual(step(restored, 25), outcome);
    const landing = outcome.find(({ events }) => events.some(({ type, seat }) => type === 'land' && seat === 0));
    assert.equal(hitEvents(outcome).length, 1);
    assert.equal(hitEvents([landing])[0].damage, 25);
    assert(landing.snapshot.fighters[1].velocity.y < 0);
  }
});

test('Proposal Spin Charge waits for release, gains distance, and auto-releases at full charge', () => {
  const tap = fight('proposal-rock').match;
  const held = fight('proposal-rock').match;
  const max = fight('proposal-rock').match;
  tap.step([Button.Special, 0]);
  const release = tap.step([0, 0]);
  const charging = step(held, 29, [Button.Special, 0]).at(-1).snapshot.fighters[0];
  assert.equal(charging.position.x, 335);
  assert.equal(charging.move.charge.released, false);
  const charged = held.step([0, 0]);
  assert(charged.snapshot.fighters[0].position.x > release.snapshot.fighters[0].position.x + 3);
  const automatic = step(max, 57, [Button.Special, 0]).at(-1).snapshot.fighters[0];
  assert.equal(automatic.move.charge.released, true);
  assert(automatic.position.x > charged.snapshot.fighters[0].position.x);
});

test('Beach Throw produces the original six items with deterministic physics and replay', () => {
  const items = new Map();
  const inputs = Array.from({ length: 64 }, (_, frame) => [frame === 0 ? Button.Heavy : 0, 0]);
  for (let seed = 1; seed <= 350 && items.size < 6; seed++) {
    const { match, rules } = fight('chelan', { seed });
    const steps = inputs.map((input) => match.step(input));
    const projectile = steps[9].snapshot.projectiles[0];
    const shape = getProjectileDefinition(match.definition, projectile);
    if (items.has(shape.appearance)) continue;
    items.set(shape.appearance, shape.velocity.x);
    assert.deepEqual(playRecording(match.definition, rules, createRecording(match, inputs)), {
      snapshot: match.snapshot(), events: steps.flatMap(({ events }) => events),
    });
  }
  assert.deepEqual([...items.keys()].sort(), ['beach-ball', 'chair', 'fish', 'shovel', 'tourist', 'towel']);
  assert.equal(new Set(items.values()).size, 6);
});

test('Chelanmania Driver breaks through guard, then slams only on a confirmed grab', () => {
  const { match, rules } = fight('chelan', { positions: [{ x: 320, y: 442 }, { x: 401, y: 442 }] });
  match.step([Button.Special, Button.Guard]);
  const before = step(match, 10, [0, Button.Guard]);
  const grab = hitEvents(before)[0];
  assert.equal(grab.damage, 0);
  assert.equal(match.snapshot().fighters[1].health, 105);
  const restored = createMatch(match.definition, rules, JSON.parse(serializeSnapshot(match.snapshot())));
  const after = step(match, 23, [0, Button.Guard | Button.Jump]);
  assert.deepEqual(step(restored, 23, [0, Button.Guard | Button.Jump]), after);
  const slam = hitEvents(after)[0];
  assert.equal(slam.tick - grab.tick, 17);
  assert.equal(slam.damage, 28);
  assert.equal(hitEvents(after).length, 1);
  const miss = fight('chelan').match;
  miss.step([Button.Special, 0]);
  assert.equal(hitEvents(step(miss, 52)).length, 0);
});

test('Spike Crown catches a jump-in and Breakwater Boulder rolls off a platform', () => {
  const spikes = fight('rip-rap', { positions: [{ x: 335, y: 442 }, { x: 420, y: 442 }] }).match;
  spikes.step([Button.Heavy, Button.Jump]);
  const hit = step(spikes, 18).find(({ events }) => events.some(({ type }) => type === 'hit'));
  assert(hit);
  assert(hit.snapshot.fighters[1].position.y < 400);
  assert(hit.snapshot.fighters[1].velocity.y < 0);

  const { match } = fight('rip-rap', {
    stage: 'proposal-rock', rule: 'stock', positions: [{ x: 300, y: 323 }, { x: 750, y: 427 }],
  });
  const spawn = step(match, 11, [Button.Special, 0]).at(-1).snapshot.projectiles[0];
  assert.equal(spawn.ground, 'west-ledge');
  const roll = step(match, 42).map(({ snapshot }) => snapshot.projectiles[0]);
  assert(roll.some(({ ground }) => ground === null));
  assert.equal(roll.at(-1).ground, 'shore');
  assert(roll.at(-1).position.x > spawn.position.x);
});

test('Duck Flag summons LaMichael and a longer pass from Joey Harrington', () => {
  const runner = fight('duck-flag').match;
  const run = step(runner, 65, [Button.Light, 0]);
  const spawn = run.flatMap(({ snapshot }) => snapshot.projectiles).at(0);
  assert.equal(getProjectileDefinition(runner.definition, spawn).appearance, 'runner');
  assert.equal(hitEvents(run)[0].damage, 11);

  const pass = (held) => {
    const { match } = fight('duck-flag');
    assert.equal(step(match, held, [Button.Heavy, 0]).at(-1).snapshot.projectiles.length, 0);
    return step(match, 3).at(-1).snapshot.projectiles[0];
  };
  const quick = pass(1);
  const deep = pass(45);
  assert(deep.velocity.x > quick.velocity.x + 3);
  assert(deep.velocity.y < quick.velocity.y - 3);
});

test('Mascot Moto Loop circles, can hit repeatedly, expires, and respects the summon cooldown', () => {
  const { match, rules } = fight('duck-flag');
  const spawn = step(match, 18, [Button.Special, 0]).at(-1).snapshot.projectiles[0];
  const shape = getProjectileDefinition(match.definition, spawn);
  assert.equal(shape.appearance, 'mascot');
  assert.equal(spawn.orbitCenter.x, 625);
  const saved = JSON.parse(serializeSnapshot(match.snapshot()));
  const restored = createMatch(match.definition, rules, saved);
  const ride = step(match, 200);
  assert.deepEqual(ride, step(restored, 200));
  const hits = hitEvents(ride);
  assert(hits.length >= 2);
  for (let i = 1; i < hits.length; i++) assert(hits[i].tick - hits[i - 1].tick >= shape.rehitTicks);
  assert.equal(match.step([Button.Special, 0]).snapshot.fighters[0].move, null);
  step(match, shape.lifetime - 200);
  assert.equal(match.snapshot().projectiles.length, 0);
  assert.equal(match.step([Button.Special, 0]).snapshot.fighters[0].move.slot, 'special');
});
