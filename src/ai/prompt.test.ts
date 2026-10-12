import { describe, expect, it } from 'vitest'
import { renderChatSystem } from './client'
import type { Profile } from './types'

const profile: Profile = {
  pantryText: 'ZZ_PANTRY_ITEM\nanother pantry thing',
  watchlistText: 'ZZ_WATCH_ITEM',
  allergensText: 'ZZ_ALLERGEN',
  concernsText: 'ZZ_CONCERN',
  aboutMe: 'ZZ_ABOUT_ME sentence',
}

describe('renderChatSystem', () => {
  it('inserts every profile field', () => {
    const out = renderChatSystem(profile)
    expect(out).toContain('ZZ_PANTRY_ITEM')
    expect(out).toContain('another pantry thing')
    expect(out).toContain('ZZ_WATCH_ITEM')
    expect(out).toContain('ZZ_ALLERGEN')
    expect(out).toContain('ZZ_CONCERN')
    expect(out).toContain('ZZ_ABOUT_ME sentence')
  })

  it('leaves no placeholders behind', () => {
    expect(renderChatSystem(profile)).not.toContain('{{')
    expect(renderChatSystem(profile)).not.toContain('}}')
  })

  it('renders empty lists as (none)', () => {
    const out = renderChatSystem({ pantryText: '', watchlistText: '', allergensText: '', concernsText: '', aboutMe: '' })
    expect(out).toContain('(none)')
    expect(out).not.toContain('{{')
  })

  it('has substantive prompt text beyond the profile', () => {
    expect(renderChatSystem(profile).length).toBeGreaterThan(200)
  })
})
