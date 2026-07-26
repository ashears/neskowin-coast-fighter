import { characterSkins, getCharacterSkin, type CharacterSkinId } from "./skins";

export type VictoryAnimationId =
  | "classic"
  | "aura-gold"
  | "aura-blue"
  | "aura-green"
  | "jump-celebration"
  | "spin-celebration"
  | "coin-burst"
  | "bonfire"
  | "custom-sign";

export interface VictoryAnimationConfig {
  id: VictoryAnimationId;
  displayName: string;
  description: string;
  price: number;
  accent: number;
}

export interface CustomVictorySettings {
  message: string;
  color: number;
  pattern: "rays" | "sparks" | "waves";
}

interface VictoryProgress {
  coins: number;
  ownedAnimationIds: VictoryAnimationId[];
  equippedAnimationId: VictoryAnimationId;
  ownedSkinIds: CharacterSkinId[];
  equippedSkinIdsByFighter: Record<string, CharacterSkinId | undefined>;
  custom: CustomVictorySettings;
  creditedMatchKeys: string[];
}

const STORAGE_KEY = "neskowin-coast-fighter-victory";
const STARTING_ANIMATION_ID: VictoryAnimationId = "classic";
const STARTER_ANIMATION_IDS: VictoryAnimationId[] = [
  "classic",
  "aura-gold",
  "aura-blue",
  "aura-green",
  "jump-celebration",
  "spin-celebration",
];
const DEFAULT_CUSTOM: CustomVictorySettings = {
  message: "Coast Champion",
  color: 0xf3d86f,
  pattern: "rays",
};

export const victoryAnimations: VictoryAnimationConfig[] = [
  {
    id: "classic",
    displayName: "Classic Spotlight",
    description: "A clean winner pose with coast-colored rays.",
    price: 0,
    accent: 0xf3d86f,
  },
  {
    id: "aura-gold",
    displayName: "Gold Aura",
    description: "A power-up stance with a bright gold battle aura.",
    price: 0,
    accent: 0xf3d86f,
  },
  {
    id: "aura-blue",
    displayName: "Blue Aura",
    description: "A focused power-up stance with blue energy flares.",
    price: 0,
    accent: 0x7ee8ff,
  },
  {
    id: "aura-green",
    displayName: "Green Aura",
    description: "A coastal green power-up aura with rising sparks.",
    price: 0,
    accent: 0x7ee889,
  },
  {
    id: "jump-celebration",
    displayName: "Jump Celebration",
    description: "A quick victory hop with a clean landing pop.",
    price: 0,
    accent: 0xffb84d,
  },
  {
    id: "spin-celebration",
    displayName: "Spin Celebration",
    description: "A rolling victory spin inspired by Proposal Rock's special, tuned slower with a softer charge.",
    price: 0,
    accent: 0xdbe9df,
  },
  {
    id: "coin-burst",
    displayName: "Coin Burst",
    description: "Victory coins arc across the screen.",
    price: 150,
    accent: 0xffb84d,
  },
  {
    id: "bonfire",
    displayName: "Beach Bonfire",
    description: "Warm sparks and a celebratory shoreline glow.",
    price: 240,
    accent: 0xe43f2e,
  },
  {
    id: "custom-sign",
    displayName: "Custom Sign",
    description: "Set your own victory shout, color, and pattern.",
    price: 320,
    accent: 0x7ee889,
  },
];

export function getVictoryProgress(): VictoryProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return normalizeProgress(JSON.parse(raw) as Partial<VictoryProgress>);
  } catch {
    return defaultProgress();
  }
}

export function getEquippedVictoryAnimation() {
  const progress = getVictoryProgress();
  return getVictoryAnimation(progress.equippedAnimationId);
}

export function getVictoryAnimation(id: string | undefined) {
  return victoryAnimations.find((animation) => animation.id === id) ?? victoryAnimations[0];
}

export function getEquippedCharacterSkin(fighterId: string) {
  const skinId = getVictoryProgress().equippedSkinIdsByFighter[fighterId];
  const skin = getCharacterSkin(skinId);
  return skin?.fighterId === fighterId ? skin : undefined;
}

export function isVictoryAnimationOwned(id: VictoryAnimationId) {
  return getVictoryProgress().ownedAnimationIds.includes(id);
}

export function purchaseVictoryAnimation(id: VictoryAnimationId) {
  const animation = getVictoryAnimation(id);
  const progress = getVictoryProgress();
  if (progress.ownedAnimationIds.includes(animation.id)) return { ok: true, progress };
  if (progress.coins < animation.price) return { ok: false, progress };

  const nextProgress = {
    ...progress,
    coins: progress.coins - animation.price,
    ownedAnimationIds: [...progress.ownedAnimationIds, animation.id],
    equippedAnimationId: animation.id,
  };
  saveVictoryProgress(nextProgress);
  return { ok: true, progress: nextProgress };
}

export function purchaseCharacterSkin(id: CharacterSkinId) {
  const skin = getCharacterSkin(id);
  const progress = getVictoryProgress();
  if (!skin) return { ok: false, progress };
  if (progress.ownedSkinIds.includes(skin.id)) return { ok: true, progress };
  if (progress.coins < skin.price) return { ok: false, progress };

  const nextProgress = {
    ...progress,
    coins: progress.coins - skin.price,
    ownedSkinIds: [...progress.ownedSkinIds, skin.id],
    equippedSkinIdsByFighter: {
      ...progress.equippedSkinIdsByFighter,
      [skin.fighterId]: skin.id,
    },
  };
  saveVictoryProgress(nextProgress);
  return { ok: true, progress: nextProgress };
}

export function equipVictoryAnimation(id: VictoryAnimationId) {
  const progress = getVictoryProgress();
  if (!progress.ownedAnimationIds.includes(id)) return progress;
  const nextProgress = { ...progress, equippedAnimationId: id };
  saveVictoryProgress(nextProgress);
  return nextProgress;
}

export function equipCharacterSkin(id: CharacterSkinId) {
  const skin = getCharacterSkin(id);
  const progress = getVictoryProgress();
  if (!skin || !progress.ownedSkinIds.includes(skin.id)) return progress;
  const nextProgress = {
    ...progress,
    equippedSkinIdsByFighter: {
      ...progress.equippedSkinIdsByFighter,
      [skin.fighterId]: skin.id,
    },
  };
  saveVictoryProgress(nextProgress);
  return nextProgress;
}

export function updateCustomVictorySettings(settings: CustomVictorySettings) {
  const progress = getVictoryProgress();
  const nextProgress = {
    ...progress,
    custom: {
      message: normalizeCustomMessage(settings.message),
      color: settings.color,
      pattern: settings.pattern,
    },
  };
  saveVictoryProgress(nextProgress);
  return nextProgress;
}

export function awardVictoryCoins(matchKey: string, amount: number) {
  const progress = getVictoryProgress();
  if (progress.creditedMatchKeys.includes(matchKey)) return { amount: 0, progress };

  const nextProgress = {
    ...progress,
    coins: progress.coins + amount,
    creditedMatchKeys: [...progress.creditedMatchKeys.slice(-24), matchKey],
  };
  saveVictoryProgress(nextProgress);
  return { amount, progress: nextProgress };
}

export function grantVictoryCoins(amount: number) {
  const progress = getVictoryProgress();
  const nextProgress = {
    ...progress,
    coins: progress.coins + Math.max(0, Math.floor(amount)),
  };
  saveVictoryProgress(nextProgress);
  return nextProgress;
}

export function calculateVictoryReward(mode: string, campaignWon: boolean) {
  if (campaignWon) return 125;
  if (mode === "campaign") return 35;
  if (mode === "online-host" || mode === "online-guest") return 90;
  return 75;
}

export function normalizeCustomMessage(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed.slice(0, 28) : DEFAULT_CUSTOM.message;
}

function defaultProgress(): VictoryProgress {
  return {
    coins: 0,
    ownedAnimationIds: [...STARTER_ANIMATION_IDS],
    equippedAnimationId: STARTING_ANIMATION_ID,
    ownedSkinIds: [],
    equippedSkinIdsByFighter: {},
    custom: { ...DEFAULT_CUSTOM },
    creditedMatchKeys: [],
  };
}

function normalizeProgress(progress: Partial<VictoryProgress>): VictoryProgress {
  const ownedAnimationIds = Array.isArray(progress.ownedAnimationIds)
    ? progress.ownedAnimationIds.filter((id): id is VictoryAnimationId => victoryAnimations.some((animation) => animation.id === id))
    : [];
  const equippedAnimationId = ownedAnimationIds.includes(progress.equippedAnimationId as VictoryAnimationId)
    ? (progress.equippedAnimationId as VictoryAnimationId)
    : STARTING_ANIMATION_ID;
  const ownedSkinIds = Array.isArray(progress.ownedSkinIds)
    ? progress.ownedSkinIds.filter((id): id is CharacterSkinId => characterSkins.some((skin) => skin.id === id))
    : [];
  const equippedSkinIdsByFighter: Record<string, CharacterSkinId | undefined> = {};
  const rawEquippedSkins = progress.equippedSkinIdsByFighter;
  if (rawEquippedSkins && typeof rawEquippedSkins === "object") {
    Object.entries(rawEquippedSkins).forEach(([fighterId, skinId]) => {
      const skin = getCharacterSkin(skinId);
      if (skin && skin.fighterId === fighterId && ownedSkinIds.includes(skin.id)) {
        equippedSkinIdsByFighter[fighterId] = skin.id;
      }
    });
  }
  const pattern = progress.custom?.pattern;
  return {
    coins: Number.isFinite(progress.coins) ? Math.max(0, Math.floor(progress.coins ?? 0)) : 0,
    ownedAnimationIds: Array.from(new Set([...STARTER_ANIMATION_IDS, ...ownedAnimationIds])),
    equippedAnimationId,
    ownedSkinIds: Array.from(new Set(ownedSkinIds)),
    equippedSkinIdsByFighter,
    custom: {
      message: normalizeCustomMessage(progress.custom?.message ?? DEFAULT_CUSTOM.message),
      color: Number.isFinite(progress.custom?.color) ? progress.custom!.color : DEFAULT_CUSTOM.color,
      pattern: pattern === "sparks" || pattern === "waves" || pattern === "rays" ? pattern : DEFAULT_CUSTOM.pattern,
    },
    creditedMatchKeys: Array.isArray(progress.creditedMatchKeys) ? progress.creditedMatchKeys.filter((key) => typeof key === "string").slice(-25) : [],
  };
}

function saveVictoryProgress(progress: VictoryProgress) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
