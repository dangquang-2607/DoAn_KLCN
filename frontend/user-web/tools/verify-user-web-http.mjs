/* Exercise the running Next.js portal and its real API rewrite, without a browser.
 * Refuses to mutate unless the destination identifies a disposable user-web DB.
 * Creates one separate fixture account, retained until the disposable DB is removed.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const origin = "http://localhost:3011";
const checks = [];
let requests = 0;
let token;
async function request(name, method, route, { status = 200, body, key, authenticated = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers["Idempotency-Key"] = key;
  if (authenticated && token) headers.Authorization = "Bearer " + token;
  const response = await fetch(origin + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(20000) });
  requests++;
  assert.equal(response.status, status, name + ": unexpected HTTP status");
  const text = await response.text();
  const data = response.headers.get("content-type")?.includes("application/json") && text ? JSON.parse(text) : text;
  checks.push(name);
  return { data, headers: response.headers };
}
function check(name, condition) { assert.ok(condition, name); checks.push(name); }
const mutate = (name, method, route, options = {}) => request(name, method, "/api/v1" + route, { key: randomUUID(), ...options });

async function main() {
  const guard = (await request("Disposable environment is reachable through the portal", "GET", "/api/v1/__test/status", { authenticated: false })).data;
  assert.match(guard.database, /^cf_userweb_test_[0-9a-f]{12}$/, "Refusing to use a non-disposable database");
  for (const route of ["/", "/login", "/accounts", "/transactions", "/budgets", "/categories", "/ocr", "/analytics", "/settings", "/settings/subscription", "/settings/subscription/checkout", "/support", "/demo-checkout"]) {
    const result = await request("Portal route renders HTML: " + route, "GET", route, { authenticated: false });
    check("HTML contract: " + route, result.headers.get("content-type")?.includes("text/html") && result.data.includes("<!DOCTYPE html>"));
  }
  await request("Proxy preserves protected GET status", "GET", "/api/v1/wallets", { status: 401 });
  await request("Proxy preserves protected QR status", "POST", "/api/v1/wallets/bills/qr", { status: 401, body: {} });
  const nonce = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `quanghong5742+portal-${nonce}@gmail.com`;
  const password = "PortalFixture!" + randomUUID();
  await request("Register isolated fixture through portal", "POST", "/api/v1/auth/register", { status: 201, body: { email, password, full_name: "Kiểm thử proxy " + nonce }, authenticated: false });
  const login = await request("Login isolated fixture through portal", "POST", "/api/v1/auth/login", { body: { email, password }, authenticated: false });
  token = login.data.access_token;
  check("Tokens survive the portal response", typeof token === "string" && typeof login.data.refresh_token === "string");
  const profile = (await request("Read fixture profile", "GET", "/api/v1/auth/me")).data;
  check("Authorization header reaches the API", profile.email === email);
  const initial = (await request("Read default wallet", "GET", "/api/v1/wallets")).data;
  check("Fixture starts with one empty default wallet", initial.length === 1 && initial[0].is_default && Number(initial[0].balance) === 0);
  await request("Proxy preserves missing idempotency requirement", "POST", "/api/v1/wallets", { status: 428, body: { name: "No key" } });
  const key = randomUUID();
  const created = (await mutate("Create wallet with Unicode name", "POST", "/wallets", { status: 201, key, body: { name: "Ví phụ thử HTTP" } })).data;
  const replay = (await mutate("Replay wallet creation", "POST", "/wallets", { status: 201, key, body: { name: "Ví phụ thử HTTP" } })).data;
  check("Proxy preserves exactly-once creation", created.id === replay.id);
  await mutate("Reject changed payload for same key", "POST", "/wallets", { status: 409, key, body: { name: "Changed" } });
  await mutate("Rename fixture wallet", "PATCH", "/wallets/" + created.id, { body: { name: "Ví HTTP đã đổi tên" } });
  const receive = (await request("Read receiving contract", "GET", `/api/v1/wallets/${created.id}/receive`)).data;
  check("Receiving metadata keeps Unicode", receive.wallet_name === "Ví HTTP đã đổi tên" && receive.qr_payload.startsWith("capitalflow://"));
  const bill = (await request("Create bill QR through proxy", "POST", "/api/v1/wallets/bills/qr", { body: { merchant_name: "Cửa hàng HTTP", items: [{ name: "A", quantity: 3, unit_price: "0.10" }, { name: "B", quantity: 1, unit_price: "0.20" }] } })).data;
  const resolved = (await request("Resolve bill QR through proxy", "POST", "/api/v1/wallets/bills/resolve", { body: { qr_payload: bill.qr_payload } })).data;
  check("QR JSON and decimal values match after proxying", resolved.merchant_name === "Cửa hàng HTTP" && resolved.amount === "0.50" && resolved.currency === "VND" && resolved.items.length === 2);
  await request("Proxy preserves malformed QR validation", "POST", "/api/v1/wallets/bills/resolve", { status: 422, body: { qr_payload: "invalid" } });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const expense = (await mutate("Create manual expense", "POST", "/bookkeeping", { status: 201, body: { type: "EXPENSE", amount: "53", transaction_date: today, description: "HTTP expense" } })).data;
  await mutate("Create manual income", "POST", "/bookkeeping", { status: 201, body: { type: "INCOME", amount: "100", transaction_date: today, description: "HTTP income" } });
  const ledger = (await request("Read bookkeeping through portal", "GET", "/api/v1/bookkeeping?page_size=100")).data;
  check("Bookkeeping has only this fixture's rows", ledger.items.length === 2 && ledger.items.some(row => row.id === expense.id));
  const report = (await request("Read monthly report through portal", "GET", `/api/v1/analytics?month=${Number(today.slice(5, 7))}&year=${today.slice(0, 4)}`)).data;
  check("Report reflects posted income and expense", Number(report.summary.income) === 100 && Number(report.summary.expense) === 53);
  const walletAfter = (await request("Read wallets after bookkeeping changes", "GET", "/api/v1/wallets")).data;
  check("Manual bookkeeping does not debit wallets", walletAfter.every(wallet => Number(wallet.balance) === 0));
  await request("Proxy preserves validation detail", "POST", "/api/v1/bookkeeping", { status: 422, key: randomUUID(), body: { type: "EXPENSE", amount: "0", transaction_date: today } });
  await mutate("Close empty fixture wallet", "DELETE", "/wallets/" + created.id);
  const active = (await request("Closed wallet is absent from active list", "GET", "/api/v1/wallets")).data;
  check("Wallet closure affects only the fixture wallet", active.length === 1 && active[0].id === initial[0].id);
  await request("Log out fixture session", "POST", "/api/v1/auth/logout", { status: 204, body: { refresh_token: login.data.refresh_token } });
  await request("Revoked token is rejected through portal", "GET", "/api/v1/auth/me", { status: 401 });
  const result = { recorded_at: new Date().toISOString(), origin, database: guard.database, passed: checks.length, real_http_requests: requests, browser_gui_cases: 0, real_email_dispatch: "blocked by isolated test server", checks };
  const outputIndex = process.argv.indexOf("--report");
  if (outputIndex >= 0) {
    assert.ok(process.argv[outputIndex + 1], "--report requires an output path");
    fs.writeFileSync(path.resolve(process.argv[outputIndex + 1]), JSON.stringify(result, null, 2) + "\n");
  }
  console.log(JSON.stringify({ passed: checks.length, real_http_requests: requests, browser_gui_cases: 0, database: guard.database }));
}
main().catch(error => { console.error(error.name + ": " + error.message); process.exitCode = 1; });
