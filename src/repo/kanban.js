const STATI = ['da-fare', 'in-corso']
const FOOTER = 'File gestito da workitems-board. Modificalo dalla board.'

// Legge il frontmatter di kanban.md. Qualunque cosa non valida diventa il valore di default.
// Righe e testo che la board non conosce finiscono in `altri` e `note`, per riscriverli uguali.
export function parseKanban(text) {
  const k = { stato: 'da-fare', assegnato: null, ordine: null }
  const clean = (text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const m = /^---\n([\s\S]*?)\n?---\n?/.exec(clean)
  if (!m) return k
  const altri = []
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    const key = i < 0 ? null : line.slice(0, i).trim()
    const value = i < 0 ? '' : line.slice(i + 1).replace(/#.*/, '').trim()
    if (key === 'stato') { if (STATI.includes(value)) k.stato = value }
    else if (key === 'assegnato') { if (value) k.assegnato = value }
    else if (key === 'ordine') { if (value && Number.isFinite(Number(value))) k.ordine = Number(value) }
    else if (line.trim()) altri.push(line)
  }
  const note = clean.slice(m[0].length)
  if (altri.length) k.altri = altri
  if (note.trim() && note.trim() !== FOOTER) k.note = note.endsWith('\n') ? note : note + '\n'
  return k
}

export function serializeKanban({ stato, assegnato, ordine, altri = [], note = FOOTER + '\n' }) {
  const field = (key, value) => `${key}:${value == null || value === '' ? '' : ' ' + value}\n`
  const extra = altri.map(l => l + '\n').join('')
  return `---\nstato: ${stato}\n${field('assegnato', assegnato)}${field('ordine', ordine)}${extra}---\n${note}`
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
