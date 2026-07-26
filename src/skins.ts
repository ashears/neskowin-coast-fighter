import Phaser from "phaser";

export type CharacterSkinId = "go-ducks-hat";

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
      offsetY: -0.5,
      widthRatio: 0.7,
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
  image.setDisplaySize(fighterDisplayWidth * skin.placement.widthRatio, fighterDisplayWidth * skin.placement.widthRatio * 0.67);
  if (depth !== undefined) image.setDepth(depth);
  return image;
}
