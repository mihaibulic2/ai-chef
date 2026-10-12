// Vocabulary the judge may use for recipe tags. Kept here so the UI can style known tags consistently.
export const TAG_VOCABULARY = [
  'high protein', 'low protein',
  'high carbs', 'low carbs',
  'high fat', 'low fat',
  'high sat fat', 'low sat fat',
  'high sugar', 'low sugar',
  'high sodium', 'low sodium',
  'high fiber',
  'nut-free', 'dairy-free', 'gluten-free', 'egg-free',
  'watch-list free', 'contains watch-list item',
] as const

const GOOD = new Set(['high protein', 'low fat', 'low sat fat', 'low sugar', 'low sodium', 'high fiber', 'nut-free', 'dairy-free', 'gluten-free', 'egg-free', 'watch-list free'])
const BAD = new Set(['high sat fat', 'high sugar', 'high sodium', 'contains watch-list item', 'high fat'])

export function tagTone(tag: string): 'good' | 'bad' | 'neutral' {
  const t = tag.toLowerCase()
  if (GOOD.has(t)) return 'good'
  if (BAD.has(t)) return 'bad'
  if (t.startsWith('missing')) return 'bad'
  return 'neutral'
}
