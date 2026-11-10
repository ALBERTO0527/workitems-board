export const ITEM_RE = /^[A-Z]\d{2,}-.+\.md$/

const STREAM_DOC_RE = /^(PIANO-.*|README)\.md$/

// Albero del repo (path dei file) → stream, secondo le regole della spec.
export function buildStreams(paths) {
  const folders = new Map()
  for (const path of paths) {
    const parts = path.split('/')
    if (parts.length < 2) continue
    const [name, ...rest] = parts
    if (!folders.has(name)) folders.set(name, { name, items: [], docs: [], kanbanPath: null })
    const s = folders.get(name)
    const file = rest[rest.length - 1]
    if (rest.length === 1) {
      if (file === 'kanban.md') s.kanbanPath = path
      else if (ITEM_RE.test(file)) s.items.push(item(path, file, false))
      else s.docs.push(path)
    } else if (rest.length === 2 && rest[0] === 'done' && ITEM_RE.test(file)) {
      s.items.push(item(path, file, true))
    }
  }
  return [...folders.values()]
    .filter(s => s.items.length || s.docs.some(d => STREAM_DOC_RE.test(d.split('/')[1])))
    .map(s => ({
      ...s,
      items: s.items.sort((a, b) => a.done - b.done || cmp(a.file, b.file)),
      docs: s.docs.sort(cmp),
    }))
    .sort((a, b) => cmp(a.name, b.name))
}

function item(path, file, done) {
  return { path, file, code: file.split('-')[0], done }
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}
