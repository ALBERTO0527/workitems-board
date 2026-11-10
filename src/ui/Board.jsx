import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { sortColumn } from '../repo/kanban.js'
import { dropChanges } from '../repo/order.js'
import { collide, dropIndex } from './dnd.js'
import { routeTo } from './route.js'

const COLUMNS = [['todo', 'Da fare'], ['doing', 'In corso'], ['done', 'Chiusi']]

export default function Board({ repo, projectPath, onSignOut }) {
  const [error, setError] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const columns = Object.fromEntries(COLUMNS.map(([id]) => [id, sortColumn(repo.streams.filter(s => s.column === id))]))

  const run = promise => { setError(null); return promise.catch(e => repo.report(e, setError)) }

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const moved = repo.streams.find(s => s.name === active.id)
    const target = repo.streams.find(s => s.name === over.id)
    const toColumn = target ? target.column : over.id
    if (toColumn === 'done') return
    // sopra una card: la sua posizione (stessa colonna) o prima di lei (altra colonna); sullo sfondo: in base all'altezza
    const index = target
      ? columns[toColumn].findIndex(s => s.name === target.name)
      : dropIndex(cardCenters(toColumn, moved.name), centerY(active.rect.current.translated))
    const drop = dropChanges(repo.streams, moved.name, toColumn, index)
    if (drop) run(repo.save(drop.changes, drop.message))
  }

  return (
    <div className="board">
      <header>
        <strong>{projectPath}</strong>
        <button onClick={() => run(repo.reload())} disabled={repo.busy}>Aggiorna</button>
        <a href="#/" onClick={() => localStorage.removeItem('wib.project')}>Cambia progetto</a>
        <span className="spacer" />
        {repo.user && <span title={repo.user.name}>@{repo.user.username}</span>}
        <button onClick={onSignOut}>Esci</button>
      </header>
      {error && <p className="error" onClick={() => setError(null)}>{error} ✕</p>}
      <DndContext sensors={sensors} collisionDetection={collide} onDragEnd={onDragEnd}>
        <div className={'columns' + (repo.busy ? ' busy' : '')}>
          {COLUMNS.map(([id, label]) => (
            <Column key={id} id={id} label={label} streams={columns[id]} sortable={id !== 'done'}>
              {columns[id].map(s => (
                <Card key={s.name} stream={s} repo={repo} projectPath={projectPath} sortable={id !== 'done'} onError={setError} />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>
    </div>
  )
}

const centerY = r => r.top + r.height / 2

function cardCenters(column, except) {
  return [...document.querySelectorAll(`[data-column="${column}"] [data-name]`)]
    .filter(el => el.dataset.name !== except)
    .map(el => centerY(el.getBoundingClientRect()))
}

function Column({ id, label, streams, sortable, children }) {
  const { setNodeRef } = useDroppable({ id, disabled: !sortable })
  return (
    <section className="column" ref={setNodeRef} data-column={id}>
      <h2>{label} <span>{streams.length}</span></h2>
      <SortableContext items={streams.map(s => s.name)} strategy={verticalListSortingStrategy} disabled={!sortable}>
        {children}
      </SortableContext>
    </section>
  )
}

function Card({ stream, repo, projectPath, sortable, onError }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stream.name, disabled: !sortable })
  const done = stream.items.filter(i => i.done).length
  const total = stream.items.length
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={'card' + (stream.column === 'done' ? ' closed' : '')}
      data-name={stream.name}
      onClick={() => { location.hash = routeTo(projectPath, stream.name) }}
      {...attributes}
      {...listeners}
    >
      <b>{stream.name}</b>
      {total ? <progress max={total} value={done} /> : null}
      <div className="meta">
        <span>{total ? `${done} / ${total}` : 'solo piano'}</span>
        <Assignee stream={stream} repo={repo} onError={onError} />
      </div>
    </article>
  )
}

export function Assignee({ stream, repo, onError }) {
  const members = repo.members.some(m => m.username === stream.kanban.assegnato) || !stream.kanban.assegnato
    ? repo.members
    : [...repo.members, { username: stream.kanban.assegnato, name: stream.kanban.assegnato }]
  return (
    <select
      value={stream.kanban.assegnato ?? ''}
      disabled={repo.busy}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onChange={e => { onError(null); repo.assign(stream, e.target.value).catch(err => repo.report(err, onError)) }}
    >
      <option value="">nessuno</option>
      {members.map(m => <option key={m.username} value={m.username}>{m.name}</option>)}
    </select>
  )
}
