const STATI = ['da-fare', 'in-corso']
const FOOTER = 'File gestito da workitems-board. Modificalo dalla board.'

// Legge il frontmatter di kanban.md. Qualunque cosa non valida diventa il valore di default.
export function parseKanban(text) {
  const k = { stato: 'da-fare', assegnato: null, ordine: null }
  const m = /^---\n([\s\S]*?)\n?---/.exec((text ?? '').replace(/^﻿/, '').replace(/\r\n/g, '\n'))
  if (!m) return k
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).replace(/#.*/, '').trim()
    if (key === 'stato' && STATI.includes(value)) k.stato = value
    if (key === 'assegnato' && value) k.assegnato = value
    if (key === 'ordine' && value && Number.isFinite(Number(value))) k.ordine = Number(value)
  }
  return k
}

export function serializeKanban({ stato, assegnato, ordine }) {
  const field = (key, value) => `${key}:${value == null || value === '' ? '' : ' ' + value}\n`
  return `---\nstato: ${stato}\n${field('assegnato', assegnato)}${field('ordine', ordine)}---\n${FOOTER}\n`
}

export function columnOf(stream, kanban) {
  if (stream.items.length && stream.items.every(i => i.done)) return 'done'
  return kanban.stato === 'in-corso' ? 'doing' : 'todo'
}

export function sortColumn(entries) {
  return [...entries].sort((a, b) => {
    const x = a.kanban.ordine, y = b.kanban.ordine
    if (x != null && y != null) return x - y
    if (x != null) return -1
    if (y != null) return 1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
}
