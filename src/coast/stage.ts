import { getCombatBoxes, getProjectileDefinition, worldBox } from '@ashears/2d-fighter-framework';
import type { Box, Facing, GameEvent, MatchDefinition, ReadonlyDeep, Seat, Snapshot } from '@ashears/2d-fighter-framework';
import { arenas, fighterInfo, stageInfo } from './content';
import type { FighterId, StageId } from './content';
import { cleanupRadius, cleanupStatus } from './campaign';
import forest from '../../public/assets/backgrounds/beach2.webp?url';
import rock from '../../public/assets/backgrounds/beach3.jpg?url';
import ridge from '../../public/assets/backgrounds/beach4.webp?url';
import access from '../../public/assets/backgrounds/beach1.jpeg?url';
import proposal from '../../public/assets/fighters/proposal-rock.png?url';
import chelan from '../../public/assets/fighters/chelan.png?url';
import house from '../../public/assets/fighters/the-house.svg?url';
import ripRap from '../../public/assets/fighters/rip-rap.svg?url';
import ocean from '../../public/assets/fighters/ocean.svg?url';

const width = 960;
const height = 540;
type Point = { x: number; y: number };
const teamColors = ['#fbb783', '#90eddf'] as const;
const backgrounds: Record<StageId, string> = {
  'ghost-forest': forest, 'proposal-rock': rock, breakwater: ridge, 'beach-access': access, 'king-tide': forest,
};
const sprites = {
  'proposal-rock': { url: proposal, crop: [42, 112, 1510, 745], width: 166 },
  chelan: { url: chelan, crop: [105, 85, 800, 515], width: 143 },
  'rip-rap': { url: ripRap, width: 148 },
  'the-house': { url: house, width: 147 },
  ocean: { url: ocean, width: 158 },
} satisfies Partial<Record<FighterId, { url: string; crop?: number[]; width: number }>>;
type Actor = Snapshot['fighters'][number];

interface Effect extends Point {
  born: number;
  text: string;
  color: string;
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * ratio;
  const h = image.naturalHeight * ratio;
  ctx.drawImage(image, (width - w) / 2, (height - h) * .48, w, h);
}

function surface(ctx: CanvasRenderingContext2D, x: number, y: number, span: number, oneWay: boolean, floating: boolean) {
  const depth = oneWay ? 14 : floating ? 66 : 102;
  const sand = ctx.createLinearGradient(0, y, 0, y + depth);
  sand.addColorStop(0, oneWay ? '#52675b' : '#615748');
  sand.addColorStop(.35, '#35453d');
  sand.addColorStop(1, '#172b24');
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + span, y);
  ctx.lineTo(x + span - (oneWay ? 12 : 30), y + depth);
  ctx.lineTo(x + (oneWay ? 13 : 22), y + depth);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = oneWay ? '#d7e8bb' : '#eee0b2';
  ctx.fillRect(x, y, span, oneWay ? 2 : 3);
  ctx.fillStyle = '#d6e4bf55';
  for (let index = 12; index < span - 14; index += 32) {
    ctx.fillRect(x + index, y + (index % 7) + 5, 10 + (index % 11), 1.5);
  }
}

function paintProjectile(ctx: CanvasRenderingContext2D, id: FighterId, box: Box, facing: Facing, tick: number, reducedMotion: boolean) {
  const { x, y, width: w, height: h } = box;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.strokeStyle = '#fff9dc';
  ctx.lineWidth = 2;
  if (id === 'ocean') {
    ctx.scale(-facing, 1);
    const current = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    current.addColorStop(0, '#d2ffef');
    current.addColorStop(.36, '#6bd9de');
    current.addColorStop(1, '#2c6b83');
    ctx.fillStyle = current;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * .4);
    ctx.quadraticCurveTo(w * .1, h * .25, 0, -h * .28);
    ctx.quadraticCurveTo(-w * .3, -h * .64, -w * .49, -h * .22);
    ctx.quadraticCurveTo(-w * .18, -h * .34, -w * .24, h * .09);
    ctx.quadraticCurveTo(-w * .31, h * .3, -w / 2, h * .4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    if (!reducedMotion) ctx.rotate((id === 'chelan' || id === 'rip-rap') ? tick * .16 : -.32);
    ctx.fillStyle = fighterInfo[id].color;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * .46, h * (id === 'duck-flag' ? .3 : .46), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (id === 'chelan') {
      ctx.strokeStyle = '#d4774d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -h * .44);
      ctx.quadraticCurveTo(w * .32, 0, 0, h * .43);
      ctx.quadraticCurveTo(-w * .32, 0, 0, -h * .44);
      ctx.stroke();
    } else if (id === 'rip-rap') {
      ctx.strokeStyle = '#7b6c56';
      ctx.beginPath();
      ctx.moveTo(-w * .22, -h * .34);
      ctx.lineTo(w * .1, 0);
      ctx.lineTo(-w * .09, h * .26);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#6b4d27';
      ctx.beginPath();
      ctx.moveTo(-w * .21, 0);
      ctx.lineTo(w * .21, 0);
      ctx.moveTo(-w * .1, -h * .1);
      ctx.lineTo(-w * .1, h * .1);
      ctx.moveTo(w * .1, -h * .1);
      ctx.lineTo(w * .1, h * .1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export class ArenaRenderer {
  private readonly canvas = document.createElement('canvas');
  private readonly back = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly background: CanvasRenderingContext2D;
  private readonly images = new Map<string, HTMLImageElement>();
  private palette: { seat: Seat; color?: string } = { seat: 0 };
  private currentStage: StageId = 'ghost-forest';
  private effectsQueue: Effect[] = [];
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(parent: HTMLElement) {
    for (const canvas of [this.canvas, this.back]) {
      canvas.width = width;
      canvas.height = height;
    }
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.background = this.back.getContext('2d', { alpha: false })!;
    this.canvas.setAttribute('aria-hidden', 'true');
    parent.append(this.canvas);
    this.repaint();
  }

  private getImage(url: string) {
    const cached = this.images.get(url);
    if (cached) return cached;
    const image = new Image();
    this.images.set(url, image);
    image.addEventListener('load', () => {
      if (backgrounds[this.currentStage] === url) this.repaint();
    }, { once: true });
    image.src = url;
    return image;
  }

  private repaint() {
    const ctx = this.background;
    const stage = this.currentStage;
    ctx.fillStyle = '#284637';
    ctx.fillRect(0, 0, width, height);
    const image = this.getImage(backgrounds[stage]);
    if (image.complete && image.naturalWidth) cover(ctx, image);
    const veil = ctx.createLinearGradient(0, 0, 0, height);
    veil.addColorStop(0, stage === 'king-tide' ? '#071d33b0' : '#172c3285');
    veil.addColorStop(.48, stage === 'king-tide' ? '#14324c68' : '#171e2310');
    veil.addColorStop(1, '#091e1bd0');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, width, height);
    const world = arenas[stage];
    for (const deck of world.surfaces) surface(ctx, deck.x, deck.y, deck.width, deck.oneWay, !!world.blastZone);
  }

  setPalette(seat: Seat, color?: string) {
    this.palette = { seat, color };
  }

  stage(stage: StageId, reset = false) {
    if (reset) this.effectsQueue = [];
    if (stage === this.currentStage) return;
    this.currentStage = stage;
    this.effectsQueue = [];
    this.repaint();
  }

  effects(snapshot: Snapshot, events: readonly GameEvent[], now: number) {
    for (const event of events) {
      if (event.type !== 'hit' && event.type !== 'block' && event.type !== 'guard-break' && event.type !== 'stock-lost') continue;
      const target = 'target' in event ? event.target : event.seat;
      const { x, y } = snapshot.fighters[target].position;
      const text = event.type === 'hit' ? String(event.damage) :
        event.type === 'guard-break' ? 'GUARD BREAK' : event.type === 'stock-lost' ? 'RING OUT' : 'BLOCK';
      this.effectsQueue.push({ x, y: y - 90, born: now, text, color: event.type === 'block' ? '#dcffeb' : '#ffdeb0' });
    }
  }

  private fighter(id: FighterId, actor: Actor, seat: Seat, position: Point, tick: number, training: boolean) {
    if (actor.respawn || actor.health <= 0) return;
    const ctx = this.ctx;
    const { x, y } = position;
    const accent = this.palette.seat === seat && this.palette.color ? this.palette.color : teamColors[seat];
    const moving = Math.abs(actor.velocity.x) > 1 && !this.reduced.matches;
    const bounce = moving && actor.surface ? Math.sin(tick * .48) * 3 : 0;
    const direction = actor.move?.facing ?? actor.facing;
    const follow = actor.move && !this.reduced.matches ? Math.min(actor.move.frame * 1.35, 12) : 0;
    ctx.save();
    if (actor.invulnerable && tick % 12 < 6 && !this.reduced.matches) ctx.globalAlpha = .54;
    ctx.fillStyle = '#08211c90';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 49, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(x - 21, y + 3, 42, 2);
    ctx.translate(x + follow * direction, y + bounce);
    if (actor.guarding) {
      ctx.fillStyle = '#bbfff23a';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, -55, 61, 55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (actor.move) {
      ctx.strokeStyle = fighterInfo[id].color;
      ctx.globalAlpha *= .64;
      ctx.lineWidth = actor.move.slot === 'light' ? 3 : 6;
      ctx.beginPath();
      ctx.ellipse(direction * 29, -51, 49, 38, direction * -.36, -.72, 1.42);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.scale(direction, 1);
    if (id === 'duck-flag') {
      ctx.strokeStyle = '#faf2d2';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-19, -2); ctx.lineTo(-19, -109); ctx.stroke();
      ctx.fillStyle = '#477e50';
      ctx.beginPath(); ctx.moveTo(-19, -108); ctx.quadraticCurveTo(18, -122, 51, -97);
      ctx.lineTo(41, -74); ctx.quadraticCurveTo(11, -93, -19, -84); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f6db80';
      ctx.beginPath(); ctx.ellipse(9, -96, 12, 7, -.3, 0, Math.PI * 2); ctx.fill();
    } else {
      const sprite = sprites[id];
      const image = this.getImage(sprite.url);
      const spriteHeight = id === 'ocean' ? 115 : 100;
      if (image.complete && image.naturalWidth) {
        ctx.shadowColor = '#071b19';
        ctx.shadowBlur = 9;
        if ('crop' in sprite) {
          const [sx, sy, sw, sh] = sprite.crop;
          ctx.drawImage(image, sx, sy, sw, sh, -sprite.width / 2, -spriteHeight, sprite.width, spriteHeight);
        } else {
          ctx.drawImage(image, -sprite.width / 2, -spriteHeight, sprite.width, spriteHeight);
        }
      } else {
        ctx.fillStyle = fighterInfo[id].color;
        ctx.fillRect(-28, -78, 56, 78);
      }
    }
    ctx.restore();
    if (!training) {
      ctx.fillStyle = '#122b24';
      ctx.fillRect(x - 15, y - 129, 30, 17);
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText(`P${seat + 1}`, x, y - 117);
    }
  }

  draw(definition: ReadonlyDeep<MatchDefinition>, snapshot: Snapshot, now: number, debug = false,
    positions: readonly [Readonly<Point>, Readonly<Point>] = [snapshot.fighters[0].position, snapshot.fighters[1].position],
    cleanup = false,
  ) {
    const ctx = this.ctx;
    ctx.drawImage(this.back, 0, 0);
    for (const projectile of snapshot.projectiles) {
      const shape = getProjectileDefinition(definition, projectile);
      const box = worldBox(shape.box, projectile.position, projectile.facing);
      const id = definition.fighters[projectile.owner].id as FighterId;
      paintProjectile(ctx, id, box, projectile.facing, snapshot.tick, this.reduced.matches);
    }
    for (const seat of [0, 1] as const) {
      if (cleanup && seat === 1) continue;
      this.fighter(definition.fighters[seat].id as FighterId, snapshot.fighters[seat], seat, positions[seat], snapshot.tick, cleanup);
    }
    if (cleanup) {
      const { item } = cleanupStatus(snapshot);
      if (item) {
        const y = definition.stage.spawns[0].y;
        ctx.fillStyle = '#d8f2b43d';
        ctx.fillRect(item.x - cleanupRadius, y - 3, cleanupRadius * 2, 5);
        ctx.font = '700 15px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#173328';
        ctx.fillRect(item.x - 54, y - 53, 108, 25);
        ctx.fillStyle = '#ecffd1';
        ctx.fillText(item.label, item.x, y - 36);
        ctx.fillRect(item.x - 7, y - 17, 14, 15);
      }
    }
    this.effectsQueue = this.effectsQueue.filter(({ born }) => now - born < 490);
    for (const effect of this.effectsQueue) {
      const part = (now - effect.born) / 490;
      const y = effect.y - (this.reduced.matches ? 0 : part * 33);
      ctx.save();
      ctx.globalAlpha = 1 - part;
      ctx.strokeStyle = '#17302a';
      ctx.fillStyle = effect.color;
      ctx.font = '800 19px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeText(effect.text, effect.x, y);
      ctx.fillText(effect.text, effect.x, y);
      ctx.restore();
    }
    if (debug) {
      for (const { kind, box } of getCombatBoxes(definition, snapshot)) {
        ctx.fillStyle = kind === 'hurtbox' ? '#6ef0d040' : '#ffa36e55';
        ctx.strokeStyle = kind === 'hurtbox' ? '#95f2df' : '#ffe0a2';
        ctx.lineWidth = 1;
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      }
    }
    ctx.fillStyle = stageInfo[this.currentStage].accent;
    ctx.fillRect(0, height - 2, width, 2);
  }
}
