/* Regression checks for browser-independent user-web behavior. No browser or project data is accessed. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import axios from "axios";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
const checks = [];
function check(name, fn) { fn(); passed++; checks.push(name); }
async function checkAsync(name, fn) { await fn(); passed++; checks.push(name); }
function loadTs(relative, overrides = {}, globals = {}) {
  const filename = path.join(root, relative);
  const targetModule = { exports: {} };
  const localRequire = createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const require = (name) => Object.hasOwn(overrides, name) ? overrides[name]
    : name === "@/dung-chung/tien-ich/browserCrypto" ? loadTs("src/dung-chung/tien-ich/browserCrypto.ts", {}, globals) : localRequire(name);
  vm.runInNewContext(code, { module: targetModule, exports: targetModule.exports, require, TextEncoder, TextDecoder, crypto: webcrypto,
    atob, btoa, URL, AbortController, setTimeout, clearTimeout, console, ...globals }, { filename });
  return targetModule.exports;
}
class Storage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); Object.defineProperty(this, key, { configurable: true, enumerable: true, value: String(value) }); }
  removeItem(key) { this.values.delete(key); delete this[key]; }
}
function jwt(owner = "11111111-1111-4111-8111-111111111111", family = "session-one", suffix = "") {
  return "header." + Buffer.from(JSON.stringify({ sub: owner, sid: family, extra: suffix })).toString("base64url") + ".signature";
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function response(config, status = 200, data = {}) { return { config, data, status, statusText: "", headers: {} }; }
function failure(config, status) { return new axios.AxiosError("Controlled test failure", undefined, config, {}, response(config, status)); }
function apiEnvironment(adapter, authPost = async () => ({ data: {} }), crypto = webcrypto) {
  const sessionStorage = new Storage(), localStorage = new Storage();
  const location = { href: "", replace(value) { this.href = value; } };
  const fakeAxios = { ...axios, create: () => axios.create({ adapter }), post: authPost };
  const exports = loadTs("src/dung-chung/connect-api/api.ts", { axios: fakeAxios }, {
    crypto, sessionStorage, localStorage, window: { location }, navigator: { locks: { request: async (_, task) => task() } },
  });
  return { ...exports, sessionStorage, localStorage, location };
}

async function main() {
  const legacyCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  const compatible = loadTs("src/dung-chung/tien-ich/browserCrypto.ts", {}, { crypto: legacyCrypto });
  await checkAsync("SHA-256 fallback keeps native fingerprints, including Vietnamese and binary input", async () => {
    for (const input of ["", "abc", "Mua bình cho em bé · 183.000 đ", "x".repeat(1000), new Uint8Array([0, 255, 1, 128]).buffer]) {
      const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
      const expected = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
      assert.equal(await compatible.sha256Hex(input), expected);
    }
    assert.equal(await compatible.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  check("Safari UUID fallback uses unique RFC 4122 version 4 IDs", () => {
    const ids = Array.from({ length: 1000 }, () => compatible.newRequestId());
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach(id => assert.match(id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/));
  });
  check("Missing strong randomness fails clearly instead of using a weak ID", () => {
    assert.throws(() => loadTs("src/dung-chung/tien-ich/browserCrypto.ts", {}, { crypto: undefined }).newRequestId(), /Safari hoặc Chrome/);
  });
  await checkAsync("Missing WebCrypto still keeps the same financial retry key", async () => {
    const calls = []; let fail = true;
    const legacy = apiEnvironment(async config => { calls.push(config); if (fail) throw failure(config, 503); return response(config); }, undefined, legacyCrypto);
    legacy.saveSession(jwt(), "refresh", false);
    await assert.rejects(legacy.default.post("/bookkeeping", { amount: "183000", description: "Mua bình cho em bé" }));
    fail = false;
    await legacy.default.post("/bookkeeping", { amount: "183000", description: "Mua bình cho em bé" });
    assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  });
  check("Public HTTP redirects to HTTPS; forwarded HTTPS and local development do not loop", () => {
    const { NextRequest } = createRequire(import.meta.url)("next/server");
    const { proxy } = loadTs("src/proxy.ts");
    const url = "http://app.capitalflow.online/transactions?test=1";
    assert.equal(proxy(new NextRequest(url, { headers: { host: "app.capitalflow.online", "x-forwarded-proto": "http" } })).headers.get("location"), "https://app.capitalflow.online/transactions?test=1");
    const secure = proxy(new NextRequest(url, { headers: { host: "app.capitalflow.online", "x-forwarded-proto": "https" } }));
    assert.equal(secure.headers.get("location"), null);
    assert.equal(secure.headers.get("strict-transport-security"), "max-age=31536000");
    assert.equal(proxy(new NextRequest("http://localhost:3010/login", { headers: { host: "localhost:3010" } })).headers.get("location"), null);
  });
  const uploads = loadTs("src/chuc-nang/hoa-don-ai/xu-ly/invoiceUpload.ts");
  const image = (name = "invoice.jpg", size = 1024) => ({ name, size });
  check("Three source images each at the 20 MB limit are accepted", () => assert.equal(uploads.invoiceUploadError([
    image("one.jpg", 20 * 1024 * 1024), image("two.PNG", 20 * 1024 * 1024), image("three.webp", 20 * 1024 * 1024),
  ]), ""));
  check("Four images are rejected before upload", () => assert.match(uploads.invoiceUploadError(Array.from({ length: 4 }, () => image())), /tối đa 3 ảnh/));
  check("Mixed image and PDF selection identifies the rejected file", () => assert.match(uploads.invoiceUploadError([image(), image("bill.pdf")]), /bill\.pdf/));
  check("Word documents are rejected", () => assert.match(uploads.invoiceUploadError([image("bill.docx")]), /không phải định dạng ảnh/));
  check("XML intake is rejected", () => assert.match(uploads.invoiceUploadError([image("bill.xml")]), /không phải định dạng ảnh/));
  check("An empty image is rejected", () => assert.match(uploads.invoiceUploadError([image("empty.jpg", 0)]), /tệp rỗng/));
  check("Phone photo over 2 MB is accepted for preparation", () => assert.equal(uploads.invoiceUploadError([image("camera.jpg", 2 * 1024 * 1024 + 1)]), ""));
  await checkAsync("Images at or below the API limit keep their original bytes", async () => {
    const original = image("original.png", 2 * 1024 * 1024);
    assert.equal(await uploads.prepareInvoiceImage(original), original);
  });
  check("One byte over the source image limit is rejected", () => assert.match(uploads.invoiceUploadError([image("large.jpg", 20 * 1024 * 1024 + 1)]), /vượt quá 20 MB/));
  check("Multiple invalid images are all named", () => {
    const error = uploads.invoiceUploadError([image("empty.jpg", 0), image("large.jpg", 20 * 1024 * 1024 + 1)]);
    assert.match(error, /empty\.jpg/); assert.match(error, /large\.jpg/);
  });
  const policy = loadTs("src/dung-chung/xac-thuc/passwordPolicy.ts");
  check("Whitespace is not a password character", () => assert.ok(policy.newPasswordError("a b c d e ")));
  check("Six meaningful characters retain surrounding spaces", () => assert.equal(policy.newPasswordError("  ab cd ef  "), ""));
  check("Unicode codepoints count once", () => assert.equal(policy.passwordCharacterCount("😀😀😀😀😀😀"), 6));
  check("Unicode and Python control whitespace match", () => assert.equal(policy.passwordCharacterCount("a\u0085b\u001cc\u3000"), 3));
  check("Password maximum length", () => assert.ok(policy.newPasswordError("a".repeat(129))));
  const money = loadTs("src/dung-chung/tien-ich/moneyInput.ts");
  for (const [raw, expected] of [["1.234.567,89", "1234567.89"], [" 25.000 đ ", "25000"], ["0,10", "0.10"], ["99999999999999999,99", "99999999999999999.99"]]) {
    check("Parse local decimal " + raw, () => assert.equal(money.parseMoneyInput(raw), expected));
  }
  for (const raw of ["5000.00", "1e6", "-2", "1,001", "999999999999999999", "1.00.000"]) {
    check("Reject ambiguous decimal " + raw, () => assert.equal(money.parseMoneyInput(raw), null));
  }
  check("Format decimal without precision loss", () => assert.equal(money.formatMoneyInput("99999999999999999.99"), "99.999.999.999.999.999,99"));
  const decimal = loadTs("src/dung-chung/tien-ich/decimal.ts");
  check("Decimal trailing zeros", () => assert.equal(decimal.canonicalDecimal("000100.00"), "100"));
  check("Canonical negative zero", () => assert.equal(decimal.canonicalDecimal("-0.00"), "0"));
  check("Distinct large budget limits stay distinct", () => assert.notEqual(decimal.canonicalDecimal("99999999999999999.98"), decimal.canonicalDecimal("99999999999999999.99")));
  const bill = loadTs("src/chuc-nang/vi-tai-khoan/xu-ly/billQr.ts", { "@/dung-chung/connect-api/api": {} });
  check("Bill sum is exact", () => assert.equal(bill.billTotal([{ name: "A", quantity: 3, unit_price: "0.10" }, { name: "B", quantity: 1, unit_price: "0.20" }]), "0.50"));
  check("Large bill price stays exact", () => assert.equal(bill.billTotal([{ name: "A", quantity: 1, unit_price: "99999999999999999.99" }]), "99999999999999999.99"));
  check("Fractional quantity disallowed", () => assert.equal(bill.billTotal([{ name: "A", quantity: 1.2, unit_price: "1" }]), null));
  check("Ambiguous bill price disallowed", () => assert.equal(bill.billTotal([{ name: "A", quantity: 1, unit_price: "1,00" }]), null));

  const seen = [];
  let failNext = false;
  const env = apiEnvironment(async config => {
    seen.push(config);
    if (failNext) { failNext = false; throw failure(config, 503); }
    return response(config);
  });
  env.sessionStorage.setItem("cf-pending-money:other:unresolved", "unresolved-key");
  env.saveSession(jwt(), "refresh-one", true);
  check("Remembered session marker is stored", () => assert.equal(env.sessionStorage.getItem("user_remember"), "1"));
  check("Remembered tokens are stored", () => assert.equal(env.localStorage.getItem("user_refresh_token"), "refresh-one"));
  check("Login preserves unresolved operation", () => assert.equal(env.sessionStorage.getItem("cf-pending-money:other:unresolved"), "unresolved-key"));
  env.clearSession(false, true);
  check("Remembered session restores", () => assert.equal(env.restoreSession(), true));
  check("Restored owner matches", () => assert.equal(env.sessionOwner(), "11111111-1111-4111-8111-111111111111"));
  env.saveSession(jwt(), "refresh-not-saved", false);
  check("Unremembered login removes prior saved tokens", () => assert.equal(env.localStorage.getItem("user_access_token"), null));
  check("Unremembered login removes marker", () => assert.equal(env.sessionStorage.getItem("user_remember"), null));
  await env.default.post("/wallets/x/topup", { amount: "100" });
  const first = seen.at(-1).headers["Idempotency-Key"];
  check("Financial request receives key", () => assert.match(first, /^[\da-f-]{36}$/));
  check("Successful operation removes pending key", () => assert.ok(![...env.sessionStorage.values.values()].includes(first)));
  failNext = true;
  await assert.rejects(env.default.post("/wallets/x/topup", { amount: "200" }));
  const retryKey = seen.at(-1).headers["Idempotency-Key"];
  check("Unknown outcome keeps key", () => assert.ok([...env.sessionStorage.values.values()].includes(retryKey)));
  await env.default.post("/wallets/x/topup", { amount: "200" });
  check("Retry uses the same key", () => assert.equal(seen.at(-1).headers["Idempotency-Key"], retryKey));
  await env.default.post("/wallets/x/topup", { amount: "200" });
  check("New operation after success uses a fresh key", () => assert.notEqual(seen.at(-1).headers["Idempotency-Key"], retryKey));
  await env.default.post("/wallets/bills/resolve", { qr_payload: "test" });
  check("Attached auth matches session", () => assert.equal(seen.at(-1).headers.Authorization, "Bearer " + jwt()));

  // Parallel protected requests share exactly one refresh and both retry with the new access token.
  const refresh = deferred(), bothRejected = deferred();
  let refreshCount = 0, rejected = 0;
  const newAccess = jwt(undefined, "session-one", "renewed");
  const parallel = apiEnvironment(async config => {
    if (config.headers.Authorization !== "Bearer " + newAccess) {
      rejected++; if (rejected === 2) bothRejected.resolve();
      throw failure(config, 401);
    }
    return response(config, 200, { ok: true });
  }, async (url) => {
    if (url.endsWith("/refresh")) { refreshCount++; return refresh.promise; }
    return { data: {} };
  });
  parallel.saveSession(jwt(), "refresh-one", true);
  const a = parallel.default.get("/wallets"), b = parallel.default.get("/budgets");
  await bothRejected.promise;
  refresh.resolve({ data: { access_token: newAccess, refresh_token: "refresh-two" } });
  await Promise.all([a, b]);
  check("Concurrent 401s use one rotation", () => assert.equal(refreshCount, 1));
  check("Remembered rotation persists refresh token", () => assert.equal(parallel.localStorage.getItem("user_refresh_token"), "refresh-two"));

  const refreshFailed = apiEnvironment(async config => { throw failure(config, 401); }, async url => {
    if (url.endsWith("/refresh")) throw failure({ url }, 401);
    return { data: {} };
  });
  refreshFailed.saveSession(jwt(), "refresh-one", true);
  refreshFailed.sessionStorage.setItem("cf-pending-money:user:unknown", "keep-on-expiry");
  await assert.rejects(refreshFailed.default.get("/wallets"));
  check("Denied refresh logs out", () => assert.equal(refreshFailed.location.href, "/login"));
  check("Expired session keeps unresolved money key", () => assert.equal(refreshFailed.sessionStorage.getItem("cf-pending-money:user:unknown"), "keep-on-expiry"));

  const delayed = deferred(), started = deferred();
  const stale = apiEnvironment(async config => {
    started.resolve();
    return await delayed.promise.then(() => response(config));
  });
  stale.saveSession(jwt(), "refresh", false);
  const oldRequest = stale.default.get("/bookkeeping");
  await started.promise;
  stale.saveSession(jwt("22222222-2222-4222-8222-222222222222"), "new-user-refresh", false);
  delayed.resolve();
  await assert.rejects(oldRequest, err => axios.isCancel(err));
  check("Old response is cancelled after user changes", () => assert.equal(stale.sessionOwner(), "22222222-2222-4222-8222-222222222222"));

  const finance = loadTs("src/dung-chung/tien-ich/finance.ts");
  for (const [input, expected] of [["29/02/2024", "2024-02-29"], ["29/02/2000", "2000-02-29"], ["01/01/0001", "0001-01-01"], ["31/12/9999", "9999-12-31"]]) {
    check("Accept Gregorian date " + input, () => assert.equal(finance.parseDateForApi(input), expected));
  }
  for (const input of ["29/02/1900", "29/02/2026", "31/04/2026", "00/01/2026", "01/00/2026", "01/01/0000", "5/11/2026", "05/11/20260"]) {
    check("Reject invalid or incomplete date " + input, () => assert.equal(finance.parseDateForApi(input), null));
  }
  check("ISO paste preserves calendar date", () => assert.equal(finance.formatDateForTyping("2026-11-05"), "05/11/2026"));
  check("Arbitrary pasted text does not become a date", () => assert.equal(finance.parseDateForApi(finance.formatDateForTyping("bill 05112026")), null));
  check("Excess pasted digits do not become a truncated date", () => assert.equal(finance.parseDateForApi(finance.formatDateForTyping("051120260")), null));

  const number = loadTs("src/dung-chung/tien-ich/formValidation.ts");
  check("Bank number keeps leading zeroes and removes invisible separators", () => assert.equal(number.normalizeDemoAccountNumber(" 001\u200b234\u00a0567 "), "001234567"));
  check("Letters are not silently removed from bank numbers", () => assert.equal(number.normalizeDemoAccountNumber("00O 123"), "00O123"));

  // Exercise the actual invoice client without a browser or HTTP server.
  // Each scenario checks a user-visible safety invariant: a retry must neither
  // duplicate an invoice/expense nor cross to another signed-in owner.
  const invoiceStorage = new Storage();
  let invoiceOwner = "owner-a", nextInvoiceStatus = 200;
  const invoiceCalls = [];
  const invoiceApi = loadTs("src/chuc-nang/hoa-don-ai/xu-ly/invoiceApi.ts", {
    "@/dung-chung/connect-api/api": {
      __esModule: true,
      sessionOwner: () => invoiceOwner,
      default: { post: async (url, body, config) => {
        const request = { url, data: body, ...config };
        invoiceCalls.push(request);
        if (nextInvoiceStatus !== 200) throw failure(request, nextInvoiceStatus);
        return { data: { id: "fixture-invoice" } };
      } },
    },
  }, { sessionStorage: invoiceStorage, FormData });
  const confirm = () => invoiceApi.invoiceMutation("fixture-invoice", "record", { total_amount: "184000" });
  for (const status of [401, 408, 429, 503]) {
    await checkAsync("Invoice retry keeps identity after HTTP " + status, async () => {
      nextInvoiceStatus = status;
      await assert.rejects(confirm());
      const key = invoiceCalls.at(-1).headers["Idempotency-Key"];
      assert.ok([...invoiceStorage.values.values()].includes(key));
      nextInvoiceStatus = 200;
      await confirm();
      assert.equal(invoiceCalls.at(-1).headers["Idempotency-Key"], key);
      assert.ok(![...invoiceStorage.values.values()].includes(key));
    });
  }
  for (const status of [409, 422]) {
    await checkAsync("Rejected invoice can be corrected after HTTP " + status, async () => {
      nextInvoiceStatus = status;
      await assert.rejects(confirm());
      const key = invoiceCalls.at(-1).headers["Idempotency-Key"];
      assert.ok(![...invoiceStorage.values.values()].includes(key));
      nextInvoiceStatus = 200;
      await confirm();
      assert.notEqual(invoiceCalls.at(-1).headers["Idempotency-Key"], key);
    });
  }
  check("Invoice confirmation uses the bookkeeping endpoint", () => assert.equal(invoiceCalls.at(-1).url, "/bookkeeping/invoices/fixture-invoice/confirm"));
  await checkAsync("Unresolved invoice does not cross signed-in owners", async () => {
    nextInvoiceStatus = 503;
    await assert.rejects(confirm());
    const keyA = invoiceCalls.at(-1).headers["Idempotency-Key"];
    invoiceOwner = "owner-b";
    nextInvoiceStatus = 200;
    await confirm();
    assert.notEqual(invoiceCalls.at(-1).headers["Idempotency-Key"], keyA);
    assert.ok([...invoiceStorage.values.values()].includes(keyA));
    invoiceOwner = "owner-a";
    await confirm();
    assert.equal(invoiceCalls.at(-1).headers["Idempotency-Key"], keyA);
  });
  await checkAsync("Invoice pending storage contains hashes rather than bill content", async () => {
    nextInvoiceStatus = 503;
    await assert.rejects(invoiceApi.invoiceMutation("fixture-invoice", "record", { merchant_name: "Private fixture merchant", total_amount: "184000" }));
    const stored = JSON.stringify([...invoiceStorage.values]);
    assert.ok(!stored.includes("Private fixture merchant"));
    assert.ok(!stored.includes("184000"));
    for (const key of invoiceStorage.values.keys()) assert.match(key, /^cf-pending-invoice:owner-a:[0-9a-f]{64}$/);
  });
  check("Invoice transport failure explains safe retry", () => assert.equal(invoiceApi.invoiceError(failure({}, 503)).code, "INVOICE_RETRY_REQUIRED"));
  check("Invoice structured validation reaches the form", () => assert.equal(invoiceApi.invoiceError(new axios.AxiosError("bad", undefined, {}, {}, { data: { detail: { code: "INVOICE_INCOMPLETE", message: "Bổ sung thông tin" } } })).message, "Bổ sung thông tin"));

  const report = { passed, checks, browser_independent: true, real_requests: 0, completed_at: new Date().toISOString() };
  const reportIndex = process.argv.indexOf("--report");
  if (reportIndex >= 0) {
    if (!process.argv[reportIndex + 1]) throw new Error("--report requires an output filename");
    fs.writeFileSync(path.resolve(process.argv[reportIndex + 1]), JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify({ passed, browser_independent: true, real_requests: 0 }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
