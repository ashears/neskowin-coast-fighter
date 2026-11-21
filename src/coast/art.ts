import type { FighterId } from './content';
import proposal from '../../public/assets/fighters/proposal-rock.png?url';
import chelan from '../../public/assets/fighters/chelan.png?url';
import house from '../../public/assets/fighters/the-house.webp?url';
import ripRap from '../../public/assets/fighters/rip-rap.webp?url';
import ocean from '../../public/assets/fighters/ocean.webp?url';
import duckFlag from '../../public/assets/fighters/duck-flag-sprite.png?url';

export const sprites = {
  'proposal-rock': { url: proposal, crop: [42, 112, 1510, 745], width: 166 },
  chelan: { url: chelan, crop: [105, 85, 800, 515], width: 143 },
  'rip-rap': { url: ripRap, width: 148 },
  'the-house': { url: house, width: 147 },
  'duck-flag': { url: duckFlag, width: 94 },
  ocean: { url: ocean, width: 158 },
} satisfies Record<FighterId, { url: string; crop?: number[]; width: number }>;
export function putPortrait(container: HTMLElement, id: FighterId) {
  if (container.dataset.fighter === id) return;
  container.dataset.fighter = id;
  const image = document.createElement('img');
  image.src = sprites[id].url;
  image.alt = '';
  image.draggable = false;
  container.replaceChildren(image);
}
