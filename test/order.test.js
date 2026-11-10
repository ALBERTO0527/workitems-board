import { expect, test } from 'vitest'
import { dropChanges, planMove } from '../src/repo/order.js'

const col = [{ name: 'a', ordine: 1000 }, { name: 'b', ordine: 2000 }, { name: 'c', ordine: null }, { name: 'd', ordine: null }]

test('dropping between two ordered streams writes only the moved one', () => {
  expect(planMove(col, 1)).toEqual([{ name: '*', ordine: 1500 }])
  expect(planMove(col, 0)).toEqual([{ name: '*', ordine: 0 }])
  expect(planMove(col, 2)).toEqual([{ name: '*', ordine: 3000 }])
})

test('dropping among streams without ordine also orders the ones above', () => {
  expect(planMove(col, 3)).toEqual([{ name: 'c', ordine: 3000 }, { name: '*', ordine: 4000 }])
  expect(planMove([{ name: 'x', ordine: null }], 1)).toEqual([{ name: 'x', ordine: 1000 }, { name: '*', ordine: 2000 }])
})

test('empty column', () => {
  expect(planMove([], 0)).toEqual([{ name: '*', ordine: 1000 }])
})

test('neighbours too close renumber the column', () => {
  const tight = [{ name: 'a', ordine: 1 }, { name: 'b', ordine: 1 + 1e-7 }]
  expect(planMove(tight, 1)).toEqual([{ name: 'a', ordine: 1000 }, { name: '*', ordine: 2000 }, { name: 'b', ordine: 3000 }])
})

const S = (name, column, ordine = null, stato = column === 'doing' ? 'in-corso' : 'da-fare') =>
  ({ name, column, kanban: { stato, assegnato: 'x', ordine } })

test('dropChanges: moving to In corso sets stato, ordine and message', () => {
  const streams = [S('a', 'todo'), S('b', 'doing', 1000), S('c', 'doing', 2000), S('z', 'done', 5)]
  expect(dropChanges(streams, 'a', 'doing', 1)).toEqual({
    changes: [{ name: 'a', kanban: { stato: 'in-corso', assegnato: 'x', ordine: 1500 } }],
    message: 'board: a → In corso',
  })
})

test('dropChanges: reorder in the same column keeps stato and may order others', () => {
  const streams = [S('a', 'todo'), S('b', 'todo'), S('c', 'todo')]
  expect(dropChanges(streams, 'c', 'todo', 1)).toEqual({
    changes: [
      { name: 'a', kanban: { stato: 'da-fare', assegnato: 'x', ordine: 1000 } },
      { name: 'c', kanban: { stato: 'da-fare', assegnato: 'x', ordine: 2000 } },
    ],
    message: 'board: c riordinato',
  })
})

test('dropChanges: back to Da fare', () => {
  expect(dropChanges([S('b', 'doing', 1000)], 'b', 'todo', 0).message).toBe('board: b → Da fare')
})

test('dropChanges: a drop that leaves the order unchanged commits nothing', () => {
  expect(dropChanges([S('a', 'todo'), S('b', 'todo'), S('c', 'todo')], 'c', 'todo', 2)).toBe(null)
  expect(dropChanges([S('a', 'doing', 1000), S('d', 'doing', 4000)], 'd', 'doing', 1)).toBe(null)
})
