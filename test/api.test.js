import { expect, test } from 'vitest'
import { ConflictError, createClient } from '../src/gitlab/api.js'

// fetch finto: risponde in ordine con le risposte date e registra le chiamate
function fakeFetch(responses) {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url, init })
    const { status = 200, body, headers = {} } = responses.shift()
    return new Response(JSON.stringify(body), { status, headers })
  }
  return { fetch, calls }
}

const client = fetch => createClient({ getToken: async () => 'tok', fetch })
const blobs = (n, prefix) => Array.from({ length: n }, (_, i) => ({ type: 'blob', path: `${prefix}${i}.md` }))

test('listTree follows X-Next-Page and keeps only blobs', async () => {
  const { fetch, calls } = fakeFetch([
    { body: blobs(100, 'a/'), headers: { 'X-Next-Page': '2' } },
    { body: [...blobs(3, 'b/'), { type: 'tree', path: 'b' }, { type: 'tree', path: 'c' }], headers: { 'X-Next-Page': '' } },
  ])
  expect((await client(fetch).listTree(7, 'main')).length).toBe(103)
  expect(calls[1].url).toContain('recursive=true')
  expect(calls[1].url).toContain('page=2')
  expect(calls[0].init.headers.Authorization).toBe('Bearer tok')
})

test('paths are encoded in URLs', async () => {
  const { fetch, calls } = fakeFetch([
    { body: { content: btoa('ciao'), last_commit_id: 'abc' } },
    { body: { id: 7, default_branch: 'main', web_url: 'https://gitlab.com/acme/workitems' } },
  ])
  const c = client(fetch)
  expect(await c.getFile(7, 'legal docs/kanban.md', 'main')).toEqual({ content: 'ciao', lastCommitId: 'abc' })
  expect(calls[0].url).toContain('/projects/7/repository/files/legal%20docs%2Fkanban.md?ref=main')
  await c.getProject('acme/workitems')
  expect(calls[1].url).toContain('/projects/acme%2Fworkitems')
})

test('getFile decodes UTF-8 content', async () => {
  const utf8 = btoa(String.fromCharCode(...new TextEncoder().encode('perché → sì')))
  const { fetch } = fakeFetch([{ body: { content: utf8, last_commit_id: 'x' } }])
  expect((await client(fetch).getFile(7, 'a.md', 'main')).content).toBe('perché → sì')
})

test('getMembers keeps Developer and above', async () => {
  const { fetch } = fakeFetch([{ body: [
    { username: 'g', name: 'Mario', access_level: 50 },
    { username: 'r', name: 'Reporter', access_level: 20 },
    { username: 'a', name: 'Anna', access_level: 30 },
  ], headers: { 'X-Next-Page': '' } }])
  expect(await client(fetch).getMembers(7)).toEqual([{ username: 'g', name: 'Mario' }, { username: 'a', name: 'Anna' }])
})

test('commit sends one request with all actions', async () => {
  const { fetch, calls } = fakeFetch([{ status: 201, body: {} }])
  const actions = [{ action: 'update', file_path: 'a/kanban.md', content: 'x', last_commit_id: 'abc' }]
  await client(fetch).commit(7, 'main', 'board: a → In corso', actions)
  expect(calls[0].init.method).toBe('POST')
  expect(JSON.parse(calls[0].init.body)).toEqual({ branch: 'main', commit_message: 'board: a → In corso', actions })
})

test('commit on a file changed meanwhile is a ConflictError', async () => {
  const { fetch } = fakeFetch([{ status: 400, body: { message: 'You are attempting to update a file that has changed since you started editing it.' } }])
  await expect(client(fetch).commit(7, 'main', 'm', [])).rejects.toBeInstanceOf(ConflictError)
  const again = fakeFetch([{ status: 400, body: { message: 'A file with this name already exists' } }])
  await expect(client(again.fetch).commit(7, 'main', 'm', [])).rejects.toBeInstanceOf(ConflictError)
})

test('other errors carry the GitLab message', async () => {
  const { fetch } = fakeFetch([{ status: 403, body: { message: '403 Forbidden' } }])
  const err = await client(fetch).commit(7, 'main', 'm', []).catch(e => e)
  expect(err).not.toBeInstanceOf(ConflictError)
  expect(err.message).toBe('403 Forbidden')
})

test('401 means the token is no longer valid: ask for login', async () => {
  const { fetch } = fakeFetch([{ status: 401, body: { message: '401 Unauthorized' } }])
  await expect(client(fetch).getUser()).rejects.toThrow('login')
})

test('listProjects returns my most recently active projects, optionally searched', async () => {
  const project = { path_with_namespace: 'acme/workitems', name: 'workitems', namespace: { full_path: 'acme' }, last_activity_at: '2026-11-09T10:00:00Z', extra: 1 }
  const { fetch, calls } = fakeFetch([{ body: [project] }, { body: [] }])
  const c = client(fetch)
  expect(await c.listProjects('')).toEqual([{ path: 'acme/workitems', name: 'workitems', namespace: 'acme', activity: '2026-11-09T10:00:00Z' }])
  const url = new URL(calls[0].url)
  expect(url.searchParams.get('membership')).toBe('true')
  expect(url.searchParams.get('order_by')).toBe('last_activity_at')
  expect(url.searchParams.get('active')).toBe('true') // niente archiviati o in cancellazione
  expect(url.searchParams.has('search')).toBe(false)
  await c.listProjects('acme work')
  const searched = new URL(calls[1].url)
  expect(searched.searchParams.get('search')).toBe('acme work')
  expect(searched.searchParams.get('search_namespaces')).toBe('true')
})
