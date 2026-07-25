import type { LevelConfig } from "./types";

export const levels: LevelConfig[] = [
  {
    id: "neskowin",
    displayName: "Neskowin Arena",
    textureKey: "arena",
    assetPath: "assets/backgrounds/neskowin-arena.svg",
    accent: 0xe8c66b,
  },
  {
    id: "ocean-boss",
    displayName: "Ocean Boss",
    textureKey: "ocean-boss-arena",
    assetPath: "assets/backgrounds/ocean-boss-arena.svg",
    accent: 0x7ee8ff,
  },
  {
    id: "beach1",
    displayName: "beach1",
    textureKey: "beach1",
    assetPath: "assets/backgrounds/beach1.jpeg",
    accent: 0xf0d098,
  },
  {
    id: "beach2",
    displayName: "beach2",
    textureKey: "beach2",
    assetPath: "assets/backgrounds/beach2.webp",
    accent: 0xb9c2ba,
  },
  {
    id: "beach3",
    displayName: "beach3",
    textureKey: "beach3",
    assetPath: "assets/backgrounds/beach3.jpg",
    accent: 0x9dbd7a,
  },
  {
    id: "beach4",
    displayName: "beach4",
    textureKey: "beach4",
    assetPath: "assets/backgrounds/beach4.webp",
    accent: 0xf5a94f,
  },
];

export function getLevel(id: string): LevelConfig {
  return levels.find((level) => level.id === id) ?? levels[0];
}
