/* Auth regressions with real Axios interceptors and in-memory HTTP adapters. */
import assert from "node:assert/strict";
import axios from "axios";
import { hasAdminRole, AdminAccessError, requestAdminSession } from "../src/dung-chung/xac-thuc/adminSession.js";
import { newPasswordError } from "../src/dung-chung/xac-thuc/passwordPolicy.js";
import { rowActionKeys, validSelection } from "../src/chuc-nang/nguoi-dung/xu-ly/utils.js";
import { shiftAnchor, periodOptions } from "../src/chuc-nang/phan-tich-van-hanh/xu-ly/report-period.js";
import { actionLabel, auditSections } from "../src/dung-chung/tien-ich/format.js";

let passed = 0, sequence = 0;
const checks = [];
function check(name, run) { run(); passed++; checks.push(name); }
async function scenario(name, run) { await run(); passed++; checks.push(name); }
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); Object.defineProperty(this, key, { configurable: true, enumerable: true, value: String(value) }); }
  removeItem(key) { this.values.delete(key); delete this[key]; }
}
function response(config, data = {}, status = 200) { return { config, data, status, statusText: "", headers: {} }; }
function reject(config, status) { throw new axios.AxiosError("Controlled HTTP failure", undefined, config, {}, response(config, {}, status)); }
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
const tick = () => new Promise((done) => setImmediate(done));
async function environment(handler, { helper = false } = {}) {
  const sessionStorage = new Storage(), localStorage = new Storage(), location = { href: "" }, calls = [];
  Object.assign(globalThis, { sessionStorage, localStorage, window: { location } });
  const adapter = async (config) => { calls.push(config); return handler(config, { sessionStorage, localStorage, location, calls }); };
  axios.defaults.adapter = adapter;
  const module = await import(`../src/dung-chung/connect-api/api.js${helper ? "" : "?case=" + (++sequence)}`);
  module.clearSession();
  module.default.defaults.adapter = adapter;
  return { ...module, sessionStorage, localStorage, location, calls };
}

check("ADMIN role is required, missing or malformed roles are denied", () => {
  assert.equal(hasAdminRole({ role: "ADMIN" }), true);
  assert.equal(hasAdminRole({ role: "admin" }), true);
  for (const role of [undefined, null, "USER", "SUPERADMIN", 1, {}]) assert.equal(hasAdminRole({ role }), false);
  assert.equal(hasAdminRole(null), false);
});
for (const [value, allowed] of [["abcdef", true], ["  ab cd ef  ", true], ["a b c d e ", false], ["😀😀😀😀😀😀", true], ["😀😀😀", false], ["a\u0085b\u001cc\u3000", false], ["x".repeat(128), true], ["x".repeat(129), false], ["😀".repeat(128), true]]) {
  check("Password policy: " + JSON.stringify(value.length), () => assert.equal(newPasswordError(value) === "", allowed));
}

await scenario("Admin identity is checked before callers save credentials", async () => {
  const env = await environment((config) => {
    if (config.url === "/auth/login") {
      assert.deepEqual(JSON.parse(config.data), { email: "qa@example.invalid", password: "  secret  " });
      assert.equal(config.timeout, 15000);
      return response(config, { access_token: "candidate", refresh_token: "candidate-refresh" });
    }
    assert.equal(config.url, "/auth/me"); assert.equal(config.headers.Authorization, "Bearer candidate");
    return response(config, { role: "ADMIN", must_change_password: true });
  }, { helper: true });
  const tokens = await requestAdminSession({ email: "qa@example.invalid", password: "  secret  " });
  assert.equal(tokens.access_token, "candidate"); assert.equal(env.sessionStorage.getItem("admin_access_token"), null);
});
await scenario("A non-admin login is rejected and its newly issued session is revoked", async () => {
  const env = await environment((config) => {
    if (config.url === "/auth/login") return response(config, { access_token: "user", refresh_token: "user-refresh" });
    if (config.url === "/auth/me") return response(config, { role: "USER" });
    assert.equal(config.url, "/auth/logout"); assert.equal(JSON.parse(config.data).refresh_token, "user-refresh"); return response(config);
  }, { helper: true });
  await assert.rejects(requestAdminSession({}), AdminAccessError); await tick();
  assert.equal(env.calls.filter((c) => c.url === "/auth/logout").length, 1);
  assert.equal(env.sessionStorage.getItem("admin_access_token"), null);
});
await scenario("An invalid token response never requests a profile", async () => {
  const env = await environment((config) => config.url === "/auth/login" ? response(config, {}) : assert.fail("Unexpected request"), { helper: true });
  await assert.rejects(requestAdminSession({}), /không hợp lệ/); assert.equal(env.calls.length, 1);
});
await scenario("Failure during profile lookup revokes the candidate session", async () => {
  const env = await environment((config) => {
    if (config.url === "/auth/login") return response(config, { access_token: "candidate", refresh_token: "candidate-refresh" });
    if (config.url === "/auth/me") return reject(config, 503);
    return response(config);
  }, { helper: true });
  await assert.rejects(requestAdminSession({})); await tick();
  assert.ok(env.calls.some((c) => c.url === "/auth/logout"));
});
await scenario("Abandoned login cannot persist a session and revokes issued tokens", async () => {
  const profile = deferred(), entered = deferred(), controller = new AbortController();
  const env = await environment(async (config) => {
    if (config.url === "/auth/login") return response(config, { access_token: "candidate", refresh_token: "candidate-refresh" });
    if (config.url === "/auth/me") { entered.resolve(); await profile.promise; return response(config, { role: "ADMIN" }); }
    return response(config);
  }, { helper: true });
  const attempt = requestAdminSession({}, { signal: controller.signal });
  await entered.promise; controller.abort(); profile.resolve();
  await assert.rejects(attempt, (error) => axios.isCancel(error)); await tick();
  assert.ok(env.calls.some((c) => c.url === "/auth/logout"));
  assert.equal(env.sessionStorage.getItem("admin_access_token"), null);
});
await scenario("A rejected password does not attempt to revoke unrelated tokens", async () => {
  const env = await environment((config) => reject(config, 401), { helper: true });
  await assert.rejects(requestAdminSession({})); assert.equal(env.calls.length, 1); assert.equal(env.location.href, "");
});

await scenario("Explicit Authorization is preserved", async () => {
  const env = await environment((config) => response(config));
  env.sessionStorage.setItem("admin_access_token", "stored");
  await env.default.get("/auth/me", { headers: { Authorization: "Bearer explicit" } });
  assert.equal(env.calls[0].headers.Authorization, "Bearer explicit");
});
await scenario("Concurrent 401 responses share one refresh and both retry with the new token", async () => {
  let refreshes = 0; const entered = deferred(), release = deferred();
  const env = await environment(async (config) => {
    if (config.url === "/api/v1/auth/refresh") { refreshes++; entered.resolve(); await release.promise; return response(config, { access_token: "new", refresh_token: "refresh-new" }); }
    if (config.headers.Authorization !== "Bearer new") return reject(config, 401);
    return response(config, { ok: true });
  });
  env.sessionStorage.setItem("admin_access_token", "old"); env.sessionStorage.setItem("admin_refresh_token", "refresh-old");
  const both = Promise.all([env.default.get("/admin/users"), env.default.get("/admin/categories")]);
  await entered.promise; await tick(); release.resolve(); await both;
  assert.equal(refreshes, 1); assert.equal(env.sessionStorage.getItem("admin_access_token"), "new");
  assert.equal(env.sessionStorage.getItem("admin_refresh_token"), "refresh-new");
});
await scenario("A temporary refresh failure keeps the session available for retry", async () => {
  const env = await environment((config) => reject(config, config.url === "/api/v1/auth/refresh" ? 503 : 401));
  env.sessionStorage.setItem("admin_access_token", "old"); env.sessionStorage.setItem("admin_refresh_token", "refresh-old");
  await assert.rejects(env.default.get("/admin/users"));
  assert.equal(env.sessionStorage.getItem("admin_refresh_token"), "refresh-old"); assert.equal(env.location.href, "");
});
for (const status of [401, 403]) {
  await scenario("Confirmed invalid refresh clears the session: " + status, async () => {
    const env = await environment((config) => config.url === "/api/v1/auth/logout" ? response(config) : reject(config, config.url === "/api/v1/auth/refresh" ? status : 401));
    env.sessionStorage.setItem("admin_access_token", "old"); env.sessionStorage.setItem("admin_refresh_token", "refresh-old");
    await assert.rejects(env.default.get("/admin/users"));
    assert.equal(env.sessionStorage.getItem("admin_access_token"), null); assert.equal(env.location.href, "/login");
  });
}
await scenario("Late refresh cannot overwrite a newer login after logout", async () => {
  const entered = deferred(), release = deferred();
  const env = await environment(async (config) => {
    if (config.url === "/api/v1/auth/refresh") { entered.resolve(); await release.promise; return response(config, { access_token: "late", refresh_token: "late-refresh" }); }
    if (config.url === "/api/v1/auth/logout") return response(config);
    return reject(config, 401);
  });
  env.sessionStorage.setItem("admin_access_token", "old"); env.sessionStorage.setItem("admin_refresh_token", "refresh-old");
  const attempt = env.default.get("/admin/users");
  await entered.promise; env.clearSession();
  env.sessionStorage.setItem("admin_access_token", "new-login"); env.sessionStorage.setItem("admin_refresh_token", "new-login-refresh");
  release.resolve(); await assert.rejects(attempt, (error) => axios.isCancel(error)); await tick();
  assert.equal(env.sessionStorage.getItem("admin_access_token"), "new-login"); assert.equal(env.location.href, "");
  assert.ok(env.calls.some((config) => config.url === "/api/v1/auth/logout" && JSON.parse(config.data).refresh_token === "late-refresh"));
});
await scenario("A delayed protected response is discarded after logout", async () => {
  const entered = deferred(), release = deferred();
  const env = await environment(async (config) => { entered.resolve(); await release.promise; return response(config, { private: true }); });
  const request = env.default.get("/admin/users"); await entered.promise; env.clearSession(); release.resolve();
  await assert.rejects(request, (error) => axios.isCancel(error));
});
await scenario("A protected 403 does not silently refresh or end a valid session", async () => {
  const env = await environment((config) => reject(config, 403));
  env.sessionStorage.setItem("admin_access_token", "valid");
  await assert.rejects(env.default.get("/admin/users")); assert.equal(env.calls.length, 1);
  assert.equal(env.sessionStorage.getItem("admin_access_token"), "valid"); assert.equal(env.location.href, "");
});

const ordinary = { id: "other", role: "USER", is_active: true };
check("Request-only audit logs do not render three empty change panels", () => {
  assert.deepEqual(auditSections({ before: null, after: {}, metadata: { query_keys: [] } }), []);
});
check("Audit labels distinguish reading a bill QR from processing an account-support request", () => {
  assert.equal(actionLabel("CREATE_RESOLVE"), "Đọc thông tin QR hóa đơn");
  assert.equal(actionLabel("CREATE_ACCOUNT"), "Tiếp nhận yêu cầu hỗ trợ tài khoản");
});
check("Audit snapshots preserve false and zero and explain account state in Vietnamese", () => {
  const sections = auditSections({ before: { is_active: true }, after: { is_active: false, sort_order: 0 } });
  assert.deepEqual(sections[0].rows, [["Trạng thái truy cập", "Có thể truy cập"]]);
  assert.deepEqual(sections[1].rows, [["Trạng thái truy cập", "Đã khóa"], ["Thứ tự", "0"]]);
});
check("Unknown current identity cannot expose mutation actions or select accounts", () => {
  assert.deepEqual(rowActionKeys(ordinary, undefined, true), []);
  assert.deepEqual(validSelection(["other"], [ordinary], undefined), []);
});
check("Only a system admin sees role changes; normal admins retain allowed actions", () => {
  assert.deepEqual(rowActionKeys(ordinary, "me"), ["reset-password", "ban"]);
  assert.deepEqual(rowActionKeys(ordinary, "me", true), ["role", "reset-password", "ban"]);
});
check("Self and system accounts never expose mutation actions", () => {
  for (const user of [{ ...ordinary, id: "me" }, { ...ordinary, is_system_account: true }]) {
    assert.deepEqual(rowActionKeys(user, "me", true), []);
  }
});
check("An active admin cannot be banned; a locked non-system admin can be unlocked", () => {
  assert.equal(rowActionKeys({ ...ordinary, role: "ADMIN" }, "me", true).includes("ban"), false);
  assert.equal(rowActionKeys({ ...ordinary, role: "ADMIN", is_active: false }, "me", true).includes("unban"), true);
});
check("Bulk selection drops duplicates, off-page and newly promoted accounts", () => {
  const list = [ordinary, { ...ordinary, id: "promoted", role: "ADMIN" }, { ...ordinary, id: "me" }];
  assert.deepEqual(validSelection(["other", "other", "promoted", "me", "off-page"], list, "me"), ["other"]);
});
check("Report periods cross leap days, month ends and year boundaries correctly", () => {
  assert.equal(shiftAnchor("2024-03-01", "day", -1), "2024-02-29");
  assert.equal(shiftAnchor("2026-01-31", "month", -1), "2025-12-01");
  assert.equal(shiftAnchor("2026-01-01", "week", 0), "2025-12-29");
  assert.equal(shiftAnchor("2026-01-01", "week", 1), "2026-01-05");
});
check("Report options preserve older selections without allowing future periods", () => {
  const options = periodOptions("2026-11-06", "month", "2024-02-29");
  assert.equal(options.some((option) => option.value === "2024-02-01"), true);
  assert.equal(options.some((option) => option.value > "2026-11-06"), false);
  assert.equal(new Set(options.map((option) => option.value)).size, options.length);
});
console.log(JSON.stringify({ passed, real_http_requests: 0, scope: "admin auth, session, password, account guards and report periods", checks }, null, 2));
