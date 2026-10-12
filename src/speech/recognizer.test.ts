import { describe, expect, it } from 'vitest'
import { DONE_WORDS, stripDoneWord } from './recognizer'

describe('DONE_WORDS', () => {
  it('includes the required phrases', () => {
    expect(DONE_WORDS).toEqual(expect.arrayContaining(['done', "that's it", "i'm done"]))
  })
})

describe('stripDoneWord', () => {
  it('strips a trailing "done"', () => {
    expect(stripDoneWord('pasta for two done')).toBe('pasta for two')
  })

  it('strips trailing punctuation around the done word', () => {
    expect(stripDoneWord('pasta for two, done.')).toBe('pasta for two')
    expect(stripDoneWord('pasta for two done!')).toBe('pasta for two')
  })

  it('returns an empty string when the whole transcript is a done word', () => {
    expect(stripDoneWord('done')).toBe('')
    expect(stripDoneWord('Done.')).toBe('')
  })

  it('returns null when done is not at the end', () => {
    expect(stripDoneWord('pasta is well done tonight')).toBeNull()
  })

  it('returns null when done is only part of a word', () => {
    expect(stripDoneWord('something undone')).toBeNull()
  })

  it('returns null when there is no done word', () => {
    expect(stripDoneWord('pasta for two')).toBeNull()
    expect(stripDoneWord('')).toBeNull()
  })

  it('strips a trailing "that\'s it"', () => {
    expect(stripDoneWord("pasta for two that's it")).toBe('pasta for two')
  })

  it('strips the whole phrase "i\'m done", not just "done"', () => {
    expect(stripDoneWord("pasta for two I'm done")).toBe('pasta for two')
    expect(stripDoneWord("pasta for two, I'm done")).toBe('pasta for two')
  })

  it('is case-insensitive', () => {
    expect(stripDoneWord('pasta for two DONE')).toBe('pasta for two')
  })
})
