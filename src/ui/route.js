// '#/<progetto>', '#/<progetto>/-/<stream>', '…?f=<file>'. Il '-' separa perché il progetto può avere sottogruppi.
export function parseRoute(hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  if (!path) return { project: null, stream: null, file: null }
  const [project, stream] = path.split('/-/')
  return {
    project: decodeURIComponent(project),
    stream: stream ? decodeURIComponent(stream) : null,
    file: new URLSearchParams(query).get('f'),
  }
}

export function routeTo(project, stream, file) {
  return '#/' + project + (stream ? '/-/' + encodeURIComponent(stream) : '') + (file ? '?f=' + encodeURIComponent(file) : '')
}

// 'g/p', 'https://gitlab.com/g/p', '…/g/p.git', '…/g/p/-/tree/main' → 'g/p'
export function projectFromInput(input) {
  const path = input.trim().replace(/^https?:\/\/[^/]+\//, '').split('/-/')[0].replace(/\.git$/, '').replace(/\/+$/, '')
  return path.includes('/') ? path : null
}
