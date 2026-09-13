import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('sessionStorage', storage());
  vi.stubGlobal('window', { location: { href: '' } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('reuses the money key after a lost response and renews it after success', async () => {
  const { default: api } = await import('../lib/api');
  const keys: string[] = [];
  api.defaults.adapter = async config => {
    keys.push(String(config.headers['Idempotency-Key']));
    if (keys.length === 1) throw { config, message: 'Connection lost' };
    return { config, status: 201, statusText: 'Created', headers: {}, data: {} };
  };
  const body = { amount: '100', account_id: 'wallet' };
  await expect(api.post('/transactions', body)).rejects.toBeDefined();
  await api.post('/transactions', body);
  await api.post('/transactions', body);
  expect(keys[0]).toBe(keys[1]);
  expect(keys[2]).not.toBe(keys[1]);
  expect(keys[0]).not.toBe('undefined');
});

describe('API base URL', () => {
  it.each(['https://api.example.test', 'https://api.example.test/api', 'https://api.example.test/api/v1/'])('normalizes %s once', async url => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', url);
    const { default: api } = await import('../lib/api');
    expect(api.defaults.baseURL).toBe('https://api.example.test/api/v1');
  });
});

it('preserves an explicitly supplied login token', async () => {
  sessionStorage.setItem('user_access_token', 'old-token');
  const { default: api } = await import('../lib/api');
  api.defaults.adapter = async config => {
    expect(config.headers.Authorization).toBe('Bearer login-token');
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  };
  await api.get('/auth/me', { headers: { Authorization: 'Bearer login-token' } });
});

it('refreshes concurrent requests once and uses the rotated token on the next refresh', async () => {
  sessionStorage.setItem('user_access_token', 'expired');
  sessionStorage.setItem('user_refresh_token', 'refresh-1');
  const { default: api } = await import('../lib/api');
  const post = vi.spyOn(axios, 'post').mockImplementation(async (_url, body) => {
    const token = (body as { refresh_token: string }).refresh_token;
    const next = token === 'refresh-1' ? 2 : 3;
    await new Promise(resolve => setTimeout(resolve, 10));
    return { data: { access_token: 'access-' + next, refresh_token: 'refresh-' + next } };
  });
  api.defaults.adapter = async config => {
    if (config.headers.Authorization === 'Bearer expired') {
      throw { config, response: { status: 401 } };
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data: 'success' };
  };
  const responses = await Promise.all([api.get('/accounts'), api.get('/budgets')]);
  expect(responses.every(r => r.data === 'success')).toBe(true);
  expect(post).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('user_refresh_token')).toBe('refresh-2');
  sessionStorage.setItem('user_access_token', 'expired');
  await api.get('/dashboard');
  expect(post).toHaveBeenLastCalledWith(expect.stringContaining('/auth/refresh'), { refresh_token: 'refresh-2' });
  expect(sessionStorage.getItem('user_refresh_token')).toBe('refresh-3');
});

it('does not refresh or redirect for a failed login', async () => {
  const { default: api } = await import('../lib/api');
  const post = vi.spyOn(axios, 'post');
  api.defaults.adapter = async config => { throw { config, response: { status: 401 } }; };
  await expect(api.post('/auth/login', {})).rejects.toBeDefined();
  expect(post).not.toHaveBeenCalled();
  expect(window.location.href).toBe('');
});

it('clears an expired session after refresh fails', async () => {
  sessionStorage.setItem('user_access_token', 'expired');
  sessionStorage.setItem('user_refresh_token', 'expired-refresh');
  const { default: api } = await import('../lib/api');
  vi.spyOn(axios, 'post').mockRejectedValue(new Error('Refresh failed'));
  api.defaults.adapter = async config => { throw { config, response: { status: 401 } }; };
  await expect(api.get('/accounts')).rejects.toBeDefined();
  expect(sessionStorage.getItem('user_access_token')).toBeNull();
  expect(sessionStorage.getItem('user_refresh_token')).toBeNull();
  expect(window.location.href).toBe('/login');
});
