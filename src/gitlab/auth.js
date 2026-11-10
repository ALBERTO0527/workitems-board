const GITLAB = 'https://gitlab.com'
const KEY = 'wib.auth'
const PKCE_KEY = 'wib.pkce'
const clientId = () => import.meta.env.VITE_GITLAB_CLIENT_ID
const redirectUri = () => location.origin + location.pathname

const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)))

export async function challengeFor(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}

export async function pkcePair() {
  const verifier = random()
  return { verifier, challenge: await challengeFor(verifier) }
}

export async function startLogin() {
  const { verifier, challenge } = await pkcePair()
  const state = random()
  // l'hash non sopravvive al redirect di GitLab: lo teniamo per riaprire la stessa pagina
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, hash: location.hash }))
  const q = new URLSearchParams({
    client_id: clientId(), redirect_uri: redirectUri(), response_type: 'code', scope: 'api',
    state, code_challenge: challenge, code_challenge_method: 'S256',
  })
  location.assign(`${GITLAB}/oauth/authorize?${q}`)
}

export async function completeLogin(url) {
  const code = url.searchParams.get('code')
  const pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? 'null')
  if (!code || !pkce || url.searchParams.get('state') !== pkce.state) return false
  sessionStorage.removeItem(PKCE_KEY)
  await requestToken({ grant_type: 'authorization_code', code, code_verifier: pkce.verifier })
  history.replaceState(null, '', url.pathname + (pkce.hash || url.hash))
  return true
}

let refreshing = null

export async function getToken() {
  const auth = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  if (!auth) throw new Error('login')
  if (auth.expires_at - 60e3 > Date.now()) return auth.access_token
  // ponytail: un solo refresh alla volta, GitLab invalida il refresh token dopo l'uso
  refreshing ??= requestToken({ grant_type: 'refresh_token', refresh_token: auth.refresh_token })
    .catch(e => {
      if (!/^token 4/.test(e.message)) throw e // rete giù: la sessione resta, si riprova dopo
      const now = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      if (now && now.refresh_token !== auth.refresh_token) return now.access_token // rinnovato da un'altra scheda
      logout()
      throw new Error('login')
    })
    .finally(() => { refreshing = null })
  return refreshing
}

export function logout() {
  localStorage.removeItem(KEY)
}

async function requestToken(params) {
  const res = await fetch(`${GITLAB}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri(), ...params }),
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  const t = await res.json()
  localStorage.setItem(KEY, JSON.stringify({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000,
  }))
  return t.access_token
}
