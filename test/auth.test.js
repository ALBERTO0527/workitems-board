// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { challengeFor, completeLogin, getToken, logout, startLogin } from '../src/gitlab/auth.js'

const KEY = 'wib.auth'
const save = auth => localStorage.setItem(KEY, JSON.stringify(auth))
const tokenResponse = (token, status = 200) =>
  new Response(JSON.stringify({ access_token: token, refresh_token: 'r2', expires_in: 7200 }), { status })

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => vi.unstubAllGlobals())

test('PKCE challenge matches RFC 7636 appendix B', async () => {
  expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
})

test('valid token is returned without network', async () => {
  save({ access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() + 3600e3 })
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  expect(await getToken()).toBe('a1')
  expect(fetch).not.toHaveBeenCalled()
})

test('expired token is refreshed once even with parallel calls', async () => {
  save({ access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() - 1000 })
  const fetch = vi.fn(async () => tokenResponse('a2'))
  vi.stubGlobal('fetch', fetch)
  expect(await Promise.all([getToken(), getToken(), getToken()])).toEqual(['a2', 'a2', 'a2'])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(String(fetch.mock.calls[0][1].body)).toContain('grant_type=refresh_token')
  expect(JSON.parse(localStorage.getItem(KEY)).refresh_token).toBe('r2')
})

test('failed refresh logs out', async () => {
  save({ access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() - 1000 })
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
  await expect(getToken()).rejects.toThrow('login')
  expect(localStorage.getItem(KEY)).toBe(null)
})

test('no token at all asks for login', async () => {
  await expect(getToken()).rejects.toThrow('login')
})

test('completeLogin exchanges the code only when state matches', async () => {
  sessionStorage.setItem('wib.pkce', JSON.stringify({ verifier: 'v', state: 's1' }))
  const fetch = vi.fn(async () => tokenResponse('a1'))
  vi.stubGlobal('fetch', fetch)
  expect(await completeLogin(new URL('http://localhost:5173/?code=c&state=wrong'))).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
  expect(await completeLogin(new URL('http://localhost:5173/?code=c&state=s1'))).toBe(true)
  const body = String(fetch.mock.calls[0][1].body)
  expect(body).toContain('code_verifier=v')
  expect(body).toContain('grant_type=authorization_code')
  expect(await getToken()).toBe('a1')
  logout()
  expect(localStorage.getItem(KEY)).toBe(null)
})

test('the page open before login is restored after it', async () => {
  vi.stubGlobal('location', { ...location, hash: '#/acme/workitems/-/alpha', origin: 'http://localhost:5173', pathname: '/', assign: vi.fn() })
  await startLogin()
  vi.unstubAllGlobals()
  const { state } = JSON.parse(sessionStorage.getItem('wib.pkce'))
  vi.stubGlobal('fetch', vi.fn(async () => tokenResponse('a1')))
  await completeLogin(new URL(`http://localhost:5173/?code=c&state=${state}`))
  expect(location.hash).toBe('#/acme/workitems/-/alpha')
  expect(location.search).toBe('')
})

test('a network error during refresh keeps the session', async () => {
  save({ access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() - 1000 })
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
  await expect(getToken()).rejects.toThrow('Failed to fetch')
  expect(JSON.parse(localStorage.getItem(KEY)).refresh_token).toBe('r1')
})

test('a refresh rejected because another tab already refreshed uses that tab token', async () => {
  save({ access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() - 1000 })
  vi.stubGlobal('fetch', vi.fn(async () => {
    save({ access_token: 'a2', refresh_token: 'r2', expires_at: Date.now() + 7200e3 })
    return new Response('{}', { status: 400 })
  }))
  expect(await getToken()).toBe('a2')
  expect(JSON.parse(localStorage.getItem(KEY)).refresh_token).toBe('r2')
})
