import { expect, test } from 'vitest'
import { columnOf, parseKanban, serializeKanban, sortColumn } from '../src/repo/kanban.js'

const EMPTY = { stato: 'da-fare', assegnato: null, ordine: null }

test('missing kanban.md means da-fare, unassigned, no order', () => {
  expect(parseKanban(null)).toEqual(EMPTY)
})

test('reads the three frontmatter fields', () => {
  expect(parseKanban('---\nstato: in-corso\nassegnato: albertotonni\nordine: 1500\n---\nx'))
    .toEqual({ stato: 'in-corso', assegnato: 'albertotonni', ordine: 1500 })
})

test('malformed kanban.md falls back to defaults', () => {
  expect(parseKanban('ciao')).toEqual(EMPTY)
  expect(parseKanban('---\nstato: boh\nordine: abc\n---')).toEqual(EMPTY)
  expect(parseKanban('---\nstato: in-corso # commento\nassegnato:\n---')).toEqual({ ...EMPTY, stato: 'in-corso' })
})

test('serialize writes the exact format and round-trips', () => {
  expect(serializeKanban({ stato: 'da-fare', assegnato: null, ordine: 1000 }))
    .toBe('---\nstato: da-fare\nassegnato:\nordine: 1000\n---\nFile gestito da workitems-board. Modificalo dalla board.\n')
  const k = { stato: 'in-corso', assegnato: 'mario', ordine: 2500.5 }
  expect(parseKanban(serializeKanban(k))).toEqual(k)
})

const st = items => ({ name: 's', items, docs: [], kanbanPath: null })
const open = { done: false }, closed = { done: true }

test('column: all items done is Chiusi, whatever kanban.md says', () => {
  expect(columnOf(st([closed, closed]), { stato: 'in-corso' })).toBe('done')
  expect(columnOf(st([closed]), { stato: 'da-fare' })).toBe('done')
})

test('column: otherwise follows kanban.md stato', () => {
  expect(columnOf(st([]), { stato: 'in-corso' })).toBe('doing')
  expect(columnOf(st([open, closed]), { stato: 'in-corso' })).toBe('doing')
  expect(columnOf(st([open]), { stato: 'da-fare' })).toBe('todo')
  expect(columnOf(st([]), EMPTY)).toBe('todo')
})

test('sortColumn: by ordine, then streams without ordine alphabetically', () => {
  expect(sortColumn([
    { name: 'z', kanban: { ordine: null } }, { name: 'b', kanban: { ordine: 2000 } },
    { name: 'a', kanban: { ordine: null } }, { name: 'c', kanban: { ordine: 1000 } },
  ]).map(e => e.name)).toEqual(['c', 'b', 'a', 'z'])
})

test('serialize leaves ordine empty when the stream has none', () => {
  const text = serializeKanban({ stato: 'da-fare', assegnato: 'mario', ordine: null })
  expect(text).toContain('\nordine:\n')
  expect(parseKanban(text)).toEqual({ stato: 'da-fare', assegnato: 'mario', ordine: null })
})

test('Windows line endings and BOM are read like normal files', () => {
  expect(parseKanban('﻿---\r\nstato: in-corso\r\nassegnato: mario\r\nordine: 10\r\n---\r\n'))
    .toEqual({ stato: 'in-corso', assegnato: 'mario', ordine: 10 })
})
