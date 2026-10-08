// Run the real interceptor source with isolated transport/storage; no network.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('../../frontend/user-web/node_modules/typescript');

function harness(project) {
  const admin = project === 'admin';
  const prefix = admin ? 'admin' : 'user';
  const file = resolve(__dirname, `../../frontend/${prefix}-web/src/dung-chung/connect-api/api.${admin ? 'js' : 'ts'}`);
  const source = readFileSync(file, 'utf8').replace('import.meta.env.VITE_API_URL', 'process.env.VITE_API_URL');
  const storage = new Map([[`${prefix}_access_token`, 'old-access'], [`${prefix}_refresh_token`, 'old-refresh']]);
  const calls = { refresh: 0, logout: 0, replay: 0 };
  let rejectResponse;
  let refresh = async () => ({ data: { access_token: 'new-access', refresh_token: 'new-refresh' } });
  const client = async config => { calls.replay++; return { status: 200, config }; };
  client.interceptors = { request: { use() {} }, response: { use(_ok, fail) { rejectResponse = fail; } } };
  const axios = { create: () => client, isAxiosError: e => e?.isAxiosError === true,
    post: async (url, _body, options) => {
      if (url.endsWith('/logout')) { calls.logout++; return {}; }
      calls.refresh++; assert.equal(options.timeout, 15000); return refresh();
    } };
  const window = { location: { href: '/protected' } };
  const context = { exports: {}, require: () => axios, process: { env: {} }, window,
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, context);
  return { calls, storage, window, setRefresh: f => { refresh = f; },
    request: () => rejectResponse({ response: { status: 401 }, config: { url: '/accounts', headers: {} } }) };
}

for (const project of ['user', 'admin']) {
  for (const status of [503, 500, 429, undefined]) test(`${project}: ${status ?? 'network/timeout'} preserves session, rejects queue, recovers`, async () => {
    const h = harness(project);
    const error = { isAxiosError: true, response: status ? { status } : undefined };
    let fail;
    h.setRefresh(() => new Promise((_resolve, reject) => { fail = reject; }));
    const a = h.request(); const b = h.request();
    const results = Promise.allSettled([a, b]); fail(error);
    assert.ok((await results).every(r => r.status === 'rejected' && r.reason === error));
    assert.equal(h.calls.refresh, 1); assert.equal(h.calls.logout, 0); assert.equal(h.calls.replay, 0);
    assert.equal(h.storage.get(`${project}_refresh_token`), 'old-refresh');
    assert.equal(h.window.location.href, '/protected');
    h.setRefresh(async () => ({ data: { access_token: 'new-access', refresh_token: 'new-refresh' } }));
    assert.equal((await h.request()).status, 200);
    assert.equal(h.storage.get(`${project}_refresh_token`), 'new-refresh');
  });
  for (const status of [401, 403]) test(`${project}: refresh ${status} clears session`, async () => {
    const h = harness(project);
    h.setRefresh(async () => { throw { isAxiosError: true, response: { status } }; });
    await assert.rejects(h.request());
    assert.equal(h.storage.size, 0); assert.equal(h.calls.logout, 1);
    assert.notEqual(h.window.location.href, '/protected');
  });
  test(`${project}: missing refresh token denies access`, async () => {
    const h = harness(project); h.storage.delete(`${project}_refresh_token`);
    await assert.rejects(h.request()); assert.equal(h.calls.refresh, 0); assert.equal(h.storage.size, 0);
  });
}
