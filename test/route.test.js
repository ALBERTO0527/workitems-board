import { expect, test } from 'vitest'
import { parseRoute, projectFromInput, routeTo } from '../src/ui/route.js'

test('board route', () => {
  expect(parseRoute('#/acme/workitems')).toEqual({ project: 'acme/workitems', stream: null, file: null })
})

test('stream route with subgroups and encoded names', () => {
  expect(parseRoute('#/g/sub/p/-/legal%20docs')).toEqual({ project: 'g/sub/p', stream: 'legal docs', file: null })
})

test('empty route', () => {
  expect(parseRoute('')).toEqual({ project: null, stream: null, file: null })
  expect(parseRoute('#/')).toEqual({ project: null, stream: null, file: null })
})

test('routeTo is the inverse of parseRoute', () => {
  expect(routeTo('g/sub/p', 'legal docs')).toBe('#/g/sub/p/-/legal%20docs')
  expect(routeTo('acme/workitems')).toBe('#/acme/workitems')
  expect(parseRoute(routeTo('g/p', 'a b'))).toEqual({ project: 'g/p', stream: 'a b', file: null })
})

test('projectFromInput accepts a path or a GitLab URL', () => {
  expect(projectFromInput('acme/workitems')).toBe('acme/workitems')
  expect(projectFromInput(' https://gitlab.com/acme/workitems/ ')).toBe('acme/workitems')
  expect(projectFromInput('https://gitlab.com/g/sub/p.git')).toBe('g/sub/p')
  expect(projectFromInput('https://gitlab.com/g/p/-/tree/main')).toBe('g/p')
  expect(projectFromInput('nope')).toBe(null)
})

test('selected file travels in the route', () => {
  expect(parseRoute('#/g/p/-/alpha?f=alpha%2FA01-uno.md')).toEqual({ project: 'g/p', stream: 'alpha', file: 'alpha/A01-uno.md' })
  expect(routeTo('g/p', 'alpha', 'alpha/A01-uno.md')).toBe('#/g/p/-/alpha?f=alpha%2FA01-uno.md')
})
