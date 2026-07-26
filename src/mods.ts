export interface ModSettings {
  rainbowFireworkMode: boolean;
  scaryMode: boolean;
}

const STORAGE_KEY = "neskowin-coast-fighter-mod-menu";

const DEFAULT_SETTINGS: ModSettings = {
  rainbowFireworkMode: false,
  scaryMode: false,
};

export function getModSettings(): ModSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ModSettings>;
    return {
      rainbowFireworkMode: parsed.rainbowFireworkMode === true,
      scaryMode: parsed.scaryMode === true,
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

function saveModSettings(settings: ModSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
