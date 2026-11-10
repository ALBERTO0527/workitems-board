import { expect, test } from 'vitest'
import { collide, dropIndex } from '../src/ui/dnd.js'

// Colonne todo e doing abilitate; Chiusi (x 600-800) è disabilitata quindi assente.
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height })
const rects = new Map([
  ['todo', rect(0, 0, 200, 600)], ['doing', rect(300, 0, 200, 600)],
  ['a', rect(10, 40, 180, 50)], ['b', rect(10, 100, 180, 50)],
])
const args = (x, y) => ({
  droppableContainers: [...rects.keys()].map(id => ({ id })),
  droppableRects: rects,
  pointerCoordinates: { x, y },
  collisionRect: rect(x - 90, y - 25, 180, 50),
})
const ids = hits => hits.map(h => h.id)

test('the card under the pointer wins over its column', () => {
  expect(ids(collide(args(50, 60)))).toEqual(['a'])
})

test('an empty column under the pointer is a target', () => {
  expect(ids(collide(args(400, 300)))).toEqual(['doing'])
})

test('outside every enabled droppable there is no target', () => {
  expect(collide(args(700, 100))).toEqual([])
  expect(collide(args(250, 100))).toEqual([])
})

test('dropIndex counts the cards whose centre is above the pointer', () => {
  expect(dropIndex([65, 125, 185], 150)).toBe(2)
  expect(dropIndex([65, 125, 185], 10)).toBe(0)
  expect(dropIndex([65, 125, 185], 999)).toBe(3)
  expect(dropIndex([], 50)).toBe(0)
})
