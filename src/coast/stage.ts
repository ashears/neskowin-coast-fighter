import { surfaceHeight, landingSurface, getProjectileDefinition, worldBox } from '@ashears/2d-fighter-framework';
import type { Box, Facing, GameEvent, MatchDefinition, ReadonlyDeep, Seat, Snapshot, StageDefinition } from '@ashears/2d-fighter-framework';
import { arenas, fighterInfo, roster, stageInfo } from './content';
import type { FighterId, StageId } from './content';
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
export const arenaBackgrounds: Record<StageId, string> = {
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
  strength: number;
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * ratio;
  const h = image.naturalHeight * ratio;
  ctx.drawImage(image, (width - w) / 2, (height - h) * .48, w, h);
}

function surface(ctx: CanvasRenderingContext2D, x: number, y: number, span: number, oneWay: boolean, floating: boolean, material?: string) {
  const depth = material === 'timber' ? 13 : oneWay ? 20 : floating ? 50 : 25;
  const sand = ctx.createLinearGradient(0, y, 0, y + depth);
  sand.addColorStop(0, material === 'timber' ? '#ad7852' : material === 'basalt' ? '#697579' : '#72815a');
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
  if (material === 'timber') {
    ctx.fillStyle = '#523f34';
    for (let i = 12; i < span - 7; i += 23) ctx.fillRect(x + i, y + 1, 2, 9);
    ctx.fillStyle = '#dac5a0';
    for (let i = 8; i < span - 7; i += 23) ctx.fillRect(x + i, y + 5, 2, 2);
  } else if (floating) {
    for (let i = 12; i < span - 35; i += 43) {
      ctx.fillStyle = i % 2 ? '#71807980' : '#24363e88';
      ctx.beginPath();
      ctx.moveTo(x + i, y + 3);
      ctx.lineTo(x + i + 28, y + 4);
      ctx.lineTo(x + i + 13, y + depth * .62);
      ctx.fill();
    }
  }
  ctx.fillStyle = material === 'moss' ? '#bad589' : oneWay ? '#e2d9b6' : '#eee0b2';
  ctx.fillRect(x, y, span, oneWay ? 2 : 2.5);
  ctx.fillStyle = '#e6d8b050';
  for (let index = 12; index < span - 14; index += 32) {
    ctx.fillRect(x + index, y + (index % 7) + 5, 6 + (index % 11), 1);
  }
}

function paintProjectile(ctx: CanvasRenderingContext2D, id: FighterId, box: Box, facing: Facing, tick: number, reducedMotion: boolean, appearance?: string) {
  const { x, y, width: w, height: h } = box;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.strokeStyle = '#fff9dc';
  ctx.lineWidth = 2;
  if (id === 'ocean') {
    ctx.scale(-facing, 1);
    const current = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    current.addColorStop(0, '#d2ffef');
    current.addColorStop(.36, appearance === 'sneaker-wave' ? '#81e8fc' : '#78e6c2');
    current.addColorStop(1, appearance === 'sneaker-wave' ? '#315987' : '#2c7b76');
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
  private readonly outlined = new Map<string, HTMLCanvasElement>();
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
    for (const asset of [ball, shovel, fish, chair, towel, tourist]) this.getImage(asset);
  }

  private getImage(url: string) {
    const cached = this.images.get(url);
    if (cached) return cached;
    const image = new Image();
    this.images.set(url, image);
    image.addEventListener('load', () => {
      if (arenaBackgrounds[this.currentStage] === url) this.repaint();
    }, { once: true });
    image.src = url;
    return image;
  }

  private repaint() {
    const ctx = this.background;
    const stage = this.currentStage;
    ctx.fillStyle = '#284637';
    ctx.fillRect(0, 0, width, height);
    const image = this.getImage(arenaBackgrounds[stage]);
    if (image.complete && image.naturalWidth) cover(ctx, image);
    const veil = ctx.createLinearGradient(0, 0, 0, height);
    veil.addColorStop(0, stage === 'king-tide' ? '#071d33b0' : '#172c3285');
    veil.addColorStop(.48, stage === 'king-tide' ? '#14324c68' : '#171e2310');
    veil.addColorStop(1, '#091e1bd0');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, width, height);
    const world = arenas[stage];
    for (const deck of world.surfaces) {
      ctx.save();
      ctx.translate(deck.x, deck.y);
      ctx.transform(1, ((deck.endY ?? deck.y) - deck.y) / deck.width, 0, 1, 0, 0);
      surface(ctx, 0, 0, deck.width, deck.oneWay, !!world.blastZone || deck.oneWay, deck.material);
      ctx.restore();
    }
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
      this.effectsQueue.push({
        x, y: y - 85, born: now, text, color: event.type === 'block' ? '#dcffeb' : '#ffdeb0',
        strength: event.type === 'guard-break' || (event.type === 'hit' && event.damage >= 20) ? 1.65 : 1,
      });
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

  private fighterSprite(id: FighterId, accent: string) {
    const key = `${id}:${accent}`;
    const cached = this.outlined.get(key);
    if (cached) return cached;
    const sprite = sprites[id];
    const image = this.getImage(sprite.url);
    if (!image.complete || !image.naturalWidth) return;
    const height = id === 'ocean' ? 115 : id === 'duck-flag' ? sprite.width * image.naturalHeight / image.naturalWidth : 100;
    const canvas = document.createElement('canvas');
    canvas.width = sprite.width + 16;
    canvas.height = Math.ceil(height) + 16;
    const ctx = canvas.getContext('2d')!;
    ctx.filter = `drop-shadow(0px 0px 2px ${accent}) drop-shadow(0px 0px 2px ${accent})`;
    if ('crop' in sprite) {
      const [x, y, w, h] = sprite.crop;
      ctx.drawImage(image, x, y, w, h, 8, 8, sprite.width, height);
    } else {
      const scale = Math.min(sprite.width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      ctx.drawImage(image, 8 + (sprite.width - w) / 2, 8 + height - h, w, h);
    }
    this.outlined.set(key, canvas);
    return canvas;
  }

  private abilityPose(id: FighterId, actor: Actor, position: Point, stage: ReadonlyDeep<StageDefinition>) {
    const move = actor.move;
    if (!move) return;
    const ctx = this.ctx;
    const { x, y } = position;
    const spec = roster[id].moves[move.slot]!;
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
      const action = spec.actions[0];
      if (action.type !== 'hitbox') return;
      const edge = worldBox(action.box, position, move.facing);
      ctx.save();
      ctx.fillStyle = '#ece4c5';
      ctx.strokeStyle = '#504c3c';
      ctx.lineWidth = 2;
      ctx.globalAlpha = move.frame < spec.startup ? .27 : .9;
      const span = edge.width / 5;
      for (let i = 0; i < 5; i++) {
        const base = edge.x + (i + .5) * span;
        const top = edge.y + Math.abs(i - 2) * 9;
        ctx.beginPath();
        ctx.moveTo(base - span / 2, edge.y + edge.height);
        ctx.lineTo(base, top);
        ctx.lineTo(base + span / 2, edge.y + edge.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    if (id === 'proposal-rock' && move.slot === 'heavy' && !actor.surface && move.landedAt === undefined) {
      const slam = spec.actions.find((action) => action.type === 'hitbox' && action.onLanding);
      if (slam?.type !== 'hitbox') return;
      const pushbox = roster[id].pushbox ?? roster[id].hurtbox;
      let foot = { ...actor.position };
      let speed = actor.velocity.y;
      for (let tick = 1; move.frame + tick < slam.frame + slam.duration; tick++) {
        speed = Math.min(stage.fallSpeed, speed + stage.gravity);
        let nextX = foot.x + actor.velocity.x;
        if (stage.walls) nextX = Math.max(stage.walls.left - pushbox.x, Math.min(stage.walls.right - pushbox.x - pushbox.width, nextX));
        const nextY = foot.y + speed;
        const floor = speed >= 0 && landingSurface(stage.surfaces, foot, { x: nextX, y: nextY }, actor.dropSurface);
        if (floor) {
          if (move.frame + tick >= slam.frame) {
            ctx.save();
            ctx.fillStyle = '#f4ce8c55';
            ctx.strokeStyle = '#fff2c2';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.ellipse(nextX + slam.box.x + slam.box.width / 2, surfaceHeight(floor, nextX) - 1, slam.box.width / 2, 9, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          break;
        }
        foot = { x: nextX, y: nextY };
      }
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
    if (id === 'chelan' && move.slot === 'heavy' && move.frame < spec.startup) {
      const action = spec.actions[0];
      const appearance = action.type === 'projectile' && action.variants?.[move.projectileVariants?.[0] ?? -1]?.projectile.appearance;
      const asset = appearance && projectileArt.get(appearance);
      if (asset) this.drawSprite(asset, x + move.facing * 42, y - 108, 34, move.facing);
    }
    if (id === 'chelan' && move.slot === 'special' && !move.followup && move.connectedActions.length === 0
      && move.frame >= spec.startup + spec.active && move.frame < spec.startup + spec.active + 12) {
      ctx.save();
      ctx.strokeStyle = '#feeca6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x + move.facing * 45, y - 55, 23, -.9, 1.5 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
    if (id === 'ocean' && (move.slot === 'special' || move.slot === 'heavy') && move.frame < spec.startup) {
      const special = move.slot === 'special';
      const progress = move.frame / spec.startup;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(move.facing, 1);
      ctx.fillStyle = special ? '#78edff42' : '#78efce32';
      ctx.strokeStyle = special ? '#baf5ff' : '#a9f9d7';
      ctx.lineWidth = special ? 3 : 2;
      const reach = special ? 155 : 92;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.quadraticCurveTo(43, -(special ? 55 : 20) * (.4 + progress), 73, -11);
      ctx.quadraticCurveTo(reach - 36, -4, reach, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (special) {
        ctx.fillStyle = '#cdfaff';
        ctx.font = '800 16px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('↑', 64, -26 - progress * 20);
      }
      ctx.restore();
    }
    if (move.slot === 'recovery' && move.frame < spec.active + 8) {
      ctx.save();
      ctx.strokeStyle = fighterInfo[id].color;
      ctx.globalAlpha = .86 - move.frame / 23;
      ctx.lineWidth = id === 'proposal-rock' || id === 'rip-rap' ? 5 : 3;
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(x - actor.velocity.x * ring * 1.5, y + ring * 9, 18 + ring * 5, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private fighter(
    id: FighterId, actor: Actor, seat: Seat, position: Point, tick: number, grabRotation: number, stage: ReadonlyDeep<StageDefinition>,
  ) {
    if (actor.respawn || actor.health <= 0) return;
    const ctx = this.ctx;
    const { x, y } = position;
    const accent = this.palette.seat === seat && this.palette.color ? this.palette.color : teamColors[seat];
    const moving = Math.abs(actor.velocity.x) > 1 && !this.reduced.matches;
    const bounce = moving && actor.surface ? Math.sin(tick * .48) * 3 : 0;
    const direction = actor.move?.facing ?? actor.facing;
    ctx.save();
    if (actor.invulnerable && tick % 12 < 6 && !this.reduced.matches) ctx.globalAlpha = .54;
    ctx.fillStyle = '#08211c90';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 49, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(x - 21, y + 3, 42, 2);
    ctx.translate(x, y + bounce);
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
    if (move && move.charge?.released !== false && authored && !(id === 'rip-rap' && move.slot === 'heavy')) {
      ctx.strokeStyle = fighterInfo[id].color;
      ctx.save();
      ctx.globalAlpha *= .78;
      ctx.scale(direction, 1);
      for (const action of authored.actions) {
        if (action.type !== 'hitbox' || action.onLanding || action.followup
          || move.frame < action.frame || move.frame >= action.frame + action.duration) continue;
        const { x, y, width, height } = action.box;
        ctx.lineWidth = move.slot === 'light' || move.slot === 'downLight' || move.slot === 'airLight' ? 4 : 6;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, -1.6, 1.6);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.scale(direction, 1);
    if (!this.reduced.matches) {
      let rotation = grabRotation * direction;
      if (authored && move && !grabRotation) {
        const activeEnd = authored.startup + authored.active;
        rotation = move.frame < authored.startup ? -.1 : move.frame < activeEnd ? .1
          : .06 * Math.max(0, 1 - (move.frame - activeEnd) / 10);
        if (move.slot === 'recovery') rotation = Math.max(-.19, Math.min(.19, actor.velocity.x * direction * .036));
      } else if (actor.stun && !grabRotation) {
        rotation = -.12;
      }
      if (id === 'proposal-rock' && move?.slot === 'special' && authored && move.frame < authored.active) {
        rotation = move.charge?.released ? move.frame * .47 : (move.charge?.held ?? 0) * .27;
      } else if (id === 'proposal-rock' && move?.slot === 'heavy' && !actor.surface) {
        rotation = Math.min(.55, move.frame * .037);
      } else if (id === 'the-house' && move?.slot === 'special') {
        rotation = move.frame < 10 ? -.13 : move.frame < 15 ? .17 : move.frame < 20 ? -.24 : .07;
      } else if (id === 'the-house' && move?.slot === 'airHeavy') {
        rotation = move.frame < 7 ? .11 : -.29;
      } else if (id === 'chelan' && move?.slot === 'special' && !move.followup) {
        rotation = move.frame < 17 ? .13 : move.connectedActions.length ? 0 : .25;
      }
      ctx.translate(0, -51);
      ctx.rotate(rotation);
      ctx.translate(0, 51);
    }
    const sprite = sprites[id];
    const image = this.fighterSprite(id, accent);
    if (id === 'duck-flag') {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(-19, -2); ctx.lineTo(-19, -109); ctx.stroke();
      ctx.strokeStyle = '#faf2d2';
      ctx.lineWidth = 5;
      ctx.stroke();
      if (image) {
        // Extend the flag in the facing direction while keeping its lettering readable.
        ctx.scale(direction, 1);
        const left = direction === 1 ? -19 : 19 - sprite.width;
        ctx.drawImage(image, left - 8, -121);
      }
    } else {
      const spriteHeight = id === 'ocean' ? 115 : 100;
      if (image) {
        ctx.drawImage(image, -sprite.width / 2 - 8, -spriteHeight - 8);
      } else {
        ctx.fillStyle = fighterInfo[id].color;
        ctx.fillRect(-28, -78, 56, 78);
      }
    }
    ctx.restore();
    this.abilityPose(id, actor, position, stage);
    ctx.fillStyle = '#122b24';
    ctx.fillRect(x - 15, y - 129, 30, 17);
    ctx.fillStyle = accent;
    ctx.fillRect(x - 15, y - 129, 30, 2);
    ctx.textAlign = 'center';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(`P${seat + 1}`, x, y - 117);
  }

  draw(definition: ReadonlyDeep<MatchDefinition>, snapshot: Snapshot, now: number,
    positions: readonly [Readonly<Point>, Readonly<Point>] = [snapshot.fighters[0].position, snapshot.fighters[1].position],
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
      if (appearance === 'boulder' && projectile.ground) {
        ctx.save();
        ctx.fillStyle = '#f5dfad';
        for (let rock = 0; rock < 5; rock++) {
          const drift = this.reduced.matches ? rock * 11 : (snapshot.tick * 3 + rock * 11) % 55;
          ctx.globalAlpha = .66 * (1 - drift / 55);
          ctx.fillRect(x + w / 2 - direction * (w / 2 + drift), y + h - 3 - rock % 3 * 2, 5, 3);
        }
        ctx.restore();
      }
      if (shape.motion?.type === 'orbit' && projectile.orbitCenter) {
        const { radius } = shape.motion;
        const center = projectile.orbitCenter;
        const ready = shape.lifetime - projectile.remaining >= (shape.armTicks ?? 0) && snapshot.tick >= (projectile.nextHitTick ?? 0);
        ctx.save();
        ctx.strokeStyle = ready ? '#fff1a3' : '#e5ecba90';
        ctx.lineWidth = ready ? 2.5 : 1.5;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, radius.x, radius.y, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ctx.strokeStyle;
        const arrowX = x + w / 2 + direction * (w / 2 + 11);
        const arrowY = y + h / 2;
        ctx.beginPath();
        ctx.moveTo(arrowX + direction * 8, arrowY);
        ctx.lineTo(arrowX - direction * 5, arrowY - 6);
        ctx.lineTo(arrowX - direction * 5, arrowY + 6);
        ctx.fill();
        ctx.restore();
      }
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
        paintProjectile(ctx, id, box, direction, snapshot.tick, this.reduced.matches, appearance);
      }
    }
    for (const seat of [0, 1] as const) {
      const other = seat === 0 ? 1 : 0;
      const grip = definition.fighters[other].id === 'chelan' ? snapshot.fighters[other].move : null;
      const rotation = grip?.followup ? Math.min(.55, (grip.frame + 4) * .029) * grip.facing : 0;
      this.fighter(definition.fighters[seat].id as FighterId, snapshot.fighters[seat], seat, positions[seat], snapshot.tick, rotation, definition.stage);
    }
    this.effectsQueue = this.effectsQueue.filter(({ born }) => now - born < 490);
    for (const effect of this.effectsQueue) {
      const part = (now - effect.born) / 490;
      const y = effect.y - (this.reduced.matches ? 0 : part * 33);
      ctx.save();
      if (part < .47) {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = (1 - part / .47) * .9;
        const reach = (this.reduced.matches ? 14 : 10 + part * 67) * effect.strength;
        for (let ray = 0; ray < 6; ray++) {
          const angle = ray * Math.PI / 3;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          ctx.beginPath();
          ctx.moveTo(effect.x + dx * reach, effect.y + 28 + dy * reach);
          ctx.lineTo(effect.x + dx * (reach + 9), effect.y + 28 + dy * (reach + 9));
          ctx.stroke();
        }
      }
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
