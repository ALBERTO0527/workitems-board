import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../gitlab/api.js'
import { completeLogin, getToken, logout, startLogin } from '../gitlab/auth.js'
import Board from './Board.jsx'
import { parseRoute, projectFromInput, routeTo } from './route.js'
import StreamPage from './StreamPage.jsx'
import { useRepo } from './useRepo.js'

const PROJECT_KEY = 'wib.project'

export default function App() {
  const [auth, setAuth] = useState('checking')
  const [route, setRoute] = useState(() => parseRoute(location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    completeLogin(new URL(location.href))
      .catch(() => false)
      .then(() => setRoute(parseRoute(location.hash)))
      .then(() => getToken())
      .then(() => setAuth('in'), () => setAuth('out'))
  }, [])

  useEffect(() => {
    if (auth !== 'in') return // prima il login, che può riportare alla pagina di partenza
    const saved = localStorage.getItem(PROJECT_KEY)
    if (!route.project && saved) location.hash = routeTo(saved)
    if (route.project) localStorage.setItem(PROJECT_KEY, route.project)
  }, [auth, route.project])

  if (auth === 'checking') return null
  if (auth === 'out') return <Login />
  if (!route.project) return <ProjectPicker onLoggedOut={() => setAuth('out')} />
  return <Repo key={route.project} route={route} onLoggedOut={() => setAuth('out')} />
}

function Repo({ route, onLoggedOut }) {
  const repo = useRepo(route.project)
  const signOut = () => { logout(); onLoggedOut() }
  useEffect(() => { if (repo.error === 'login') signOut() })

  if (repo.status === 'loading') return <p className="center">Carico {route.project}…</p>
  if (repo.status === 'error') return <ProjectPicker error={repo.error} initial={route.project} onRetry={repo.retry} onLoggedOut={onLoggedOut} />
  const stream = route.stream && repo.streams.find(s => s.name === route.stream)
  return stream
    ? <StreamPage repo={repo} stream={stream} projectPath={route.project} file={route.file} />
    : <Board repo={repo} projectPath={route.project} onSignOut={signOut} />
}

function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="logo">
      <rect x="2" y="3" width="6" height="18" rx="1.5" opacity=".25" />
      <rect x="9" y="3" width="6" height="18" rx="1.5" opacity=".25" />
      <rect x="16" y="3" width="6" height="18" rx="1.5" opacity=".25" />
      <rect x="3" y="5" width="4" height="4" rx="1" />
      <rect x="3" y="10" width="4" height="4" rx="1" />
      <rect x="10" y="5" width="4" height="4" rx="1" />
      <rect x="17" y="5" width="4" height="4" rx="1" opacity=".6" />
    </svg>
  )
}

function Login() {
  return (
    <main className="login">
      <div className="login-card">
        <Logo size={40} />
        <h1>workitems-board</h1>
        <p className="lead">La kanban dei work item che tenete come file <code>.md</code> nel vostro repo GitLab.</p>
        <ul className="points">
          <li>Gli item restano file nel repo: la board li legge e basta.</li>
          <li>Spostare o assegnare uno stream è un commit su <code>kanban.md</code>.</li>
          <li>Nessun server: la pagina parla solo con GitLab.com.</li>
        </ul>
        <button className="primary" onClick={startLogin}>Accedi con GitLab</button>
        <p className="fine">
          GitLab ti chiederà il permesso <code>api</code>, l'unico che consente i commit. Il token resta nel tuo
          browser. <a href="https://github.com/ALBERTO0527/workitems-board" target="_blank" rel="noreferrer">Codice sorgente</a>
        </p>
      </div>
    </main>
  )
}

const rtf = new Intl.RelativeTimeFormat('it', { numeric: 'auto' })
function ago(iso) {
  const days = Math.round((new Date(iso) - Date.now()) / 864e5)
  if (days > -30) return rtf.format(days, 'day')
  if (days > -365) return rtf.format(Math.round(days / 30), 'month')
  return rtf.format(Math.round(days / 365), 'year')
}

function ProjectPicker({ error, initial = '', onRetry, onLoggedOut }) {
  const client = useMemo(() => createClient({ getToken }), [])
  const [query, setQuery] = useState(initial)
  const [found, setFound] = useState(null) // null = sto caricando
  const [user, setUser] = useState(null)
  const typed = projectFromInput(query) // percorso o URL incollato
  const signOut = () => { logout(); onLoggedOut() }

  useEffect(() => { client.getUser().then(setUser, () => {}) }, [client])

  useEffect(() => {
    let alive = true
    setFound(null)
    const search = typed ? typed.split('/').pop() : query.trim()
    const timer = setTimeout(() => client.listProjects(search).then(
      list => alive && setFound(list),
      e => { if (!alive) return; if (e.message === 'login') signOut(); else setFound([]) },
    ), query ? 250 : 0)
    return () => { alive = false; clearTimeout(timer) }
  }, [client, query])

  function open(path) {
    // stesso progetto dell'errore: l'hash non cambia, quindi riprova a mano
    if (path === parseRoute(location.hash).project) onRetry?.()
    else location.hash = routeTo(path)
  }

  const showTyped = typed && !found?.some(p => p.path === typed)
  return (
    <div>
      <header>
        <Logo />
        <strong>workitems-board</strong>
        <span className="spacer" />
        {user && <span className="muted">@{user.username}</span>}
        <button onClick={signOut}>Esci</button>
      </header>
      <main className="picker">
        <h1>Scegli il progetto</h1>
        <p className="muted">Il repo GitLab dove tenete i work item.</p>
        {error && <p className="error">{error}</p>}
        <form onSubmit={e => { e.preventDefault(); const first = typed ?? found?.[0]?.path; if (first) open(first) }}>
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)} autoFocus
            placeholder="Cerca tra i tuoi progetti, oppure incolla l'URL" aria-label="Cerca progetto"
          />
        </form>
        <ul className="projects">
          {showTyped && (
            <li><button onClick={() => open(typed)}><span className="path"><b>{typed}</b></span><span className="when">Apri</span></button></li>
          )}
          {found === null && <li className="note">Carico…</li>}
          {found?.length === 0 && !showTyped && <li className="note">Nessun progetto trovato.</li>}
          {found?.map(p => (
            <li key={p.path}>
              <button onClick={() => open(p.path)}>
                <span className="path"><span className="muted">{p.namespace} / </span><b>{p.name}</b></span>
                <span className="when muted">{ago(p.activity)}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
