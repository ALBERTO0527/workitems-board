import { expect, test } from 'vitest'
import { resolveLink } from '../src/repo/links.js'

const P = new Set(['alpha/PIANO-ALPHA.md', 'alpha/done/A03-tre.md', 'beta/README.md', 'legal docs/01-clausola.md'])
const B = 'https://gitlab.com/g/p/-/blob/main/'
const from = 'alpha/A01-uno.md'

test('relative .md link to another stream opens inside the board', () => {
  expect(resolveLink(from, '../beta/README.md', P, B)).toEqual({ kind: 'internal', path: 'beta/README.md' })
})

test('link to an item moved to done/ is found there', () => {
  expect(resolveLink(from, 'A03-tre.md', P, B)).toEqual({ kind: 'internal', path: 'alpha/done/A03-tre.md' })
})

test('anchors are dropped and encoded names decoded', () => {
  expect(resolveLink(from, 'PIANO-ALPHA.md#2-cosa', P, B)).toEqual({ kind: 'internal', path: 'alpha/PIANO-ALPHA.md' })
  expect(resolveLink(from, '../legal%20docs/01-clausola.md', P, B)).toEqual({ kind: 'internal', path: 'legal docs/01-clausola.md' })
  expect(resolveLink('alpha/done/A03-tre.md', '../PIANO-ALPHA.md', P, B)).toEqual({ kind: 'internal', path: 'alpha/PIANO-ALPHA.md' })
})

test('absolute, missing and non-markdown links go to the web', () => {
  expect(resolveLink(from, 'https://x.org', P, B)).toEqual({ kind: 'external', href: 'https://x.org' })
  expect(resolveLink(from, 'mailto:a@b.it', P, B)).toEqual({ kind: 'external', href: 'mailto:a@b.it' })
  expect(resolveLink(from, 'manca.md', P, B)).toEqual({ kind: 'external', href: B + 'alpha/manca.md' })
  expect(resolveLink(from, 'img.png', P, B)).toEqual({ kind: 'external', href: B + 'alpha/img.png' })
})

test('a malformed escape does not throw', () => {
  expect(resolveLink(from, 'caf%E9.md', P, B)).toEqual({ kind: 'external', href: B + 'alpha/caf%E9.md' })
})
