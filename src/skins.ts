import Phaser from "phaser";

export type CharacterSkinId = "go-ducks-hat" | "batman-skin" | "proposal-rock-straw-hat-pirate";

export interface CharacterSkinConfig {
  id: CharacterSkinId;
  displayName: string;
  description: string;
  fighterId: string;
  price: number;
  textureKey: string;
  assetPath: string;
  accent: number;
  placement: {
    offsetX: number;
    offsetY: number;
    widthRatio: number;
    heightRatio?: number;
  };
}

export const characterSkins: CharacterSkinConfig[] = [
  {
    id: "go-ducks-hat",
    displayName: "Go Ducks Hat",
    description: "A green-and-gold game day hat for Proposal Rock.",
    fighterId: "proposal-rock",
    price: 220,
    textureKey: "skin-go-ducks-hat",
    assetPath: "assets/skins/go-ducks-hat.png",
    accent: 0x154733,
    placement: {
      offsetX: -0.04,
      offsetY: -0.36,
      widthRatio: 0.7,
    },
  },
  {
    id: "batman-skin",
    displayName: "Batman Skin",
    description: "A midnight cowl, cape, belt, and bat emblem reskin for The Chelan.",
    fighterId: "chelan",
    price: 260,
    textureKey: "skin-batman",
    assetPath: "assets/skins/batman-skin.png",
    accent: 0xf3c51f,
    placement: {
      offsetX: 0,
      offsetY: 0,
      widthRatio: 1,
      heightRatio: 0.6,
    },
  },
  {
    id: "proposal-rock-straw-hat-pirate",
    displayName: "Straw Hat Pirate",
    description: "A straw-hat pirate outfit for Proposal Rock, with a red vest, sash, blue shorts, and sandals.",
    fighterId: "proposal-rock",
    price: 300,
    textureKey: "skin-proposal-rock-straw-hat-pirate",
    assetPath: "assets/skins/proposal-rock-straw-hat-pirate.svg",
    accent: 0xe43f2e,
    placement: {
      offsetX: 0,
      offsetY: 0,
      widthRatio: 1,
      heightRatio: 0.75,
    },
  },
];

export function getCharacterSkin(id: string | undefined) {
  return characterSkins.find((skin) => skin.id === id);
}

export function drawCharacterSkinOverlay(
  scene: Phaser.Scene,
  skin: CharacterSkinConfig | undefined,
  fighterId: string,
  x: number,
  y: number,
  fighterDisplayWidth: number,
  depth?: number,
) {
  if (!skin || skin.fighterId !== fighterId) return undefined;
  const image = scene.add.image(
    x + skin.placement.offsetX * fighterDisplayWidth,
    y + skin.placement.offsetY * fighterDisplayWidth,
    skin.textureKey,
  );
  image.setDisplaySize(
    fighterDisplayWidth * skin.placement.widthRatio,
    fighterDisplayWidth * skin.placement.widthRatio * (skin.placement.heightRatio ?? 0.67),
  );
  if (depth !== undefined) image.setDepth(depth);
  return image;
}
