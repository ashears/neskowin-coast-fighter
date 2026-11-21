import './style.css';
import { createMatch, SNAPSHOT_VERSION, TICK_RATE } from '@ashears/2d-fighter-framework';
import type { GameEvent, MatchDefinition, ReadonlyDeep, Seat, Snapshot } from '@ashears/2d-fighter-framework';
import { fighterIds, coastConfig, fighterInfo, roster, ruleIds, stageIds, stageInfo, supportsMatch } from './content';
import type { FighterId, RuleId, StageId } from './content';
import { ROOM_CODE } from '@ashears/fighter-relay/protocol';
import type { RoomView, ServerMessage } from '@ashears/fighter-relay/protocol';
import { Controls } from './input';
import { RoomConnection } from './online';
import { OfflineFight, OnlineFight, randomSeed, readReplay, storeReplay } from './session';
import type { LocalMode, Mode, SavedFight, Setup } from './session';
import { ArenaRenderer } from './stage';
import { putPortrait } from './art';
import { available, cleanupStatus, completeStop, equipPalette, shellBalance, stops, unlockedFighters } from './campaign';
import type { StopId } from './campaign';
import { loadProgress, writeProgress } from './progress';
import { palettes } from './cosmetics';
import type { PaletteId } from './cosmetics';

function byId<ElementType extends HTMLElement = HTMLElement>(id: string): ElementType {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element ${id}`);
  return element as ElementType;
}

const setupView = byId('setup-view');
const activeView = byId('active-view');
const roomView = byId('room-view');
const resultView = byId('result-view');
const resultHeading = byId('result-heading');
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-mode]')];
const rulesField = byId<HTMLSelectElement>('rules');
const stageField = byId<HTMLSelectElement>('stage');
const fighterOne = byId<HTMLSelectElement>('fighter-one');
const fighterTwo = byId<HTMLSelectElement>('fighter-two');
const startButton = byId<HTMLButtonElement>('start');
const replayButton = byId<HTMLButtonElement>('replay');
const readyButton = byId<HTMLButtonElement>('ready');
const againButton = byId<HTMLButtonElement>('again');
const roomFighter = byId<HTMLSelectElement>('room-fighter');
const sound = byId<HTMLInputElement>('sound');
const touch = byId('touch-controls');
const debugToggle = byId<HTMLButtonElement>('debug-toggle');
const frameData = byId('frame-data');
const hud = byId('hud');
const info = byId('arena-message');
const objective = byId('objective');

const progress = { current: loadProgress() };
let selectedStop: StopId = stops[progress.current.completed.length]?.id ?? stops[0].id;
let nextCampaignStop: StopId | undefined;

function populateFighters(select: HTMLSelectElement, ids: FighterId[], preferred: string, placeholder = false) {
  const options = ids.map((id) => new Option(roster[id].name, id));
  if (placeholder) options.unshift(new Option('Select a fighter', ''));
  select.replaceChildren(...options);
  select.value = ids.includes(preferred as FighterId) ? preferred : placeholder ? '' : ids[0];
}

populateFighters(fighterOne, [...fighterIds], 'proposal-rock');
populateFighters(fighterTwo, [...fighterIds], 'chelan');
populateFighters(roomFighter, [...fighterIds], '', true);
stageField.replaceChildren(...stageIds.map((id) => new Option(stageInfo[id].name, id)));

for (const id of fighterIds) {
  const item = document.createElement('article');
  item.className = 'fighter-note';
  const marker = document.createElement('div');
  marker.className = 'fighter-icon';
  marker.setAttribute('aria-hidden', 'true');
  putPortrait(marker, id);
  const copy = document.createElement('div');
  const title = document.createElement('h3');
  const role = document.createElement('span');
  title.textContent = roster[id].name;
  role.textContent = fighterInfo[id].role;
  role.className = 'fighter-role';
  const detail = document.createElement('p');
  detail.textContent = fighterInfo[id].description;
  copy.append(title, role, detail);
  item.append(marker, copy);
  byId('roster-list').append(item);
}

const renderer = new ArenaRenderer(byId('viewport'));
const connection = new RoomConnection(onServerMessage, onDisconnect);
const controls = new Controls(touch, () => {
  const neutral = online?.input(0);
  if (neutral) connection.send(neutral);
});

let mode: Mode = 'cpu';
let setup = readSetup();
let currentSnapshot: Snapshot;
let definition: ReadonlyDeep<MatchDefinition>;
let offline: OfflineFight | undefined;
let online: OnlineFight | undefined;
let room: RoomView | undefined;
let seat: Seat = 0;
let debug = false;
let lastReplay = readReplay();
let privateResult = false;
let audio: AudioContext | undefined;
let capturePointer = matchMedia('(any-pointer: coarse)').matches;
let clock = performance.now();
let accumulator = 0;

function readSetup(): Setup {
  if (mode === 'campaign') {
    const stop = stops.find(({ id }) => id === selectedStop)!;
    return {
      stage: stop.stage, rule: stop.rule, fighters: [fighterOne.value as FighterId, stop.opponent],
      stop: stop.id, seed: randomSeed(),
    };
  }
  return {
    stage: stageField.value as StageId, rule: rulesField.value as RuleId,
    fighters: [fighterOne.value as FighterId, fighterTwo.value as FighterId],
    seed: randomSeed(),
  };
}

function applyPalette() {
  renderer.setPalette(online ? seat : 0, palettes.find(({ id }) => id === progress.current.equipped)?.color);
}

function drawShop(focus?: string) {
  const balance = shellBalance(progress.current);
  byId('shell-balance').textContent = `${balance} shells`;
  const root = byId('shop-palette-list');
  const choices = [{ id: null, name: 'Original', price: 0, color: '#fbb783' }, ...palettes];
  root.replaceChildren(...choices.map(({ id, name, price, color }) => {
    const owned = id === null || progress.current.owned.includes(id);
    const selected = progress.current.equipped === id;
    const button = document.createElement('button');
    button.type = 'button';
    button.style.setProperty('--shop-color', color);
    button.dataset.palette = id ?? 'original';
    button.disabled = !owned && balance < price;
    button.setAttribute('aria-pressed', String(selected));
    button.textContent = `${name} · ${selected ? 'Equipped' : owned ? 'Equip' : `${price} shells`}`;
    button.addEventListener('click', () => choosePalette(id));
    return button;
  }));
  if (focus) root.querySelector<HTMLButtonElement>(`[data-palette="${focus}"]`)?.focus();
}

function choosePalette(id: PaletteId | null) {
  const next = equipPalette(progress.current, id);
  if (next === progress.current) return;
  progress.current = next;
  const saved = writeProgress(next);
  const status = byId('shop-status');
  status.hidden = saved;
  status.textContent = saved ? '' : 'Your palette is available until you close this page.';
  applyPalette();
  drawShop(id ?? 'original');
}

function showView(view: 'setup' | 'active' | 'room' | 'result') {
  setupView.hidden = view !== 'setup';
  activeView.hidden = view !== 'active';
  roomView.hidden = view !== 'room';
  resultView.hidden = view !== 'result';
}

function setStatus(status: string) {
  byId('status').textContent = status;
}

function updateMode() {
  for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  byId('fighter-fields').hidden = mode === 'online';
  byId('opponent-field').hidden = mode === 'campaign';
  byId('arena-fields').hidden = mode === 'campaign';
  byId('campaign-route').hidden = mode !== 'campaign';
  populateFighters(fighterOne, mode === 'campaign' ? unlockedFighters(progress.current) : [...fighterIds], fighterOne.value);
  if (mode === 'campaign') drawRoute();
  const roomsAvailable = location.protocol !== 'https:' || Boolean(import.meta.env.VITE_ROOM_URL);
  byId('join-form').hidden = mode !== 'online' || !roomsAvailable;
  startButton.hidden = mode === 'online' && !roomsAvailable;
  byId('opponent-label').textContent = mode === 'local' ? 'Player two' : mode === 'training' ? 'Training dummy' : 'CPU fighter';
  startButton.replaceChildren(document.createTextNode(
    mode === 'online' ? 'Create private room' : mode === 'training' ? 'Start training' : mode === 'campaign' ? 'Play stop' : 'Start fight',
  ));
  const hints: Record<Mode, string> = {
    cpu: '',
    local: 'Two fighters, one keyboard.',
    training: 'Practice against a stationary dummy and inspect move frames.',
    campaign: stops.find(({ id }) => id === selectedStop)!.objective,
    online: roomsAvailable ? 'Share a room code to play with a friend.' : 'Online rooms are unavailable on this site.',
  };
  byId('setup-hint').textContent = hints[mode];
  replayButton.disabled = !lastReplay;
}

function drawRoute(focus = false) {
  const route = byId('route-stops');
  route.replaceChildren(...stops.map((stop, index) => {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = !available(progress.current, stop.id);
    button.dataset.stop = stop.id;
    const label = document.createElement('span');
    label.textContent = stop.title;
    const status = document.createElement('span');
    status.className = 'stop-state';
    status.textContent = progress.current.completed.includes(stop.id) ? 'Cleared' : button.disabled ? 'Locked' : String(index + 1).padStart(2, '0');
    button.append(label, status);
    button.setAttribute('aria-pressed', String(stop.id === selectedStop));
    button.addEventListener('click', () => {
      selectedStop = stop.id;
      drawRoute(true);
      byId('setup-hint').textContent = stop.objective;
      drawPreview();
    });
    row.append(button);
    return row;
  }));
  if (focus) route.querySelector<HTMLElement>(`[data-stop="${selectedStop}"]`)?.focus();
}

function drawPreview() {
  setup = readSetup();
  putPortrait(byId('portrait-one'), setup.fighters[0]);
  putPortrait(byId('portrait-two'), setup.fighters[1]);
  const config = coastConfig(setup.fighters, setup.stage, setup.rule, setup.seed);
  const preview = createMatch(config.definition, config.rules);
  definition = preview.definition;
  currentSnapshot = preview.snapshot();
  renderer.stage(setup.stage, true);
  applyPalette();
  byId('stage-name').textContent = stageInfo[setup.stage].name;
  byId('session-label').textContent = 'Preview';
  hud.hidden = true;
  info.hidden = true;
}

function clearFight() {
  offline = undefined;
  online = undefined;
  controls.active = false;
  controls.local = false;
  controls.release();
  debug = false;
  info.hidden = true;
  objective.hidden = true;
  frameData.hidden = true;
  touch.hidden = true;
  byId('match-tools').hidden = true;
  debugToggle.hidden = true;
  debugToggle.setAttribute('aria-pressed', 'false');
  debugToggle.textContent = 'Show hitboxes';
}

function backToSetup(exitRoom = false) {
  if (exitRoom) {
    connection.send({ type: 'leave' });
    connection.close();
    room = undefined;
  }
  clearFight();
  privateResult = false;
  showView('setup');
  updateMode();
  drawPreview();
}

function startLocal(selection: Setup, localMode: LocalMode | 'replay', saved?: SavedFight) {
  clearFight();
  if (room) {
    connection.send({ type: 'leave' });
    room = undefined;
  }
  connection.close();
  setStatus('');
  offline = new OfflineFight(selection, localMode, saved?.recording);
  startFight(selection, offline.match.definition, offline.match.snapshot(), localMode);
}

function startFight(
  selection: Setup, matchDefinition: ReadonlyDeep<MatchDefinition>, snapshot: Snapshot,
  matchMode: LocalMode | 'replay' | 'online',
) {
  setup = selection;
  definition = matchDefinition;
  currentSnapshot = snapshot;
  accumulator = 0;
  clock = performance.now();
  controls.active = matchMode !== 'replay';
  controls.local = matchMode === 'local';
  const labels = { cpu: 'CPU fight', local: 'Local versus', training: 'Training', campaign: 'Campaign', replay: 'Replay', online: `Online · P${seat + 1}` };
  byId('stage-name').textContent = stageInfo[selection.stage].name;
  byId('session-label').textContent = labels[matchMode];
  byId('match-tools').hidden = false;
  touch.hidden = !capturePointer || !controls.active || controls.local;
  objective.hidden = matchMode !== 'campaign';
  debugToggle.hidden = matchMode !== 'training';
  frameData.hidden = matchMode !== 'training';
  renderer.stage(selection.stage, true);
  applyPalette();
  buildHud();
  hud.hidden = false;
  if (matchMode === 'online') {
    showView('room');
    updateRoom();
    setStatus('Fight in progress.');
  } else {
    showView('active');
    byId('active-heading').textContent = labels[matchMode];
    byId('active-matchup').textContent = selection.stop
      ? stops.find(({ id }) => id === selection.stop)!.objective
      : `${definition.fighters[0].name} vs. ${definition.fighters[1].name}`;
    const names = ['Light · F', 'Heavy · G', 'Special · H'];
    byId('move-guide').replaceChildren(...(['light', 'heavy', 'special'] as const).flatMap((slot, index) => {
      const binding = document.createElement('dt');
      const name = document.createElement('dd');
      binding.textContent = names[index];
      name.textContent = definition.fighters[0].moves[slot].name;
      return [binding, name];
    }));
    byId('move-guide').hidden = matchMode === 'replay';
    setStatus(matchMode === 'replay' ? 'Replaying the recorded inputs.' : 'Fight in progress.');
  }
  byId('stop').focus({ preventScroll: true });
  if (capturePointer) byId('arena').scrollIntoView({ block: 'start' });
}

function stopFight() {
  backToSetup(!!room);
  setStatus('');
  startButton.focus({ preventScroll: true });
}

function finish(snapshot: Snapshot) {
  if (offline?.mode === 'training') {
    const showBoxes = debug;
    startLocal({ ...setup, seed: randomSeed() }, 'training');
    setDebug(showBoxes);
    return;
  }
  const viewingReplay = offline?.mode === 'replay';
  if (offline && !viewingReplay && offline.mode !== 'campaign') save({ setup, recording: offline.recording() });
  privateResult = !!online;
  controls.active = false;
  controls.release();
  touch.hidden = true;
  byId('match-tools').hidden = true;
  const winner = snapshot.winner;
  const mirrorMatch = definition.fighters[0].id === definition.fighters[1].id;
  resultHeading.textContent = winner === 'draw' || winner === null
    ? 'Draw' : `${definition.fighters[winner].name}${mirrorMatch ? ` (P${winner + 1})` : ''} wins`;
  byId('result-detail').textContent = setup.rule === 'health'
    ? `Rounds ${snapshot.roundWins[0]}–${snapshot.roundWins[1]} at ${stageInfo[setup.stage].name}.`
    : `Stocks remaining ${snapshot.fighters[0].stocks}–${snapshot.fighters[1].stocks}.`;
  againButton.textContent = viewingReplay ? 'Replay again' : 'Rematch';
  againButton.disabled = false;
  let progressNote = '';
  if (setup.stop) {
    const previous = progress.current;
    progress.current = completeStop(previous, setup.stop, winner === 0);
    const visited = stops.findIndex(({ id }) => id === setup.stop);
    const unlocked = stops[visited];
    nextCampaignStop = winner === 0 ? stops[visited + 1]?.id : undefined;
    resultHeading.textContent = winner === 0 ? 'Stop cleared' : winner === 'draw' ? 'Draw' : 'Try this stop again';
    byId('result-detail').textContent = winner === 0
      ? `${unlocked.title} cleared.${'unlock' in unlocked && previous !== progress.current ? ` ${roster[unlocked.unlock].name} joined your campaign roster.` : ''}`
      : unlocked.objective;
    againButton.textContent = nextCampaignStop ? 'Next stop' : winner === 0 ? 'Replay stop' : 'Retry stop';
    byId('result-back').textContent = 'Back to campaign';
    if (previous !== progress.current) {
      const payout = shellBalance(progress.current) - shellBalance(previous);
      progressNote = writeProgress(progress.current) ? `Earned ${payout} shells.` : 'Progress is available until you close this page.';
      drawShop();
    }
  } else {
    byId('result-back').textContent = privateResult ? 'Leave room' : 'Back to setup';
  }
  byId('session-label').textContent = viewingReplay ? 'Replay complete' : 'Match complete';
  showView('result');
  info.hidden = true;
  objective.hidden = true;
  setStatus(progressNote);
  resultHeading.focus({ preventScroll: !matchMedia('(max-width: 780px)').matches });
}

function save(fight: SavedFight) {
  lastReplay = fight;
  storeReplay(fight);
}

function validRoom(candidate: RoomView): candidate is RoomView & { stage: StageId; rule: RuleId } {
  return stageIds.includes(candidate.stage as StageId) && ruleIds.includes(candidate.rule as RuleId);
}

function updateRoom() {
  if (!room) return;
  byId('code-display').textContent = room.code;
  byId('room-description').textContent = room.status === 'playing'
    ? `${stageInfo[room.stage as StageId].name} · You are player ${seat + 1}.`
    : `Share the code to invite a friend. You are player ${seat + 1}.`;
  const players = byId('room-players');
  players.replaceChildren(...room.players.map((player, index) => {
    const item = document.createElement('li');
    const suffix = index === seat ? ' (you)' : '';
    const name = player?.fighter && roster[player.fighter as FighterId]?.name;
    item.textContent = player ? `Player ${index + 1}${suffix} · ${name || 'Picking'}${player.ready ? ' · Ready' : ''}` : 'Waiting for a guest';
    return item;
  }));
  const own = room.players[seat];
  roomFighter.value = own?.fighter ?? '';
  roomFighter.disabled = room.status !== 'waiting';
  readyButton.disabled = room.status !== 'waiting' || !own?.fighter;
  readyButton.textContent = own?.ready ? 'Cancel ready' : 'Ready';
}

function onDisconnect(detail: string) {
  room = undefined;
  backToSetup();
  setStatus(detail);
}

function onServerMessage(message: ServerMessage) {
  switch (message.type) {
    case 'room': {
      if (!validRoom(message.room)) return;
      const firstView = !room;
      room = message.room;
      seat = message.seat;
      if (room.status === 'waiting') {
        showView('room');
        updateRoom();
        setStatus('');
        if (firstView) roomFighter.focus({ preventScroll: true });
      } else if (room.status === 'finished' && room.players[seat]?.rematch) {
        againButton.disabled = true;
        setStatus('Waiting for the other player to rematch.');
      }
      break;
    }
    case 'start': {
      if (!validRoom(message.room)) return;
      const fighters = message.room.players.map((player) => player?.fighter) as [FighterId, FighterId];
      if (!fighters.every((fighter) => fighterIds.includes(fighter))) return;
      clearFight();
      room = message.room;
      const selection: Setup = { fighters, stage: message.room.stage, rule: message.room.rule, seed: message.seed };
      const config = coastConfig(fighters, selection.stage, selection.rule, selection.seed);
      if (message.snapshot.version !== SNAPSHOT_VERSION
        || createMatch(config.definition, config.rules).snapshot().configuration !== message.snapshot.configuration) {
        connection.close();
        onDisconnect('The room server and this demo use different fighter data.');
        return;
      }
      online = new OnlineFight(selection, message.match, message.snapshot);
      startFight(selection, config.definition, message.snapshot, 'online');
      break;
    }
    case 'snapshot':
      if (online?.number !== message.match) return;
      online.receive(message.snapshot, message.events, performance.now());
      if (message.snapshot.phase === 'finished' && message.recording) save({ setup, recording: message.recording });
      break;
    case 'ended':
      connection.close();
      onDisconnect(message.reason === 'opponent-left' ? 'Your opponent left the room.'
        : message.reason === 'expired' ? 'The private room expired.'
        : message.reason === 'server-error' ? 'The server could not continue this room.'
        : 'You left the room.');
      break;
    case 'error':
      setStatus(message.message);
      break;
  }
}

function buildHud() {
  hud.innerHTML = `<div class="hud-side"><div class="hud-line"><span class="hud-badge"></span><span class="hud-value"></span></div>
    <div class="bar"><span class="fill"></span></div><div class="guard-bar"><span class="fill"></span></div></div>
    <div class="clock"></div>
    <div class="hud-side"><div class="hud-line"><span class="hud-badge"></span><span class="hud-value"></span></div>
    <div class="bar"><span class="fill"></span></div><div class="guard-bar"><span class="fill"></span></div></div>`;
  for (const [index, label] of [...hud.querySelectorAll('.hud-badge')].entries()) label.textContent = definition.fighters[index].name;
  updateHud(currentSnapshot);
}

function updateHud(snapshot: Snapshot) {
  const stock = setup.rule === 'stock';
  const seconds = Math.max(0, Math.ceil((definition.timeLimit - snapshot.roundTick) / TICK_RATE));
  hud.querySelector('.clock')!.textContent = offline?.mode === 'training'
    ? '∞' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  for (const [index, side] of [...hud.querySelectorAll('.hud-side')].entries()) {
    const actor = snapshot.fighters[index];
    const fighter = definition.fighters[index];
    const text = stock ? `${Math.round(actor.damage)}% · ${actor.stocks} ◆` : `${Math.ceil(actor.health)} HP · ${snapshot.roundWins[index]}`;
    side.querySelector('.hud-value')!.textContent = text;
    const [bar, guard] = side.querySelectorAll<HTMLElement>('.fill');
    bar.style.width = `${stock ? actor.stocks / 3 * 100 : actor.health / fighter.maxHealth * 100}%`;
    guard.style.width = `${fighter.maxGuard ? actor.guard / fighter.maxGuard * 100 : 0}%`;
  }
  if (setup.stop === 'proposal-rock-cleanup') {
    const { collected, total, mistakes, item } = cleanupStatus(snapshot);
    objective.textContent = item ? `${collected}/${total} collected · ${3 - mistakes} tries · ${item.debris} · ${item.label}` : `${total}/${total} collected`;
    const sides = hud.querySelectorAll<HTMLElement>('.hud-side');
    sides[0].querySelector('.hud-value')!.textContent = `${collected}/${total} collected`;
    sides[1].querySelector('.hud-badge')!.textContent = 'Mistakes';
    sides[1].querySelector('.hud-value')!.textContent = `${mistakes}/3`;
    const meters = hud.querySelectorAll<HTMLElement>('.bar .fill');
    meters[0].style.width = `${collected / total * 100}%`;
    meters[1].style.width = `${mistakes / 3 * 100}%`;
    for (const meter of hud.querySelectorAll<HTMLElement>('.guard-bar')) meter.hidden = true;
  } else if (setup.stop) {
    objective.textContent = setup.stop === 'ocean-boss' && snapshot.fighters[1].move
      ? definition.fighters[1].moves[snapshot.fighters[1].move.slot].name
      : setup.stop === 'ocean-boss' ? 'Survive the tide' : stops.find(({ id }) => id === setup.stop)!.title;
  }
  if (!frameData.hidden) {
    frameData.textContent = snapshot.fighters.map((actor, index) => {
      const fighter = definition.fighters[index];
      if (!actor.move) return `${fighter.name} · ${actor.stun ? `stun ${actor.stun}f` : 'neutral'}`;
      const move = fighter.moves[actor.move.slot];
      const frame = actor.move.frame;
      const phase = frame < move.startup ? 'startup' : frame < move.startup + move.active ? 'active' : 'recovery';
      return `${fighter.name} · ${move.name}, ${phase} ${frame + 1}/${move.startup + move.active + move.recovery}f`;
    }).join('   /   ');
  }
}

function react(snapshot: Snapshot, events: readonly GameEvent[], now: number) {
  renderer.effects(snapshot, events, now);
  for (const event of events) {
    if (event.type === 'round-end' && snapshot.phase !== 'finished') {
      info.textContent = event.winner === 'draw' ? 'Round drawn' : `${definition.fighters[event.winner].name} takes the round`;
      info.hidden = false;
    } else if (event.type === 'round-start') info.hidden = true;
    if (!sound.checked || !audio || !['attack', 'hit', 'stock-lost', 'block'].includes(event.type)) continue;
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    const at = audio.currentTime;
    oscillator.type = event.type === 'attack' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(event.type === 'hit' ? 180 : event.type === 'stock-lost' ? 98 : 330, at);
    oscillator.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    volume.gain.setValueAtTime(0.12, at);
    volume.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.13);
  }
}

function render(now: number) {
  const stepTime = 1000 / TICK_RATE;
  accumulator = Math.min(accumulator + now - clock, stepTime * 5);
  clock = now;
  while (accumulator >= stepTime) {
    accumulator -= stepTime;
    if (offline && currentSnapshot.phase !== 'finished') {
      const outcome = offline.tick(controls);
      if (!outcome) {
        backToSetup();
        setStatus('The recording ended before a match result.');
        break;
      }
      currentSnapshot = outcome.snapshot;
      react(currentSnapshot, outcome.events, now);
      updateHud(currentSnapshot);
      if (currentSnapshot.phase === 'finished') finish(currentSnapshot);
    } else if (online && controls.active) {
      const input = online.input(controls.next(0));
      if (input) connection.send(input);
    }
  }
  if (online && currentSnapshot.phase !== 'finished') {
    const display = online.sample(now);
    currentSnapshot = display.snapshot;
    react(currentSnapshot, display.events, now);
    updateHud(currentSnapshot);
    renderer.draw(definition, currentSnapshot, now, false, display.positions);
    if (currentSnapshot.phase === 'finished') finish(currentSnapshot);
  } else {
    renderer.draw(definition, currentSnapshot, now, debug, undefined, setup.stop === 'proposal-rock-cleanup' && !!offline);
  }
  requestAnimationFrame(render);
}

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    mode = button.dataset.mode as Mode;
    if (mode !== 'online' && !room) connection.close();
    setStatus('');
    updateMode();
    drawPreview();
  });
}

for (const select of [fighterOne, fighterTwo]) select.addEventListener('change', drawPreview);
rulesField.addEventListener('change', () => {
  if (!supportsMatch(stageField.value, rulesField.value)) stageField.value = 'proposal-rock';
  drawPreview();
});
stageField.addEventListener('change', () => {
  if (!supportsMatch(stageField.value, rulesField.value)) rulesField.value = 'health';
  drawPreview();
});

byId('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const selection = readSetup();
  if (mode === 'online') {
    setStatus('Connecting to the private room server…');
    connection.connect({ type: 'create', stage: selection.stage, rule: selection.rule });
  } else startLocal(selection, mode);
});
byId('join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = byId<HTMLInputElement>('room-code').value.trim().toUpperCase();
  if (!ROOM_CODE.test(code)) {
    setStatus('Enter the eight-character room code.');
    return;
  }
  setStatus('Joining the private room…');
  connection.connect({ type: 'join', code });
});
roomFighter.addEventListener('change', () => {
  if (roomFighter.value) connection.send({ type: 'select', fighter: roomFighter.value });
});
readyButton.addEventListener('click', () => connection.send({ type: 'ready', ready: !room?.players[seat]?.ready }));
for (const button of document.querySelectorAll('[data-leave-room]')) button.addEventListener('click', stopFight);
byId('copy-code').addEventListener('click', async () => {
  if (!room) return;
  try {
    await navigator.clipboard.writeText(room.code);
    setStatus('Room code copied.');
  } catch {
    setStatus(`Share this code with your friend: ${room.code}.`);
  }
});
byId('stop').addEventListener('click', stopFight);
byId('result-back').addEventListener('click', stopFight);
replayButton.addEventListener('click', () => { if (lastReplay) startLocal(lastReplay.setup, 'replay', lastReplay); });
againButton.addEventListener('click', () => {
  if (privateResult && online) {
    connection.send({ type: 'rematch', match: online.number });
    againButton.disabled = true;
    setStatus('Waiting for the other player to rematch.');
  } else if (offline?.mode === 'campaign') {
    selectedStop = nextCampaignStop ?? setup.stop!;
    const next = readSetup();
    next.fighters[0] = setup.fighters[0];
    startLocal(next, 'campaign');
  } else if (offline?.mode === 'replay' && lastReplay) {
    startLocal(lastReplay.setup, 'replay', lastReplay);
  } else if (offline && offline.mode !== 'replay') {
    startLocal({ ...setup, seed: randomSeed() }, offline.mode);
  }
});
function setDebug(visible: boolean) {
  debug = visible;
  debugToggle.setAttribute('aria-pressed', String(debug));
  debugToggle.textContent = debug ? 'Hide hitboxes' : 'Show hitboxes';
}

debugToggle.addEventListener('click', () => setDebug(!debug));
sound.addEventListener('change', () => {
  if (!sound.checked) return;
  audio ??= new AudioContext();
  void audio.resume();
});
matchMedia('(any-pointer: coarse)').addEventListener('change', (event) => {
  capturePointer = event.matches;
  touch.hidden = !capturePointer || !controls.active || controls.local;
});
window.addEventListener('pagehide', () => connection.close());

updateMode();
drawPreview();
drawShop();
requestAnimationFrame(render);
