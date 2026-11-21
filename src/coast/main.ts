import '@ashears/2d-fighter-framework/arena-select.css';
import { createArenaSelect } from '@ashears/2d-fighter-framework/arena-select';
import '@ashears/2d-fighter-framework/fighter-select.css';
import './style.css';
import { createFighterSelect } from '@ashears/2d-fighter-framework/fighter-select';
import type { FighterSelectSeat } from '@ashears/2d-fighter-framework/fighter-select';
import { createMatch, SNAPSHOT_VERSION, TICK_RATE } from '@ashears/2d-fighter-framework';
import type { GameEvent, MatchDefinition, MoveSlot, ReadonlyDeep, Seat, Snapshot } from '@ashears/2d-fighter-framework';
import { arenas, fighterIds, coastConfig, fighterInfo, moveNotes, roster, ruleIds, stageIds, stageInfo, supportsMatch } from './content';
import type { FighterId, RuleId, StageId } from './content';
import { copyInviteLink, createInviteLink, DirectRoomConnection, readInviteLink, supportsDirectRooms } from '@ashears/fighter-direct';
import type { RoomView, ServerMessage } from '@ashears/fighter-relay/protocol';
import { Controls } from './input';
import { OfflineFight, OnlineFight, randomSeed, readReplay, storeReplay } from './session';
import type { LocalMode, Mode, SavedFight, Setup } from './session';
import { ArenaRenderer, arenaBackgrounds } from './stage';
import { putPortrait } from './art';
import { bouts, campaign, equipPalette, recordBout, shellBalance, unlockedFighters } from './campaign';
import type { BoutId } from './campaign';
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
const pairingView = byId('pairing-view');
const pairingCode = byId<HTMLTextAreaElement>('pairing-code');
const replyInput = byId<HTMLTextAreaElement>('reply-input');
const acceptReply = byId<HTMLButtonElement>('accept-reply');
let pairingAttempt = 0;
const resultView = byId('result-view');
const resultHeading = byId('result-heading');
const modeScreen = byId('mode-screen');
const multiplayerScreen = byId('multiplayer-screen');
const openMultiplayer = byId('open-multiplayer');
const gameBack = byId('back-to-modes');
const gameScreen = byId('game-screen');
const gamePanel = byId('game-panel');
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('.mode-menu button[data-mode]')];
const roomsAvailable = supportsDirectRooms();
const rulesField = byId<HTMLSelectElement>('rules');
const arenaPicker = createArenaSelect(byId('stage'), stageIds.map((id) => ({
  id, ...stageInfo[id], surfaces: arenas[id].surfaces,
  image: arenaBackgrounds[id],
})), stageIds[0], { width: 960, height: 540 }, (stage) => {
  if (!supportsMatch(stage, rulesField.value)) rulesField.value = 'health';
});
const startButton = byId<HTMLButtonElement>('start');
const replayButton = byId<HTMLButtonElement>('replay');
const readyButton = byId<HTMLButtonElement>('ready');
const againButton = byId<HTMLButtonElement>('again');
const sound = byId<HTMLInputElement>('sound');
const touch = byId('touch-controls');
const hud = byId('hud');
const info = byId('arena-message');
const objective = byId('objective');

const progress = { current: loadProgress() };
let selectedBout: BoutId = bouts[0].id;
let nextCampaignBout: BoutId | undefined;
let campaignFighter: FighterId = 'proposal-rock';

function boutDetails(id: BoutId) {
  return bouts.find((bout) => bout.id === id)!;
}

const versusFighters: [FighterId, FighterId] = ['proposal-rock', 'chelan'];
const fighters = fighterIds.map((id) => ({ id, name: roster[id].name, detail: fighterInfo[id].role }));

function renderPortrait(element: HTMLElement, id: FighterId) {
  element.style.setProperty('--fighter-accent', fighterInfo[id].color);
  putPortrait(element, id);
}

const setupPicker = createFighterSelect(byId('fighter-fields'), {
  fighters, renderPortrait,
  onPick(player, fighter) {
    if (mode === 'campaign') campaignFighter = fighter;
    else versusFighters[player === 'p1' ? 0 : 1] = fighter;
    updateSetupPicker();
  },
});
const roomPicker = createFighterSelect(byId('room-fighter'), {
  fighters, renderPortrait,
  onPick(_player, fighter) {
    connection.send({ type: 'select', fighter });
  },
});

function buildRoster() {
  const list = byId('roster-list');
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
    list.append(item);
  }
}

let renderer: ArenaRenderer | undefined;
let renderFrame = 0;
const connection = new DirectRoomConnection({
  id: 'neskowin-abilities', fighters: fighterIds, stages: stageIds, rules: ruleIds,
  config: coastConfig, supports: supportsMatch,
}, onServerMessage, onDisconnect);
const controls = new Controls(touch, () => {
  const neutral = online?.input(0);
  if (neutral) connection.send(neutral);
});

let mode: Mode;
let setup: Setup;
let currentSnapshot: Snapshot;
let definition: ReadonlyDeep<MatchDefinition>;
let offline: OfflineFight | undefined;
let online: OnlineFight | undefined;
let room: RoomView | undefined;
let seat: Seat = 0;
let lastReplay = readReplay();
let privateResult = false;
let audio: AudioContext | undefined;
let capturePointer = matchMedia('(any-pointer: coarse)').matches;
let clock = performance.now();
let accumulator = 0;

function readSetup(): Setup {
  if (mode === 'campaign') {
    const bout = boutDetails(selectedBout);
    return {
      stage: bout.stage, rule: bout.rule, fighters: [campaignFighter, bout.opponent],
      bout: bout.id, seed: randomSeed(),
    };
  }
  return {
    stage: arenaPicker.value, rule: rulesField.value as RuleId,
    fighters: [...versusFighters],
    seed: randomSeed(),
  };
}

function applyPalette() {
  renderer?.setPalette(online ? seat : 0, palettes.find(({ id }) => id === progress.current.equipped)?.color);
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

function showView(view: 'setup' | 'active' | 'pairing' | 'room' | 'result') {
  setupView.hidden = view !== 'setup';
  activeView.hidden = view !== 'active';
  roomView.hidden = view !== 'room';
  pairingView.hidden = view !== 'pairing';
  resultView.hidden = view !== 'result';
}

function setStatus(status: string) {
  byId('status').textContent = status;
}

let choosingArena = false;
const chooseArena = byId('choose-arena');
const backToFighters = byId('back-to-fighters');
const setupHeading = byId('setup-heading');

function updateSetupScreen() {
  const arena = choosingArena || mode === 'online';
  const fighters = !arena && mode !== 'campaign';
  setupView.dataset.selection = arena ? 'arena' : fighters ? 'fighters' : 'campaign';
  setupHeading.textContent = arena ? 'Choose arena' : mode === 'campaign' ? 'Neskowin Coast Championship' : 'Choose fighters';
  byId('fighter-fields').hidden = arena;
  byId('arena-fields').hidden = !arena;
  chooseArena.hidden = !fighters;
  backToFighters.hidden = !arena || mode === 'online';
  startButton.hidden = fighters || (mode === 'online' && !roomsAvailable);
}

function changeSetupScreen(arena: boolean) {
  choosingArena = arena;
  updateSetupScreen();
  window.scrollTo(0, 0);
  if (arena) setupHeading.focus({ preventScroll: true });
  else chooseArena.focus({ preventScroll: true });
}

chooseArena.addEventListener('click', () => changeSetupScreen(true));
backToFighters.addEventListener('click', () => changeSetupScreen(false));

function updateMode() {
  updateSetupScreen();
  byId('campaign-intro').hidden = mode !== 'campaign';
  byId('campaign-route').hidden = mode !== 'campaign';
  updateSetupPicker();
  if (mode === 'campaign') drawRoute();
  byId('join-form').hidden = mode !== 'online' || !roomsAvailable;
  startButton.replaceChildren(document.createTextNode(
    mode === 'online' ? 'Copy invite link' : mode === 'campaign' ? 'Start bout' : 'Start fight',
  ));
  const hints: Record<Mode, string> = {
    cpu: '',
    local: 'Two fighters, one keyboard.',
    campaign: '',
    online: roomsAvailable ? 'Send an invite to a friend to play a private match.' : 'This browser does not support online rooms.',
  };
  byId('setup-hint').textContent = hints[mode];
  replayButton.disabled = !lastReplay;
  replayButton.hidden = mode === 'campaign';
}

function drawRoute(focus = false) {
  const selected = boutDetails(selectedBout);
  const completed = progress.current.completed;
  byId('bracket-progress').textContent = completed.length === bouts.length
    ? 'Tournament Champion' : `${completed.length} of ${bouts.length} bouts cleared`;
  byId('rival-heading').textContent = roster[selected.opponent].name;
  byId('bout-format').textContent = `${stageInfo[selected.stage].name} · ${selected.format}`;
  byId('bout-tip').textContent = selected.tip;
  putPortrait(byId('rival-portrait'), selected.opponent);
  const route = byId('route-bouts');
  route.replaceChildren(...bouts.map((bout) => {
    const row = document.createElement('li');
    const button = document.createElement('button');
    const state = campaign.status(completed, bout.id);
    button.type = 'button';
    button.disabled = state === 'locked';
    button.dataset.bout = bout.id;
    button.dataset.state = state;
    const label = document.createElement('span');
    label.textContent = bout.title;
    const status = document.createElement('span');
    status.className = 'bout-state';
    status.textContent = state === 'cleared' ? 'Cleared' : state === 'locked' ? 'Locked' : 'Ready';
    button.append(label, status);
    button.setAttribute('aria-pressed', String(bout.id === selectedBout));
    button.addEventListener('click', () => {
      selectedBout = bout.id;
      drawRoute(true);
    });
    row.append(button);
    return row;
  }));
  if (focus) route.querySelector<HTMLElement>(`[data-bout="${selectedBout}"]`)?.focus();
}

function updateSetupPicker() {
  const campaignMode = mode === 'campaign';
  const seats: FighterSelectSeat<FighterId>[] = [
    { id: 'p1', label: 'Player one', badge: 'P1', fighter: campaignMode ? campaignFighter : versusFighters[0] },
  ];
  if (!campaignMode) seats.push({
    id: 'p2', label: mode === 'local' ? 'Player two' : 'CPU fighter',
    badge: mode === 'local' ? 'P2' : 'CPU', fighter: versusFighters[1],
  });
  const unlocked = unlockedFighters(progress.current);
  setupPicker.update(seats, campaignMode ? fighterIds.filter((id) => !unlocked.includes(id)) : []);
}

const arena = byId('arena');
const matchTools = byId('match-tools');
const fullscreenButton = byId<HTMLButtonElement>('fullscreen');

function setFightView(playing: boolean) {
  matchTools.hidden = !playing;
  fullscreenButton.hidden = !playing || !document.fullscreenEnabled || !gamePanel.requestFullscreen;
  if (!playing && document.fullscreenElement === gamePanel) {
    void document.exitFullscreen().catch(() => {});
  }
}

fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement === gamePanel) await document.exitFullscreen();
    else await gamePanel.requestFullscreen();
  } catch {
    // The arena already fills the viewport when browser fullscreen is unavailable.
  }
  if (!matchTools.hidden) arena.focus({ preventScroll: true });
});
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement === gamePanel;
  fullscreenButton.textContent = fullscreen ? 'Exit fullscreen' : 'Fullscreen';
  if (fullscreen && matchTools.hidden) void document.exitFullscreen().catch(() => {});
});

function clearFight() {
  cancelAnimationFrame(renderFrame);
  gamePanel.hidden = true;
  offline = undefined;
  online = undefined;
  controls.active = false;
  controls.local = false;
  controls.release();
  info.hidden = true;
  objective.hidden = true;
  touch.hidden = true;
}

function backToSetup(exitRoom = false) {
  if (exitRoom) {
    connection.send({ type: 'leave' });
    connection.close();
    room = undefined;
  }
  clearFight();
  setFightView(false);
  privateResult = false;
  showView('setup');
  updateMode();
}

function startLocal(selection: Setup, localMode: LocalMode | 'replay', saved?: SavedFight) {
  clearFight();
  if (room) {
    connection.send({ type: 'leave' });
    room = undefined;
  }
  connection.close();
  setStatus('');
  const bout = selection.bout && localMode === 'campaign'
    ? campaign.startBout(progress.current.completed, selection.bout, selection.fighters[0], selection.seed) : undefined;
  offline = new OfflineFight(selection, localMode, saved?.recording, bout);
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
  const labels = { cpu: 'CPU fight', local: 'Local versus', campaign: 'Campaign', replay: 'Replay', online: `Online · P${seat + 1}` };
  gamePanel.hidden = false;
  renderer ??= new ArenaRenderer(byId('viewport'));
  byId('stage-name').textContent = stageInfo[selection.stage].name;
  byId('session-label').textContent = labels[matchMode];
  byId('stop').textContent = matchMode === 'online' ? 'Leave room' : 'End session';
  setFightView(true);
  touch.hidden = !capturePointer || !controls.active || controls.local;
  objective.hidden = true;
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
    byId('active-heading').textContent = selection.bout ? boutDetails(selection.bout).title : labels[matchMode];
    byId('active-matchup').textContent = selection.bout
      ? boutDetails(selection.bout).tip
      : `${definition.fighters[0].name} vs. ${definition.fighters[1].name}`;
    const guide = byId('move-guide');
    guide.hidden = matchMode === 'replay';
    if (!guide.hidden) renderMoveGuide(guide, definition.fighters[0], 0);
    const secondGuide = byId('move-guide-two');
    secondGuide.hidden = matchMode !== 'local';
    if (!secondGuide.hidden) renderMoveGuide(secondGuide, definition.fighters[1], 1, true);
    setStatus(matchMode === 'replay' ? 'Replaying the recorded inputs.' : 'Fight in progress.');
  }
  arena.focus({ preventScroll: true });
  renderFrame = requestAnimationFrame(render);
}

function stopFight() {
  backToSetup(!!room);
  setStatus('');
  (startButton.hidden ? chooseArena : startButton).focus({ preventScroll: true });
}

function finish(snapshot: Snapshot) {
  const viewingReplay = offline?.mode === 'replay';
  if (offline && !viewingReplay && offline.mode !== 'campaign') save({ setup, recording: offline.recording() });
  privateResult = !!online;
  controls.active = false;
  controls.release();
  touch.hidden = true;
  setFightView(false);
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
  againButton.hidden = false;
  const backButton = byId('result-back');
  backButton.hidden = false;
  if (setup.bout) {
    const previous = progress.current;
    const bout = boutDetails(setup.bout);
    progress.current = recordBout(previous, bout.id, snapshot);
    const cleared = progress.current !== previous;
    const won = winner === 0;
    const next = bouts[bouts.indexOf(bout) + 1];
    const champion = won && !next;
    nextCampaignBout = won ? next?.id : undefined;
    const score = byId('result-detail').textContent;
    resultHeading.textContent = champion ? 'Tournament Champion' : won ? 'Bout won' : winner === 'draw' ? 'Bout drawn' : 'Bout lost';
    byId('result-detail').textContent = won
      ? `${champion ? 'You defeated The Ocean and won the Neskowin Coast Championship.' : score}${'unlock' in bout && cleared ? ` ${roster[bout.unlock].name} joined your campaign roster.` : ''}`
      : `${score} ${bout.tip}`;
    againButton.textContent = champion ? 'View bracket' : won ? 'Next bout' : 'Retry bout';
    backButton.hidden = champion;
    backButton.textContent = 'Back to bracket';
    if (cleared) {
      const payout = shellBalance(progress.current) - shellBalance(previous);
      progressNote = writeProgress(progress.current) ? `Earned ${payout} shells.` : `Earned ${payout} shells for this session.`;
      drawShop();
    }
  } else {
    backButton.textContent = privateResult ? 'Leave room' : 'Back to setup';
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

const moveSlots = ['light', 'heavy', 'special'] as const;
const bindings = [['Light · F', 'Heavy · G', 'Special · H'], ['Light · J', 'Heavy · K', 'Special · L']] as const;

function renderMoveGuide(
  guide: HTMLElement, fighter: ReadonlyDeep<MatchDefinition>['fighters'][number], player: Seat, secondKeys = false,
) {
  guide.replaceChildren(...moveSlots.flatMap((slot, index) => {
    const binding = document.createElement('dt');
    const detail = document.createElement('dd');
    const cooldown = document.createElement('span');
    binding.textContent = bindings[Number(secondKeys)][index];
    detail.textContent = fighter.moves[slot].name;
    cooldown.className = 'move-cooldown';
    if (fighter.moves[slot].cooldownTicks) {
      cooldown.dataset.move = slot;
      cooldown.dataset.player = String(player);
      detail.append(cooldown);
    }
    const note = moveNotes[fighter.id as FighterId]?.[slot];
    if (note) {
      const short = document.createElement('small');
      short.textContent = note;
      detail.append(short);
    }
    return [binding, detail];
  }));
}

function updateRoom() {
  if (!room) return;
  byId('room-description').textContent = room.status === 'playing'
    ? `${stageInfo[room.stage as StageId].name} · You are player ${seat + 1}.`
    : `Connected directly. You are player ${seat + 1}.`;
  const players = byId('room-players');
  players.replaceChildren(...room.players.map((player, index) => {
    const item = document.createElement('li');
    const suffix = index === seat ? ' (you)' : '';
    const name = player?.fighter && roster[player.fighter as FighterId]?.name;
    item.textContent = player ? `Player ${index + 1}${suffix} · ${name || 'Picking'}${player.ready ? ' · Ready' : ''}` : 'Waiting for a guest';
    return item;
  }));
  const own = room.players[seat];
  byId('room-fighter').hidden = room.status !== 'waiting';
  roomPicker.update(room.players.map((player, index) => ({
    id: String(index), label: index === seat ? 'Your fighter' : 'Opponent',
    badge: index === seat ? 'You' : 'Rival', fighter: player?.fighter as FighterId | undefined,
    editable: index === seat && room?.status === 'waiting',
  })));
  readyButton.disabled = room.status !== 'waiting' || !own?.fighter;
  readyButton.textContent = own?.ready ? 'Cancel ready' : 'Ready';
  const fighter = own?.fighter && roster[own.fighter as FighterId];
  const guide = byId('room-move-guide');
  guide.hidden = !fighter;
  if (fighter) renderMoveGuide(guide, fighter, seat);
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
        if (firstView) {
          pairingCode.value = '';
          replyInput.value = '';
          roomPicker.focus();
        }
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
        onDisconnect('The players loaded different game versions. Reload both pages.');
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
        : message.reason === 'server-error' ? 'The browsers could not continue this room.'
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
  hud.querySelector('.clock')!.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  for (const [index, side] of [...hud.querySelectorAll('.hud-side')].entries()) {
    const actor = snapshot.fighters[index];
    const fighter = definition.fighters[index];
    const text = stock ? `${Math.round(actor.damage)}% · ${actor.stocks} ◆` : `${Math.ceil(actor.health)} HP · ${snapshot.roundWins[index]}`;
    side.querySelector('.hud-value')!.textContent = text;
    const [bar, guard] = side.querySelectorAll<HTMLElement>('.fill');
    bar.style.width = `${stock ? actor.stocks / 3 * 100 : actor.health / fighter.maxHealth * 100}%`;
    guard.style.width = `${fighter.maxGuard ? actor.guard / fighter.maxGuard * 100 : 0}%`;
  }
  const currentView = byId(online ? 'room-view' : 'active-view');
  if (!currentView.hidden) for (const label of currentView.querySelectorAll<HTMLElement>('[data-move]')) {
    const actor = snapshot.fighters[Number(label.dataset.player)];
    const slot = label.dataset.move as MoveSlot;
    const remaining = (actor.cooldowns?.[slot] ?? 0) - snapshot.tick;
    const charging = actor.move?.slot === slot && actor.move.charge?.released === false;
    const text = charging ? ' · Charging' : remaining > 0 ? ` · ${Math.ceil(remaining / TICK_RATE)}s` : '';
    if (label.textContent !== text) label.textContent = text;
  }
  if (setup.bout === 'king-tide-championship') {
    const move = snapshot.fighters[1].move;
    const attack = move && definition.fighters[1].moves[move.slot];
    const warning = snapshot.phase === 'playing' && move && attack
      && move.slot !== 'light' && move.frame < attack.startup ? `${attack.name} incoming · Jump` : '';
    if (objective.textContent !== warning) objective.textContent = warning;
    objective.hidden = !warning;
  }
}

function react(snapshot: Snapshot, events: readonly GameEvent[], now: number) {
  renderer?.effects(snapshot, events, now);
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
  if (!renderer) return;
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
        return;
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
    renderer.draw(definition, currentSnapshot, now, display.positions);
    if (currentSnapshot.phase === 'finished') finish(currentSnapshot);
  } else {
    renderer.draw(definition, currentSnapshot, now);
  }
  renderFrame = requestAnimationFrame(render);
}

function setScreen(screen: 'modes' | 'multiplayer' | 'game') {
  const playing = screen === 'game';
  document.body.dataset.screen = screen;
  modeScreen.hidden = screen !== 'modes';
  multiplayerScreen.hidden = screen !== 'multiplayer';
  gameScreen.hidden = !playing;
  for (const id of ['setup-link', 'game-nav', 'game-footer']) byId(id).hidden = !playing;
  window.scrollTo(0, 0);
}

function showMultiplayer() {
  setScreen('multiplayer');
  byId('multiplayer-heading').focus({ preventScroll: true });
}

function selectMode(selected: Mode) {
  mode = selected;
  choosingArena = false;
  gameScreen.dataset.mode = mode;
  if (mode === 'campaign') selectedBout = campaign.nextBout(progress.current.completed) ?? bouts.at(-1)!.id;
  gameBack.textContent = mode === 'local' || mode === 'online' ? 'Back to multiplayer' : 'Back to modes';
  setScreen('game');
  if (!byId('roster-list').hasChildNodes()) buildRoster();
  showView('setup');
  setStatus('');
  updateMode();
  drawShop();
  byId('setup-heading').focus({ preventScroll: true });
}

function returnFromGame() {
  pairingAttempt++;
  if (room) connection.send({ type: 'leave' });
  connection.close();
  room = undefined;
  clearFight();
  setFightView(false);
  privateResult = false;
  setScreen(mode === 'local' || mode === 'online' ? 'multiplayer' : 'modes');
  modeButtons.find((button) => button.dataset.mode === mode)?.focus({ preventScroll: true });
}

for (const button of modeButtons) {
  if (button.dataset.mode === 'online' && !roomsAvailable) {
    button.disabled = true;
    byId('online-description').textContent = 'This browser does not support online rooms.';
  }
  button.addEventListener('click', () => selectMode(button.dataset.mode as Mode));
}

gameBack.addEventListener('click', returnFromGame);
openMultiplayer.addEventListener('click', showMultiplayer);
byId('multiplayer-back').addEventListener('click', () => {
  setScreen('modes');
  openMultiplayer.focus({ preventScroll: true });
});

rulesField.addEventListener('change', () => {
  if (!supportsMatch(arenaPicker.value, rulesField.value)) arenaPicker.setValue('proposal-rock');
});

async function startPairing(kind: 'invite' | 'reply', createCode: () => Promise<string>) {
  const attempt = ++pairingAttempt;
  showView('pairing');
  byId('pairing-heading').focus({ preventScroll: true });
  byId('pairing-hint').textContent = '';
  byId('pairing-share').hidden = true;
  byId('reply-form').hidden = true;
  pairingCode.value = '';
  replyInput.value = '';
  acceptReply.disabled = false;
  setStatus('Preparing a direct connection…');
  try {
    const code = await createCode();
    if (attempt !== pairingAttempt || pairingView.hidden) return;
    const share = kind === 'invite' ? createInviteLink(location.href, code) : code;
    pairingCode.value = share;
    byId('pairing-code-label').textContent = kind === 'invite' ? 'Invite link' : 'Reply code';
    byId('copy-code').textContent = kind === 'invite' ? 'Copy invite link' : 'Copy reply code';
    byId('pairing-hint').textContent = kind === 'invite'
      ? 'Send the link to your friend and keep this tab open. Paste their reply here to connect.'
      : 'Send your reply code to the host. Keep this tab open while they connect.';
    byId('pairing-share').hidden = false;
    byId('reply-form').hidden = kind !== 'invite';
    setStatus('');
    return share;
  } catch (error) {
    if (attempt !== pairingAttempt || pairingView.hidden) return;
    backToSetup();
    setStatus(error instanceof Error ? error.message : 'Could not prepare a direct connection.');
  }
}

byId('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (startButton.hidden) return;
  const selection = readSetup();
  if (mode === 'online') {
    const link = startPairing('invite', () => connection.invite(selection.stage, selection.rule));
    const attempt = pairingAttempt;
    void Promise.all([link, copyInviteLink(link)]).then(([value, copied]) => {
      if (value && attempt === pairingAttempt && !pairingView.hidden) {
        setStatus(copied ? 'Invite link copied.' : 'Use Copy invite link to share your room.');
      }
    });
  } else startLocal(selection, mode);
});
byId('join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const invite = byId<HTMLTextAreaElement>('invite-input').value;
  void startPairing('reply', () => connection.reply(invite));
});
byId('reply-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  acceptReply.disabled = true;
  try {
    await connection.accept(replyInput.value);
    if (!pairingView.hidden) setStatus('Connecting to your friend…');
  } catch (error) {
    if (pairingView.hidden) return;
    acceptReply.disabled = false;
    setStatus(error instanceof Error ? error.message : 'Could not accept the reply.');
  }
});
byId('cancel-pairing').addEventListener('click', () => {
  pairingAttempt++;
  connection.close();
  stopFight();
});
readyButton.addEventListener('click', () => connection.send({ type: 'ready', ready: !room?.players[seat]?.ready }));
for (const button of document.querySelectorAll('[data-leave-room]')) button.addEventListener('click', stopFight);
byId('copy-code').addEventListener('click', async () => {
  const value = pairingCode.value;
  const label = byId('pairing-code-label').textContent;
  try {
    await navigator.clipboard.writeText(value);
    if (!pairingView.hidden && pairingCode.value === value) setStatus(`${label} copied.`);
  } catch {
    if (pairingView.hidden || pairingCode.value !== value) return;
    pairingCode.focus();
    pairingCode.select();
    setStatus('Copy the selected text and send it to your friend.');
  }
});
byId('stop').addEventListener('click', stopFight);
byId('result-back').addEventListener('click', () => {
  if (offline?.mode === 'campaign') selectedBout = campaign.nextBout(progress.current.completed) ?? selectedBout;
  stopFight();
});
replayButton.addEventListener('click', () => { if (lastReplay) startLocal(lastReplay.setup, 'replay', lastReplay); });
againButton.addEventListener('click', () => {
  if (privateResult && online) {
    const match = online.number;
    againButton.disabled = true;
    setStatus('Waiting for the other player to rematch.');
    connection.send({ type: 'rematch', match });
  } else if (offline?.mode === 'campaign') {
    if (setup.bout === bouts.at(-1)!.id && currentSnapshot.winner === 0) {
      stopFight();
      return;
    }
    selectedBout = nextCampaignBout ?? setup.bout!;
    startLocal(readSetup(), 'campaign');
  } else if (offline?.mode === 'replay' && lastReplay) {
    startLocal(lastReplay.setup, 'replay', lastReplay);
  } else if (offline && offline.mode !== 'replay') {
    startLocal({ ...setup, seed: randomSeed() }, offline.mode);
  }
});
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

const linkedInvite = readInviteLink(location.href);
if (linkedInvite !== null) {
  const page = new URL(location.href);
  page.hash = '';
  history.replaceState(history.state, '', page);
  if (roomsAvailable) {
    selectMode('online');
    void startPairing('reply', () => connection.reply(linkedInvite));
  }
}
