import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveLink } from '../repo/links.js'
import { Assignee } from './Board.jsx'
import { routeTo } from './route.js'

const COLUMN_LABEL = { todo: 'Da fare', doing: 'In corso', done: 'Chiuso' }

export function titleOf(markdown, fallback) {
  return /^# +(.+)$/m.exec(markdown)?.[1].replace(/`/g, '').trim() ?? fallback
}

export default function StreamPage({ repo, stream, projectPath, file }) {
  const { project, paths } = repo
  const ref = project.default_branch
  const blobBase = `${project.web_url}/-/blob/${ref}/`
  const [titles, setTitles] = useState({})
  const [doc, setDoc] = useState({ path: null, text: null })
  const [error, setError] = useState(null)
  const [showDone, setShowDone] = useState(false)

  const selected = file && paths.has(file) ? file
    : stream.docs.find(d => /\/PIANO-.*\.md$/.test(d)) ?? stream.docs.find(d => d.endsWith('/README.md')) ?? stream.items[0]?.path ?? null

  const itemPaths = stream.items.map(i => i.path).join('\n') // stabile tra un reload e l'altro
  useEffect(() => {
    let alive = true
    Promise.all(stream.items.map(async i => [i.path, titleOf(await repo.readFile(i.path), i.file)]))
      .then(entries => alive && setTitles(Object.fromEntries(entries)))
      .catch(e => alive && repo.report(e, setError))
    return () => { alive = false }
  }, [itemPaths])

  useEffect(() => {
    if (!selected?.endsWith('.md')) return
    let alive = true
    setError(null)
    repo.readFile(selected)
      .then(text => alive && setDoc({ path: selected, text }))
      .catch(e => alive && repo.report(e, setError))
    return () => { alive = false }
  }, [selected])

  const linkTo = path => routeTo(projectPath, path.split('/')[0], path)
  const openItems = stream.items.filter(i => !i.done)
  const closedItems = stream.items.filter(i => i.done)
  const itemLink = i => (
    <a key={i.path} href={linkTo(i.path)} className={(i.path === selected ? 'selected ' : '') + (i.done ? 'done' : '')}>
      {titles[i.path] ?? i.file}
    </a>
  )

  return (
    <div>
      <header>
        <a href={routeTo(projectPath)}>← board</a>
        <strong>{stream.name}</strong>
        <span>{COLUMN_LABEL[stream.column]}</span>
        <Assignee stream={stream} repo={repo} onError={setError} />
      </header>
      {error && <p className="error" onClick={() => setError(null)}>{error} ✕</p>}
      <div className="stream">
        <nav>
          <h3>Item aperti ({openItems.length})</h3>
          {openItems.map(itemLink)}
          {closedItems.length > 0 && (
            <h3><button onClick={() => setShowDone(!showDone)}>{showDone ? '▾' : '▸'} Chiusi ({closedItems.length})</button></h3>
          )}
          {showDone && closedItems.map(itemLink)}
          <h3>Documenti</h3>
          {stream.docs.map(d => d.endsWith('.md')
            ? <a key={d} href={linkTo(d)} className={d === selected ? 'selected' : ''}>{d.split('/').pop()}</a>
            : <a key={d} href={blobBase + d} target="_blank" rel="noreferrer">{d.split('/').pop()} ↗</a>)}
        </nav>
        <article className="doc">
          {!selected && <p>Nessun documento.</p>}
          {selected && doc.path !== selected && <p>Carico…</p>}
          {selected && doc.path === selected && (
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href = '', children }) => {
                  if (href.startsWith('#')) return <a href={linkTo(selected)}>{children}</a>
                  const link = resolveLink(selected, href, paths, blobBase)
                  return link.kind === 'internal'
                    ? <a href={linkTo(link.path)}>{children}</a>
                    : <a href={link.href} target="_blank" rel="noreferrer">{children}</a>
                },
                // ponytail: immagini dei repo privati richiedono auth, per ora solo un link a GitLab
                img: ({ src = '', alt }) => (
                  <a href={resolveLink(selected, src, new Set(), blobBase).href} target="_blank" rel="noreferrer">🖼 {alt || src}</a>
                ),
              }}
            >
              {doc.text}
            </Markdown>
          )}
        </article>
      </div>
    </div>
  )
}
