import { Button as B } from '@ashears/2d-fighter-framework';
import { bouts, campaign } from '../dist-server/campaign.js';

// Generate reproducible keyboard inputs for a player who approaches, attacks, and recovers offstage.
export function playBout(bout, player, seed = 17, idle = false) {
  const cleared = bouts.slice(0, bouts.indexOf(bout)).map(({ id }) => id);
  const { match, opponent } = campaign.startBout(cleared, bout.id, player, seed);
  const stage = match.definition.stage;
  const floor = stage.blastZone && stage.surfaces[0];
  const frames = [];
  const wins = [];
  const attacks = new Set();
  let firstWaveWarning = 0;
  let playerHits = 0;

  for (let tick = 0; tick < match.definition.timeLimit * 3 + 200; tick++) {
    const state = match.snapshot();
    if (state.phase === 'finished') return { state, frames, wins, attacks, firstWaveWarning, playerHits };
    const [me, rival] = state.fighters;
    const dx = rival.position.x - me.position.x;
    const dy = rival.position.y - me.position.y;
    const distance = Math.abs(dx);
    const toward = dx > 0 ? B.Right : B.Left;
    const ready = (slot, button) => (me.cooldowns?.[slot] ?? 0) <= state.tick && !(me.previousInput & button);
    const jump = me.jumpsLeft && !(me.previousInput & B.Jump) ? B.Jump : 0;
    const edge = floor && (me.position.x < floor.x + 35 || me.position.x > floor.x + floor.width - 35);
    const incoming = state.projectiles.some((shot) => shot.owner === 1
      && Math.abs(shot.position.x - me.position.x) < 135
      && Math.abs(shot.position.y - me.position.y) < 70
      && (me.position.x - shot.position.x) * shot.velocity.x > 0);
    let desired = 0;
    if (edge) {
      desired = (me.position.x < 480 ? B.Right : B.Left) | (me.velocity.y > 1 ? jump : 0);
    } else if (me.move) {
      if (me.move.charge?.released === false && me.move.charge.held < (player === 'proposal-rock' ? 10 : 18)) {
        desired = me.move.slot === 'heavy' ? B.Heavy : B.Special;
      }
    } else if (incoming && me.surface && jump) {
      desired = toward | jump;
    } else if (me.facing !== Math.sign(dx) && distance > 2) {
      desired = toward;
    } else if (player === 'proposal-rock') {
      if (distance < 100 && Math.abs(dy) < 50 && ready('special', B.Special)) desired = B.Special;
      else if (distance < 155 && dy > -38 && dy < 105 && ready('heavy', B.Heavy)
        && (!floor || (me.position.x > floor.x + 155 && me.position.x < floor.x + floor.width - 155))) desired = B.Heavy;
      else if (distance > 48 || (distance < 60 && Math.abs(dy) < 40 && rival.move && ready('light', B.Light))) desired = toward;
    } else {
      if (distance < 320 && ready('special', B.Special)) desired = B.Special;
      else if (distance > 64 && distance < 460 && Math.abs(dy) < 70 && ready('heavy', B.Heavy)) desired = B.Heavy;
      else if (distance < 420 && Math.abs(dy) < 42 && ready('light', B.Light)) desired = B.Light;
      else if (distance > 100 && (!floor || rival.surface)) desired = toward;
    }
    if (floor && dy < -36 && distance < 205 && me.surface && !me.move) desired = toward | jump;
    if (floor && dy > 65 && me.surface && me.surface !== floor.id && distance < 160 && !me.move) {
      desired = toward | B.Down | jump;
    }
    if (floor && !me.surface && me.velocity.y > 4 && me.position.y > floor.y && Math.abs(me.position.x - 480) > 200) {
      desired = (me.position.x < 480 ? B.Right : B.Left) | jump;
    }

    // One keyboard transition per tick, as each key event is queued separately in the app.
    const held = frames.at(-1) ?? 0;
    const changed = held ^ (idle ? 0 : desired);
    const frame = held ^ (changed & -changed);
    frames.push(frame);
    const { snapshot, events } = match.step([frame, opponent(state)]);
    for (const event of events) {
      if (event.type === 'hit' && event.attacker === 0) playerHits++;
      if (event.type === 'attack' && event.seat === 1) {
        attacks.add(event.slot);
        if (bout.opponent === 'ocean' && event.slot === 'special' && !firstWaveWarning) firstWaveWarning = frames.length;
      }
      if (event.type === 'round-end' && event.winner === 0) {
        wins.push({ health: snapshot.fighters[1].health, stocks: snapshot.fighters[1].stocks, ticks: snapshot.roundTick });
      }
    }
  }
  throw new Error(`Bout did not finish: ${bout.id}`);
}
