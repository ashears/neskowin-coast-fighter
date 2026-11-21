import { getProjectileDefinition, worldBox } from '@ashears/2d-fighter-framework';
import type { Box, Facing, GameEvent, MatchDefinition, ReadonlyDeep, Seat, Snapshot } from '@ashears/2d-fighter-framework';
import { arenas, fighterInfo, roster, stageInfo } from './content';
import type { FighterId, StageId } from './content';
import { cleanupRadius, cleanupStatus } from './campaign';
import forest from '../../public/assets/backgrounds/beach2.webp?url';
import rock from '../../public/assets/backgrounds/beach3.jpg?url';
import ridge from '../../public/assets/backgrounds/beach4.webp?url';
import access from '../../public/assets/backgrounds/beach1.jpeg?url';
import starfish from '../../public/assets/projectiles/starfish.webp?url';
import ball from '../../public/assets/projectiles/beach-ball.svg?url';
import shovel from '../../public/assets/projectiles/shovel.svg?url';
import fish from '../../public/assets/projectiles/fish.svg?url';
import chair from '../../public/assets/projectiles/chair.svg?url';
import towel from '../../public/assets/projectiles/towel.svg?url';
import tourist from '../../public/assets/projectiles/tourist.svg?url';
import runner from '../../public/assets/projectiles/duck-flag-runner-cutout.webp?url';
import quarterback from '../../public/assets/projectiles/duck-flag-quarterback-cutout.webp?url';
import mascot from '../../public/assets/projectiles/duck-flag-mascot-motorcycle-cutout.webp?url';
import { sprites } from './art';

const width = 960;
const height = 540;
type Point = { x: number; y: number };
const teamColors = ['#fbb783', '#90eddf'] as const;
const backgrounds: Record<StageId, string> = {
  'ghost-forest': forest, 'proposal-rock': rock, breakwater: ridge, 'beach-access': access, 'king-tide': forest,
};

const projectileArt = new Map([
  ['starfish', starfish], ['beach-ball', ball], ['shovel', shovel], ['fish', fish], ['chair', chair],
  ['towel', towel], ['tourist', tourist], ['runner', runner], ['mascot', mascot],
]);

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
  const depth = oneWay ? 11 : floating ? 48 : 25;
  const sand = ctx.createLinearGradient(0, y, 0, y + depth);
  sand.addColorStop(0, oneWay ? '#5d6b57' : '#7b6c52');
  sand.addColorStop(.45, oneWay ? '#35483a' : '#434f3e');
  sand.addColorStop(1, floating ? '#26342d' : '#25372a00');
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + span, y);
  if (floating) {
    ctx.lineTo(x + span - 11, y + depth * .48);
    ctx.lineTo(x + span * .77, y + depth * .86);
    ctx.lineTo(x + span * .57, y + depth * .7);
    ctx.lineTo(x + span * .39, y + depth);
    ctx.lineTo(x + span * .17, y + depth * .81);
    ctx.lineTo(x + 9, y + depth * .44);
  } else {
    ctx.lineTo(x + span, y + depth);
    ctx.lineTo(x, y + depth);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = oneWay ? '#d7e8bb' : '#eee0b2';
  ctx.fillRect(x, y, span, oneWay ? 2 : 2.5);
  ctx.fillStyle = '#e6d8b050';
  for (let index = 12; index < span - 14; index += 32) {
    ctx.fillRect(x + index, y + (index % 7) + 5, 6 + (index % 11), 1);
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
      const text = event.type === 'hit' ? (event.damage === 0 ? 'GRAB' : String(event.damage)) :
        event.type === 'guard-break' ? 'GUARD BREAK' : event.type === 'stock-lost' ? 'RING OUT' : 'BLOCK';
      this.effectsQueue.push({ x, y: y - 90, born: now, text, color: event.type === 'block' ? '#dcffeb' : '#ffdeb0' });
    }
  }

  private drawSprite(asset: string, x: number, y: number, height: number, facing: Facing, rotation = 0) {
    const image = this.getImage(asset);
    if (!image.complete || !image.naturalWidth) return false;
    const width = height * image.naturalWidth / image.naturalHeight;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.rotate(rotation);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  private abilityPose(id: FighterId, actor: Actor, position: Point) {
    const move = actor.move;
    if (!move) return;
    const ctx = this.ctx;
    const { x, y } = position;
    const spec = roster[id].moves[move.slot];
    const charging = move.charge?.released === false;
    if (charging) {
      ctx.fillStyle = '#122b24';
      ctx.fillRect(x - 27, y - 111, 54, 6);
      ctx.fillStyle = '#f5d379';
      const max = spec.chargeTicks!;
      ctx.fillRect(x - 27, y - 111, Math.max(2, 54 * move.charge!.held / max), 6);
      if (id === 'duck-flag') this.drawSprite(quarterback, x + 37 * move.facing, y - 58, 104, move.facing);
    }
    if (id === 'duck-flag' && move.slot === 'light' && move.frame < spec.startup) {
      ctx.save();
      ctx.globalAlpha = .46 + .46 * move.frame / spec.startup;
      this.drawSprite(runner, x + 28 * move.facing, y - 52, 96, move.facing);
      ctx.restore();
    }
    if (id === 'rip-rap' && move.slot === 'heavy' && move.frame < spec.startup + spec.active) {
      ctx.save();
      ctx.fillStyle = '#ece4c5';
      ctx.strokeStyle = '#504c3c';
      ctx.lineWidth = 2;
      ctx.globalAlpha = move.frame < spec.startup ? .27 : .9;
      for (let i = -2; i <= 2; i++) {
        const base = x + i * 28;
        const top = y - 158 + Math.abs(i) * 12;
        ctx.beginPath();
        ctx.moveTo(base - 13, y - 55);
        ctx.lineTo(base, top);
        ctx.lineTo(base + 13, y - 55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    if (id === 'proposal-rock' && move.landedAt !== undefined && move.frame - move.landedAt < 13) {
      const elapsed = this.reduced.matches ? 4 : move.frame - move.landedAt;
      ctx.save();
      ctx.globalAlpha = 1 - elapsed / 13;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#f4ce8c';
      ctx.beginPath();
      ctx.ellipse(x, y - 6, 49 + elapsed * 4, 8 + elapsed, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (id === 'chelan' && move.followup) {
      const remaining = move.followup.frame - move.frame;
      const action = spec.actions[move.followup.action];
      const duration = action.type === 'hitbox' ? action.followup?.delay ?? 1 : 1;
      ctx.save();
      ctx.strokeStyle = '#ffe59f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 33 * move.facing, y - 52, 39, -Math.PI / 2, 1.5 * Math.PI - remaining / duration * 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  private fighter(
    id: FighterId, actor: Actor, seat: Seat, position: Point, tick: number, cleanup: boolean, grabRotation: number,
  ) {
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
    const move = actor.move;
    const authored = move && roster[id].moves[move.slot];
    if (move && move.charge?.released !== false && authored && !(id === 'rip-rap' && move.slot === 'heavy')
      && authored.actions.some((action) => action.type === 'hitbox' && !action.onLanding && !action.followup
        && move.frame >= action.frame && move.frame < action.frame + action.duration)) {
      ctx.strokeStyle = fighterInfo[id].color;
      ctx.globalAlpha *= .64;
      ctx.lineWidth = actor.move.slot === 'light' ? 3 : 6;
      ctx.beginPath();
      ctx.ellipse(direction * 29, -51, 49, 38, direction * -.36, -.72, 1.42);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.scale(direction, 1);
    if (!this.reduced.matches && !cleanup) {
      let rotation = grabRotation * direction;
      if (id === 'proposal-rock' && move?.slot === 'special' && authored && move.frame < authored.active) {
        rotation = move.charge?.released ? move.frame * .47 : (move.charge?.held ?? 0) * .27;
      } else if (id === 'proposal-rock' && move?.slot === 'heavy' && !actor.surface) {
        rotation = Math.min(.55, move.frame * .037);
      }
      ctx.translate(0, -51);
      ctx.rotate(rotation);
      ctx.translate(0, 51);
    }
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
    if (!cleanup) {
      this.abilityPose(id, actor, position);
      ctx.fillStyle = '#122b24';
      ctx.fillRect(x - 15, y - 129, 30, 17);
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText(`P${seat + 1}`, x, y - 117);
    }
  }

  draw(definition: ReadonlyDeep<MatchDefinition>, snapshot: Snapshot, now: number,
    positions: readonly [Readonly<Point>, Readonly<Point>] = [snapshot.fighters[0].position, snapshot.fighters[1].position],
    cleanup = false,
  ) {
    const ctx = this.ctx;
    ctx.drawImage(this.back, 0, 0);
    for (const projectile of snapshot.projectiles) {
      const shape = getProjectileDefinition(definition, projectile);
      const box = worldBox(shape.box, projectile.position, projectile.facing);
      const id = definition.fighters[projectile.owner].id as FighterId;
      const { x, y, width: w, height: h } = box;
      const appearance = shape.appearance;
      const asset = appearance && projectileArt.get(appearance);
      const direction = appearance === 'mascot' && projectile.velocity.x
        ? (projectile.velocity.x < 0 ? -1 : 1) : projectile.facing;
      const rotation = this.reduced.matches ? 0 : snapshot.tick * .12 * projectile.facing;
      if (appearance === 'starfish') {
        const armed = shape.lifetime - projectile.remaining >= (shape.armTicks ?? 0);
        ctx.save();
        ctx.strokeStyle = armed ? '#ffe8a4' : '#fddc8380';
        ctx.fillStyle = armed ? '#f8cb7038' : '#f8cb7017';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h, w / 2, 8, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = armed ? 1 : .6;
        this.drawSprite(starfish, x + w / 2, y + h * .46, 49, direction);
        ctx.restore();
        continue;
      }
      const height = appearance === 'runner' ? 96 : appearance === 'mascot' ? 84 : h + 9;
      const spriteY = appearance === 'runner' ? y + h - height / 2 : y + h / 2;
      if (!asset || !this.drawSprite(asset, x + w / 2, spriteY, height, direction,
        id === 'chelan' ? rotation : 0)) {
        paintProjectile(ctx, id, box, direction, snapshot.tick, this.reduced.matches);
      }
    }
    for (const seat of [0, 1] as const) {
      if (cleanup && seat === 1) continue;
      const other = seat === 0 ? 1 : 0;
      const grip = definition.fighters[other].id === 'chelan' ? snapshot.fighters[other].move : null;
      const rotation = grip?.followup ? Math.min(.55, (grip.frame + 4) * .029) * grip.facing : 0;
      this.fighter(definition.fighters[seat].id as FighterId, snapshot.fighters[seat], seat, positions[seat], snapshot.tick, cleanup, rotation);
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
    ctx.fillStyle = stageInfo[this.currentStage].accent;
    ctx.fillRect(0, height - 2, width, 2);
  }
}
