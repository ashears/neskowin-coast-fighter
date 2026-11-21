import { createCpu, createMatch, createRecording, isInputFrame, SNAPSHOT_VERSION } from '@ashears/2d-fighter-framework';
import type { GameEvent, InputFrame, Json, Match, Pair, Recording, Snapshot } from '@ashears/2d-fighter-framework';
import { fighterIds, coastConfig, coastTrainingConfig, fighterInfo, ruleIds, stageIds, supportsMatch } from './content';
import type { FighterId, RuleId, StageId } from './content';
import type { Controls } from './input';
import { campaignFight } from './campaign';
import type { StopId } from './campaign';

export type LocalMode = 'cpu' | 'local' | 'training' | 'campaign';
export type Mode = LocalMode | 'online';
export interface Setup {
  stage: StageId;
  rule: RuleId;
  fighters: [FighterId, FighterId];
  seed: number;
  stop?: StopId;
}

export interface SavedFight { setup: Setup; recording: Recording }
type QueuedSnapshot = { arrived: number; snapshot: Snapshot };

const replayKey = `neskowin-coast-replay-v${SNAPSHOT_VERSION}`;

export function storeReplay(fight: SavedFight) {
  try { sessionStorage.setItem(replayKey, JSON.stringify(fight)); } catch { /* Replays remain available in memory. */ }
}

export function readReplay(): SavedFight | undefined {
  try {
    const raw = sessionStorage.getItem(replayKey);
    if (!raw) return;
    const fight: SavedFight = JSON.parse(raw);
    const { setup, recording } = fight;
    if (!stageIds.includes(setup.stage) || !ruleIds.includes(setup.rule) || !supportsMatch(setup.stage, setup.rule)
      || setup.fighters.length !== 2 || !setup.fighters.every((id) => fighterIds.includes(id))
      || !Array.isArray(recording.inputs) || recording.inputs.length === 0 || recording.inputs.length > 18_000
      || !recording.inputs.every((input) => Array.isArray(input) && input.length === 2 && input.every(isInputFrame))) return;
    const { definition, rules } = coastConfig(setup.fighters, setup.stage, setup.rule, setup.seed);
    const match = createMatch(definition, rules);
    if (recording.version === SNAPSHOT_VERSION && recording.seed === setup.seed
      && recording.configuration === match.snapshot().configuration) return fight;
  } catch { /* Browser storage can be unavailable or corrupted. */ }
}

export function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export class OfflineFight {
  readonly match: Match<Json>;
  private readonly inputs: Pair<InputFrame>[] = [];
  private readonly opponent?: (snapshot: Snapshot) => InputFrame;
  private cursor = 0;

  constructor(readonly setup: Setup, readonly mode: LocalMode | 'replay', private readonly replay?: Recording) {
    if (mode === 'campaign' && setup.stop) {
      const chapter = campaignFight(setup.stop, setup.fighters[0], setup.seed);
      this.match = chapter.match;
      this.opponent = chapter.opponent;
      return;
    }
    const config = mode === 'training' ? coastTrainingConfig : coastConfig;
    const { definition, rules } = config(setup.fighters, setup.stage, setup.rule, setup.seed);
    this.match = createMatch(definition, rules);
    if (mode === 'cpu') {
      const cpu = createCpu({ seed: setup.seed, preferredRange: fighterInfo[setup.fighters[1]].range, stage: definition.stage });
      this.opponent = (snapshot) => cpu(snapshot, 1);
    }
  }

  tick(controls: Controls) {
    if (this.mode === 'replay') {
      const frame = this.replay?.inputs[this.cursor++];
      return frame ? this.match.step(frame) : null;
    }
    const first = controls.next(0);
    const second = this.mode === 'local' ? controls.next(1) : this.opponent?.(this.match.snapshot()) ?? 0;
    const frame: Pair<InputFrame> = [first, second];
    if (this.mode !== 'training' && this.mode !== 'campaign') this.inputs.push(frame);
    return this.match.step(frame);
  }

  recording() {
    return createRecording(this.match, this.inputs);
  }
}

export class OnlineFight {
  private readonly feed: QueuedSnapshot[];
  private incomingEvents: GameEvent[] = [];
  private sequence = 0;
  private lastSent = 0;
  private lastArrival: number;

  constructor(readonly setup: Setup, readonly number: number, initial: Snapshot) {
    this.lastArrival = performance.now();
    this.feed = [{ arrived: this.lastArrival, snapshot: initial }];
  }

  receive(snapshot: Snapshot, events: readonly GameEvent[], arrived: number) {
    if (snapshot.tick <= this.feed.at(-1)!.snapshot.tick) return;
    // Derive a smooth time axis from tick spacing, with room to recover after a delayed delivery.
    const ticks = snapshot.tick - this.feed.at(-1)!.snapshot.tick;
    this.lastArrival = Math.max(this.lastArrival + ticks * 1000 / 60, arrived - 70);
    this.feed.push({ arrived: this.lastArrival, snapshot });
    if (this.feed.length > 16) this.feed.shift();
    this.incomingEvents.push(...events);
  }

  input(frame: InputFrame) {
    if (frame === this.lastSent) return;
    this.lastSent = frame;
    return { type: 'input' as const, match: this.number, sequence: ++this.sequence, frame };
  }

  sample(now: number) {
    const target = now - 105;
    while (this.feed.length > 1 && this.feed[1].arrived <= target) this.feed.shift();
    const older = this.feed[0];
    const newer = this.feed[1] ?? older;
    const duration = newer.arrived - older.arrived;
    const fraction = duration > 0 ? Math.max(0, Math.min(1, (target - older.arrived) / duration)) : 0;
    const position = (seat: 0 | 1) => {
      const a = older.snapshot.fighters[seat];
      const b = newer.snapshot.fighters[seat];
      if (older.snapshot.round !== newer.snapshot.round || a.stocks !== b.stocks || a.respawn || b.respawn) return a.position;
      return { x: a.position.x + (b.position.x - a.position.x) * fraction, y: a.position.y + (b.position.y - a.position.y) * fraction };
    };
    const readyEvents = this.incomingEvents.filter(({ tick }) => tick <= older.snapshot.tick);
    this.incomingEvents = this.incomingEvents.filter(({ tick }) => tick > older.snapshot.tick);
    return { snapshot: older.snapshot, positions: [position(0), position(1)] as const, events: readyEvents };
  }
}
