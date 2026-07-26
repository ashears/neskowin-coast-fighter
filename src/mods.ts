export type DamageMultiplier = 1 | 2 | 3 | 5 | 10 | 25;
export type SpeedMultiplier = 1 | 1.5 | 2 | 3 | 5;

export interface ModSettings {
  rainbowFireworkMode: boolean;
  scaryMode: boolean;
  infiniteHealth: boolean;
  damageMultiplier: DamageMultiplier;
  speedMultiplier: SpeedMultiplier;
}

const STORAGE_KEY = "neskowin-coast-fighter-mod-menu";
const DAMAGE_MULTIPLIERS = [1, 2, 3, 5, 10, 25] satisfies DamageMultiplier[];
const SPEED_MULTIPLIERS = [1, 1.5, 2, 3, 5] satisfies SpeedMultiplier[];

const DEFAULT_SETTINGS: ModSettings = {
  rainbowFireworkMode: false,
  scaryMode: false,
  infiniteHealth: false,
  damageMultiplier: 1,
  speedMultiplier: 1,
};

export function getModSettings(): ModSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ModSettings>;
    return {
      rainbowFireworkMode: parsed.rainbowFireworkMode === true,
      scaryMode: parsed.scaryMode === true,
      infiniteHealth: parsed.infiniteHealth === true,
      damageMultiplier: isDamageMultiplier(parsed.damageMultiplier) ? parsed.damageMultiplier : DEFAULT_SETTINGS.damageMultiplier,
      speedMultiplier: isSpeedMultiplier(parsed.speedMultiplier) ? parsed.speedMultiplier : DEFAULT_SETTINGS.speedMultiplier,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setRainbowFireworkMode(enabled: boolean) {
  return saveModSettings({ ...getModSettings(), rainbowFireworkMode: enabled });
}

export function setScaryMode(enabled: boolean) {
  return saveModSettings({ ...getModSettings(), scaryMode: enabled });
}

export function setInfiniteHealth(enabled: boolean) {
  return saveModSettings({ ...getModSettings(), infiniteHealth: enabled });
}

export function setDamageMultiplier(multiplier: DamageMultiplier) {
  return saveModSettings({ ...getModSettings(), damageMultiplier: multiplier });
}

export function setSpeedMultiplier(multiplier: SpeedMultiplier) {
  return saveModSettings({ ...getModSettings(), speedMultiplier: multiplier });
}

function isDamageMultiplier(value: unknown): value is DamageMultiplier {
  return DAMAGE_MULTIPLIERS.includes(value as DamageMultiplier);
}

function isSpeedMultiplier(value: unknown): value is SpeedMultiplier {
  return SPEED_MULTIPLIERS.includes(value as SpeedMultiplier);
}

function saveModSettings(settings: ModSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
