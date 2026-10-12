import { beforeEach, describe, expect, it } from 'vitest'
import { PREFIX, clearAll, readJson, removeKey, usedBytes, writeJson } from './local'
import { DEFAULT_SETTINGS, loadSettings, profileOf, saveSettings } from './settings'

beforeEach(() => localStorage.clear())

describe('local', () => {
  it('prefixes keys', () => {
    writeJson('k', { a: 1 })
    expect(localStorage.getItem(PREFIX + 'k')).toBe(JSON.stringify({ a: 1 }))
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('round-trips values', () => {
    writeJson('k', [1, 'two', { three: 3 }])
    expect(readJson('k', null)).toEqual([1, 'two', { three: 3 }])
  })

  it('returns the fallback for a missing key', () => {
    expect(readJson('missing', { d: true })).toEqual({ d: true })
  })

  it('returns the fallback for unparseable JSON', () => {
    localStorage.setItem(PREFIX + 'bad', '{not json')
    expect(readJson('bad', 'fb')).toBe('fb')
  })

  it('removeKey removes only that key', () => {
    writeJson('a', 1)
    writeJson('b', 2)
    removeKey('a')
    expect(readJson('a', null)).toBeNull()
    expect(readJson('b', null)).toBe(2)
  })

  it('clearAll removes only prefixed keys', () => {
    writeJson('a', 1)
    writeJson('b', 2)
    localStorage.setItem('other', 'keep')
    localStorage.setItem('aichef', 'keep-too')
    clearAll()
    expect(localStorage.getItem('other')).toBe('keep')
    expect(localStorage.getItem('aichef')).toBe('keep-too')
    expect(localStorage.getItem(PREFIX + 'a')).toBeNull()
    expect(localStorage.getItem(PREFIX + 'b')).toBeNull()
  })

  it('usedBytes grows as data is written', () => {
    const before = usedBytes()
    writeJson('big', 'x'.repeat(1000))
    expect(usedBytes()).toBeGreaterThan(before + 900)
  })
})

describe('settings', () => {
  it('loads defaults when nothing is saved', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('defaults mention nuts and the two concerns', () => {
    expect(DEFAULT_SETTINGS.allergensText.toLowerCase()).toContain('nuts')
    expect(DEFAULT_SETTINGS.concernsText.toLowerCase()).toContain('high saturated fat')
    expect(DEFAULT_SETTINGS.concernsText.toLowerCase()).toContain('high added sugar')
    expect(DEFAULT_SETTINGS.apiKey).toBe('')
  })

  it('merges saved values over defaults', () => {
    saveSettings({ ...DEFAULT_SETTINGS, allergensText: 'eggs', apiKey: 'sk-test' })
    const s = loadSettings()
    expect(s.allergensText).toBe('eggs')
    expect(s.apiKey).toBe('sk-test')
    expect(s.pantryText).toBe(DEFAULT_SETTINGS.pantryText)
  })

  it('fills missing fields from defaults for partial saved data', () => {
    writeJson('settings', { aboutMe: 'me' })
    const s = loadSettings()
    expect(s.aboutMe).toBe('me')
    expect(s.allergensText).toBe(DEFAULT_SETTINGS.allergensText)
    expect(s.concernsText).toBe(DEFAULT_SETTINGS.concernsText)
  })

  it('profileOf returns the five profile fields and never the api key', () => {
    const p = profileOf({ ...DEFAULT_SETTINGS, apiKey: 'secret', aboutMe: 'hi' })
    expect(Object.keys(p).sort()).toEqual(['aboutMe', 'allergensText', 'concernsText', 'pantryText', 'watchlistText'])
    expect(p).not.toHaveProperty('apiKey')
    expect(JSON.stringify(p)).not.toContain('secret')
    expect(p.aboutMe).toBe('hi')
  })
})
