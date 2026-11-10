import { expect, test } from 'vitest'
import { titleOf } from '../src/ui/StreamPage.jsx'

test('title is the first heading of the file', () => {
  expect(titleOf('# A04 · Log in formato JSON\n\n> x', 'A04-x.md')).toBe('A04 · Log in formato JSON')
  expect(titleOf('\n\n# Titolo', 'f.md')).toBe('Titolo')
})

test('without a heading the file name is used', () => {
  expect(titleOf('testo', 'f.md')).toBe('f.md')
  expect(titleOf('## Sotto', 'f.md')).toBe('f.md')
})

test('inline code marks are dropped from the title', () => {
  expect(titleOf('# A02 · `api` separata da `web`', 'f.md')).toBe('A02 · api separata da web')
})
