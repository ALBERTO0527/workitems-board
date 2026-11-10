import { expect, test } from 'vitest'
import { buildStreams, ITEM_RE } from '../src/repo/streams.js'
import { TREE } from './fixtures/tree.js'

const byName = () => Object.fromEntries(buildStreams(TREE).map(s => [s.name, s]))

test('a stream is a top-level folder with items, a PIANO or a README', () => {
  expect(buildStreams(TREE).map(s => s.name)).toEqual(['alpha', 'beta', 'delta', 'epsilon', 'gamma'])
})

test('items are open at the stream root and closed in done/', () => {
  const s = byName()
  expect(s.alpha.items.map(i => [i.file, i.done])).toEqual([['A01-uno.md', false], ['A02-due.md', false], ['A03-tre.md', true]])
  expect(s.alpha.items[2]).toMatchObject({ path: 'alpha/done/A03-tre.md', code: 'A03' })
  expect(s.epsilon.items.map(i => i.done)).toEqual([false, true])
  expect(s.gamma.items).toEqual([])
})

test('one file is one item and subfolders other than done/ are ignored', () => {
  expect(byName().beta.items.map(i => i.file)).toEqual(['B01-bis-y.md', 'B01-x.md'])
})

test('docs are the other root files of the stream, kanban.md excluded', () => {
  const s = byName()
  expect(s.alpha.kanbanPath).toBe('alpha/kanban.md')
  expect(s.alpha.docs).toEqual(['alpha/PIANO-ALPHA.md'])
  expect(s.beta.kanbanPath).toBe(null)
  expect(s.beta.docs).toEqual(['beta/README.md', 'beta/notes.csv'])
})

test('item name pattern', () => {
  expect(ITEM_RE.test('W100-x.md')).toBe(true)
  expect(ITEM_RE.test('V03-risultati.md')).toBe(true)
  expect(ITEM_RE.test('01-clausola.md')).toBe(false)
  expect(ITEM_RE.test('PIANO-X.md')).toBe(false)
})
