import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConflictError, createClient } from '../gitlab/api.js'
import { getToken } from '../gitlab/auth.js'
import { columnOf, parseKanban, serializeKanban } from '../repo/kanban.js'
import { buildStreams } from '../repo/streams.js'

export function useRepo(projectPath) {
  const client = useMemo(() => createClient({ getToken }), [])
  const [state, setState] = useState({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [user, setUser] = useState(null)
  const files = useRef(new Map())

  const reload = useCallback(async () => {
    try {
      const project = await client.getProject(projectPath)
      const ref = project.default_branch
      if (!ref) throw new Error('Il progetto è vuoto')
      const [paths, members] = await Promise.all([client.listTree(project.id, ref), client.getMembers(project.id)])
      const streams = await Promise.all(buildStreams(paths).map(async s => {
        const file = s.kanbanPath ? await client.getFile(project.id, s.kanbanPath, ref) : null
        const kanban = parseKanban(file?.content ?? null)
        return { ...s, kanban, lastCommitId: file?.lastCommitId ?? null, column: columnOf(s, kanban) }
      }))
      setState({ status: 'ready', project, paths: new Set(paths), streams, members })
    } catch (e) {
      const error = /^404/.test(e.message) ? 'Progetto non trovato, oppure non hai accesso.' : e.message
      setState({ status: 'error', error })
    }
  }, [client, projectPath])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    reload()
  }, [reload])
  useEffect(retry, [retry])
  useEffect(() => { client.getUser().then(setUser, () => {}) }, [client])

  // changes: [{ name, kanban }] → un solo commit. Aggiorna subito la vista, poi rilegge il repo.
  async function save(changes, message) {
    const { project, streams } = state
    const actions = changes.map(({ name, kanban }) => {
      const s = streams.find(x => x.name === name)
      const content = serializeKanban(kanban)
      return s.kanbanPath
        ? { action: 'update', file_path: s.kanbanPath, content, last_commit_id: s.lastCommitId }
        : { action: 'create', file_path: `${name}/kanban.md`, content }
    })
    setState(st => ({
      ...st,
      streams: st.streams.map(s => {
        const c = changes.find(x => x.name === s.name)
        return c ? { ...s, kanban: c.kanban, column: columnOf(s, c.kanban) } : s
      }),
    }))
    setBusy(true)
    try {
      await client.commit(project.id, project.default_branch, message, actions)
    } catch (e) {
      throw e instanceof ConflictError ? new Error('Qualcuno ha modificato la board, riprova') : e
    } finally {
      await reload()
      setBusy(false)
    }
  }

  // .md letti dalla pagina stream: la board scrive solo kanban.md, quindi restano validi fino ad "Aggiorna"
  function readFile(path) {
    if (!files.current.has(path)) {
      const { id, default_branch } = state.project
      files.current.set(path, client.getFile(id, path, default_branch).then(f => f.content)
        .catch(e => { files.current.delete(path); throw e }))
    }
    return files.current.get(path)
  }

  function refresh() {
    files.current.clear()
    return reload()
  }

  function assign(stream, username) {
    const message = username ? `board: ${stream.name} assegnato a ${username}` : `board: ${stream.name} non assegnato`
    return save([{ name: stream.name, kanban: { ...stream.kanban, assegnato: username || null } }], message)
  }

  // Token non più valido → schermata di login (via App); altri errori → messaggio locale.
  function report(e, setLocalError) {
    if (e.message === 'login') setState({ status: 'error', error: 'login' })
    else setLocalError(e.message)
  }

  return { ...state, busy, user, client, reload, refresh, retry, readFile, save, assign, report }
}
