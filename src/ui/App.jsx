import { useEffect, useState } from 'react'
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
  if (!route.project) return <ProjectPicker />
  return <Repo key={route.project} route={route} onLoggedOut={() => setAuth('out')} />
}

function Repo({ route, onLoggedOut }) {
  const repo = useRepo(route.project)
  const signOut = () => { logout(); onLoggedOut() }
  useEffect(() => { if (repo.error === 'login') signOut() })

  if (repo.status === 'loading') return <p className="center">Carico {route.project}…</p>
  if (repo.status === 'error') return <ProjectPicker error={repo.error} initial={route.project} onRetry={repo.retry} />
  const stream = route.stream && repo.streams.find(s => s.name === route.stream)
  return stream
    ? <StreamPage repo={repo} stream={stream} projectPath={route.project} file={route.file} />
    : <Board repo={repo} projectPath={route.project} onSignOut={signOut} />
}

function Login() {
  return (
    <div className="center">
      <h1>workitems-board</h1>
      <p>Kanban dei work item del tuo repo GitLab.</p>
      <button onClick={startLogin}>Accedi con GitLab</button>
    </div>
  )
}

function ProjectPicker({ error, initial = '', onRetry }) {
  const [value, setValue] = useState(initial)
  const project = projectFromInput(value)
  return (
    <form className="center" onSubmit={e => {
      e.preventDefault()
      if (!project) return
      // stesso progetto dell'errore: l'hash non cambia, quindi riprova a mano
      if (project === parseRoute(location.hash).project) onRetry?.()
      else location.hash = routeTo(project)
    }}>
      <h1>workitems-board</h1>
      {error && <p className="error">{error}</p>}
      <label>
        Progetto GitLab con i work item
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="gruppo/progetto oppure URL" autoFocus />
      </label>
      <button disabled={!project}>Apri</button>
    </form>
  )
}
