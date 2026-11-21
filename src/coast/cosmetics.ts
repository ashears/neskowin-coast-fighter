export const palettes = [
  { id: 'daybreak', name: 'Daybreak', price: 60, color: '#ffd093' },
  { id: 'tideglass', name: 'Tideglass', price: 75, color: '#a9eefa' },
  { id: 'spruce', name: 'Spruce', price: 90, color: '#deee99' },
] as const;
export type PaletteId = typeof palettes[number]['id'];

export interface Collection {
  owned: PaletteId[];
  equipped: PaletteId | null;
}

export function normalizeCollection(data: Record<string, unknown>): Collection {
  const saved = Array.isArray(data.owned) ? data.owned : [];
  const owned = palettes.filter(({ id }) => saved.includes(id)).map(({ id }) => id);
  return { owned, equipped: owned.find((id) => id === data.equipped) ?? null };
}
