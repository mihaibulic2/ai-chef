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

// Pantry text shipped briefly as this placeholder; upgrade anyone who saved it.
const OLD_PANTRY_PLACEHOLDER = ['Barilla spaghetti 1 lb', 'olive oil', 'garlic', 'yellow onions, 3'].join('\n')

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(KEY, {})
  const merged: Settings = { ...DEFAULT_SETTINGS }
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = stored[k]
    if (typeof v === 'string') merged[k] = v
  }
  if (merged.pantryText.trim() === OLD_PANTRY_PLACEHOLDER) merged.pantryText = DEFAULT_SETTINGS.pantryText
  return merged
}

export function saveSettings(s: Settings): void {
  writeJson(KEY, s)
}

export function profileOf(s: Settings): Profile {
  const { pantryText, watchlistText, allergensText, concernsText, aboutMe } = s
  return { pantryText, watchlistText, allergensText, concernsText, aboutMe }
}
