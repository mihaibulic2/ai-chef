import { DEFAULT_ABOUT_ME, DEFAULT_ALLERGENS, DEFAULT_CONCERNS, DEFAULT_WATCHLIST } from '../defaults/profile'
import { DEFAULT_PANTRY } from '../defaults/pantry'
import { readJson, writeJson } from './local'
import type { Profile } from '../ai/types'

export interface Settings extends Profile {
  apiKey: string
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  pantryText: DEFAULT_PANTRY,
  watchlistText: DEFAULT_WATCHLIST,
  allergensText: DEFAULT_ALLERGENS,
  concernsText: DEFAULT_CONCERNS,
  aboutMe: DEFAULT_ABOUT_ME,
}

const KEY = 'settings'

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(KEY, {}) }
}

export function saveSettings(s: Settings): void {
  writeJson(KEY, s)
}

export function profileOf(s: Settings): Profile {
  const { pantryText, watchlistText, allergensText, concernsText, aboutMe } = s
  return { pantryText, watchlistText, allergensText, concernsText, aboutMe }
}
