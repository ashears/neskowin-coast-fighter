import { campaignKey, legacyKey, normalizeProgress } from './campaign';
import type { Progress } from './campaign';

export function loadProgress(): Progress {
  for (const key of [campaignKey, legacyKey]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return normalizeProgress(JSON.parse(raw));
    } catch { /* A broken or unavailable save still permits a fresh campaign. */ }
  }
  return normalizeProgress(null);
}

export function writeProgress(progress: Progress) {
  try {
    localStorage.setItem(campaignKey, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
