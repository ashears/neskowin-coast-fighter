import { campaignKey, normalizeProgress } from './campaign';
import type { Progress } from './campaign';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(campaignKey);
    if (raw !== null) return normalizeProgress(JSON.parse(raw));
  } catch { /* The tournament remains playable when storage is unavailable. */ }
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
