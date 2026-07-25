export interface CampaignLevel {
  id: string;
  displayName: string;
  opponentId: string;
  levelId: string;
  unlockFighterId?: string;
  mapX: number;
  mapY: number;
}

interface CampaignProgress {
  completedLevelIds: string[];
  unlockedFighterIds: string[];
}

const STORAGE_KEY = "neskowin-coast-fighter-campaign";
export const STARTING_FIGHTER_ID = "proposal-rock";

export const campaignLevels: CampaignLevel[] = [
  {
    id: "chelan-opener",
    displayName: "Chelan Shore",
    opponentId: "chelan",
    levelId: "neskowin",
    unlockFighterId: "chelan",
    mapX: 242,
    mapY: 468,
  },
  {
    id: "rip-rap-ridge",
    displayName: "Rip Rap Ridge",
    opponentId: "rip-rap",
    levelId: "beach3",
    unlockFighterId: "rip-rap",
    mapX: 454,
    mapY: 354,
  },
  {
    id: "the-house-steps",
    displayName: "House Steps",
    opponentId: "the-house",
    levelId: "beach4",
    unlockFighterId: "the-house",
    mapX: 704,
    mapY: 418,
  },
  {
    id: "ocean-boss",
    displayName: "Ocean Boss",
    opponentId: "ocean",
    levelId: "ocean-boss",
    unlockFighterId: "ocean",
    mapX: 988,
    mapY: 286,
  },
];

function defaultProgress(): CampaignProgress {
  return {
    completedLevelIds: [],
    unlockedFighterIds: [STARTING_FIGHTER_ID],
  };
}

export function getCampaignProgress(): CampaignProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
    return normalizeProgress(parsed);
  } catch {
    return defaultProgress();
  }
}

export function isCampaignLevelUnlocked(levelId: string) {
  const index = campaignLevels.findIndex((level) => level.id === levelId);
  if (index <= 0) return index === 0;
  const progress = getCampaignProgress();
  return progress.completedLevelIds.includes(campaignLevels[index - 1].id);
}

export function isFighterUnlocked(fighterId: string) {
  return getCampaignProgress().unlockedFighterIds.includes(fighterId);
}

export function completeCampaignLevel(levelId: string) {
  const level = campaignLevels.find((candidate) => candidate.id === levelId);
  const progress = getCampaignProgress();
  if (!level) return progress;

  const completedLevelIds = Array.from(new Set([...progress.completedLevelIds, level.id]));
  const unlockedFighterIds = Array.from(
    new Set([...progress.unlockedFighterIds, STARTING_FIGHTER_ID, ...(level.unlockFighterId ? [level.unlockFighterId] : [])]),
  );
  const nextProgress = { completedLevelIds, unlockedFighterIds };
  saveCampaignProgress(nextProgress);
  return nextProgress;
}

function normalizeProgress(progress: Partial<CampaignProgress>): CampaignProgress {
  const completedLevelIds = Array.isArray(progress.completedLevelIds)
    ? progress.completedLevelIds.filter((id) => campaignLevels.some((level) => level.id === id))
    : [];
  const unlockedFighterIds = Array.isArray(progress.unlockedFighterIds)
    ? progress.unlockedFighterIds
    : [];
  return {
    completedLevelIds,
    unlockedFighterIds: Array.from(new Set([STARTING_FIGHTER_ID, ...unlockedFighterIds])),
  };
}

function saveCampaignProgress(progress: CampaignProgress) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
