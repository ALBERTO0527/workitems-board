export class ConflictError extends Error {}

const enc = encodeURIComponent

export function createClient({ getToken, fetch = globalThis.fetch, base = 'https://gitlab.com/api/v4' }) {
  async function request(path, init = {}) {
    const res = await fetch(base + path, {
      ...init,
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 401) throw new Error('login')
    if (!res.ok) {
      const message = typeof body.message === 'string' ? body.message : JSON.stringify(body.message ?? body.error ?? res.status)
      if (res.status === 400 && /already exists|has changed/.test(message)) throw new ConflictError(message)
      throw new Error(message)
    }
    return { body, next: res.headers.get('X-Next-Page') }
  }

  async function all(path) {
    const out = []
    for (let page = '1'; page; ) {
      const { body, next } = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
      out.push(...body)
      page = next
    }
    return out
  }

  return {
    getUser: async () => {
      const { username, name } = (await request('/user')).body
      return { username, name }
    },
    getProject: async pathWithNamespace => {
      const { id, default_branch, web_url } = (await request(`/projects/${enc(pathWithNamespace)}`)).body
      return { id, default_branch, web_url }
    },
    listTree: async (id, ref) =>
      (await all(`/projects/${id}/repository/tree?recursive=true&ref=${enc(ref)}`))
        .filter(e => e.type === 'blob')
        .map(e => e.path),
    getFile: async (id, path, ref) => {
      const { body } = await request(`/projects/${id}/repository/files/${enc(path)}?ref=${enc(ref)}`)
      const bytes = Uint8Array.from(atob(body.content), c => c.charCodeAt(0))
      return { content: new TextDecoder().decode(bytes), lastCommitId: body.last_commit_id }
    },
    getMembers: async id =>
      (await all(`/projects/${id}/members/all`))
        .filter(m => m.access_level >= 30)
        .map(({ username, name }) => ({ username, name })),
    commit: async (id, branch, message, actions) => {
      await request(`/projects/${id}/repository/commits`, {
        method: 'POST',
        body: JSON.stringify({ branch, commit_message: message, actions }),
      })
    },
  }
}
