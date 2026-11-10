// Link in un markdown del repo → file da aprire nella board, oppure indirizzo esterno.
export function resolveLink(fromPath, href, paths, blobBase) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { kind: 'external', href }
  const raw = new URL(href, 'http://repo/' + fromPath).pathname.slice(1)
  let path = raw
  try { path = decodeURIComponent(raw) } catch { /* escape non valido: resta com'è */ }
  if (path.endsWith('.md')) {
    if (paths.has(path)) return { kind: 'internal', path }
    const i = path.lastIndexOf('/')
    const inDone = path.slice(0, i + 1) + 'done/' + path.slice(i + 1)
    if (paths.has(inDone)) return { kind: 'internal', path: inDone }
  }
  return { kind: 'external', href: blobBase + path }
}
