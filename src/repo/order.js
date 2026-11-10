import { sortColumn } from './kanban.js'

const STEP = 1000
const LABEL = { todo: 'Da fare', doing: 'In corso' }

// Rilascio di uno stream in una colonna (todo | doing) alla posizione index → kanban.md da scrivere, o null se non cambia niente.
export function dropChanges(streams, name, toColumn, index) {
  const moved = streams.find(s => s.name === name)
  const dest = sortColumn(streams.filter(s => s.column === toColumn && s.name !== name))
  if (moved.column === toColumn) {
    const before = sortColumn(streams.filter(s => s.column === toColumn)).map(s => s.name)
    const after = dest.map(s => s.name).toSpliced(index, 0, name)
    if (before.join('\n') === after.join('\n')) return null
  }
  const plan = planMove(dest.map(s => ({ name: s.name, ordine: s.kanban.ordine })), index)
  const stato = toColumn === 'doing' ? 'in-corso' : 'da-fare'
  const changes = plan.map(p => p.name === '*'
    ? { name, kanban: { ...moved.kanban, stato, ordine: p.ordine } }
    : { name: p.name, kanban: { ...dest.find(s => s.name === p.name).kanban, ordine: p.ordine } })
  const message = moved.column === toColumn ? `board: ${name} riordinato` : `board: ${name} → ${LABEL[toColumn]}`
  return { changes, message }
}

// column: colonna di destinazione ordinata (sortColumn), senza lo stream spostato.
// Ritorna gli `ordine` da scrivere; lo stream spostato ha nome '*'.
export function planMove(column, index) {
  const k = column.filter(s => s.ordine != null).length
  if (index > k) {
    const base = column[k - 1]?.ordine ?? 0
    const names = [...column.slice(k, index).map(s => s.name), '*']
    return names.map((name, i) => ({ name, ordine: base + (i + 1) * STEP }))
  }
  const prev = column[index - 1]?.ordine
  const next = column[index]?.ordine
  if (prev == null && next == null) return [{ name: '*', ordine: STEP }]
  if (prev == null) return [{ name: '*', ordine: next - STEP }]
  if (next == null) return [{ name: '*', ordine: prev + STEP }]
  if (next - prev >= 1e-6) return [{ name: '*', ordine: (prev + next) / 2 }]
  const order = [...column.slice(0, index), { name: '*' }, ...column.slice(index, k)]
  return order.map((s, i) => ({ name: s.name, ordine: (i + 1) * STEP }))
}
