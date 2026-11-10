/* global self, indexedDB, FormData, BroadcastChannel, AbortController, crypto, fetch, setInterval, clearInterval, setTimeout, clearTimeout */
"use strict";

const backgroundKey = "__background_upload";
const syncTag = "capitalflow-invoice-upload";
const pendingStates = new Set(["waiting", "retry", "sending"]);
let running;
let activeUpload;

function openQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("capitalflow-invoice-queue", 1);
    request.onupgradeneeded = () => {
      const images = request.result.createObjectStore("images", { keyPath: "id" });
      images.createIndex("scope", "scope");
      request.result.createObjectStore("settings", { keyPath: "scope" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, operation) {
  const db = await openQueue();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["settings", "images"], mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error);
      operation(tx.objectStore("settings"), tx.objectStore("images"), value => { result = value; });
    });
  } finally {
    db.close();
  }
}

const setting = key => transaction("readonly", (settings, _, done) => {
  const row = settings.get(key);
  row.onsuccess = () => done(row.result);
});

function claim() {
  return transaction("readwrite", (settings, images, done) => {
    const active = settings.get(backgroundKey);
    active.onsuccess = () => {
      const grant = active.result;
      if (!grant || !grant.value || grant.expiresAt <= Date.now()) return;
      const queue = settings.get(grant.queueScope);
      const rows = images.index("scope").getAll(grant.queueScope);
      rows.onsuccess = () => {
        if (queue.result?.paused) return;
        const now = Date.now();
        const waiting = rows.result.filter(job => pendingStates.has(job.state));
        const job = waiting.sort((a, b) => a.createdAt - b.createdAt)
          .find(job => job.nextAttempt <= now && job.leaseUntil <= now);
        if (!job) { done({ pending: waiting.length > 0 }); return; }
        job.state = "sending";
        job.leaseId = crypto.randomUUID();
        job.leaseUntil = now + 60_000;
        images.put(job);
        done({ job, grant });
      };
    };
  });
}

function update(job, changes) {
  return transaction("readwrite", (_, images, done) => {
    const row = images.get(job.id);
    row.onsuccess = () => {
      if (row.result?.leaseId !== job.leaseId) return;
      images.put({ ...row.result, ...changes });
      done(true);
      if (changes.state !== "done") return;
      const scope = images.index("scope").getAll(job.scope);
      scope.onsuccess = () => scope.result.filter(item => item.state === "done")
        .sort((a, b) => b.createdAt - a.createdAt).slice(20).forEach(item => images.delete(item.id));
    };
  });
}

function announce(scope) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("capitalflow-invoice-queue");
  channel.postMessage(scope);
  channel.close();
}

async function grantStillActive(grant) {
  const current = await setting(backgroundKey);
  return current?.sessionId === grant.sessionId && current.queueScope === grant.queueScope &&
    current.expiresAt > Date.now() && !(await setting(grant.queueScope))?.paused;
}

async function upload(job, grant) {
  const controller = new AbortController();
  activeUpload = { controller, grant };
  const heartbeat = setInterval(() => {
    Promise.all([grantStillActive(grant), update(job, { leaseUntil: Date.now() + 60_000 })])
      .then(([valid, owned]) => { if (!valid || !owned) controller.abort(); }, () => controller.abort());
  }, 15_000);
  const timeout = setTimeout(() => controller.abort("timeout"), 120_000);
  const release = { leaseId: undefined, leaseUntil: 0 };
  try {
    if (!(await grantStillActive(grant))) {
      await update(job, { ...release, state: "waiting" });
      return;
    }
    if (!job.blob) {
      await update(job, { ...release, state: "attention", issue: { message: "Ảnh chờ không còn dữ liệu. Hãy chọn lại ảnh gốc." } });
      return;
    }
    const form = new FormData();
    form.append("file", job.blob, job.name);
    form.append("source", "UPLOAD");
    if (job.uploadTicket) {
      form.append("upload_ticket", job.uploadTicket);
      form.append("accept_distinct", "true");
    }
    const response = await fetch("/api/v1/invoices", {
      method: "POST", body: form, signal: controller.signal, redirect: "error", credentials: "omit",
      headers: { Authorization: `Bearer ${grant.value}`, "Idempotency-Key": job.requestKey },
    });
    const result = await response.json().catch(() => null);
    if (response.ok) {
      if (!result?.id || !["CREATED", "REUSED_DRAFT", "ALREADY_CONFIRMED", "RESTORE_REQUIRED"].includes(result.outcome)) {
        throw new Error("Unconfirmed upload result");
      }
      const hidden = result.outcome === "RESTORE_REQUIRED";
      await update(job, {
        ...release, state: hidden ? "attention" : "done", result,
        blob: hidden ? job.blob : undefined, uploadTicket: undefined,
        issue: hidden ? { message: "Ảnh đã có trong thùng rác. Hãy mở hóa đơn để khôi phục." } : undefined,
      });
      return;
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) throw new Error("Temporary upload failure");
    const detail = result?.detail;
    const issue = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : {
      message: typeof detail === "string" ? detail : "Ảnh cần được kiểm tra trước khi gửi lại.",
    };
    const auth = response.status === 401;
    await update(job, {
      ...release, state: auth ? "auth" : "attention", issue,
      uploadTicket: issue.code === "UPLOAD_TICKET_EXPIRED" ? undefined : job.uploadTicket,
    });
    if (auth) {
      await transaction("readwrite", settings => {
        const row = settings.get(backgroundKey);
        row.onsuccess = () => { if (row.result?.value === grant.value) settings.delete(backgroundKey); };
      });
    }
  } catch (error) {
    const valid = await grantStillActive(grant);
    if (!valid) { await update(job, { ...release, state: "waiting" }); return; }
    const attempts = job.attempts + 1;
    await update(job, {
      ...release, state: "retry", attempts,
      nextAttempt: Date.now() + Math.min(900_000, 15_000 * 2 ** Math.min(attempts - 1, 6)),
      issue: { message: "Chưa gửi xong ảnh. Hệ thống sẽ thử lại." },
    });
    throw error;
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timeout);
    activeUpload = undefined;
    announce(job.scope);
  }
}

async function drain() {
  // Bound work per event. A rejected sync requests another browser retry.
  for (let index = 0; index < 3; index++) {
    const claimResult = await claim();
    if (!claimResult?.job) {
      if (claimResult?.pending) throw new Error("Waiting for upload lease or retry time");
      return;
    }
    await upload(claimResult.job, claimResult.grant);
  }
  await self.registration.sync?.register(syncTag);
}

self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
  // Retire subscriptions created by the previous worker without touching the invoice queue.
  event.waitUntil(Promise.allSettled([
    transaction("readwrite", settings => settings.delete("__push_registration")),
    self.registration.pushManager?.getSubscription().then(subscription => subscription?.unsubscribe()),
    self.registration.getNotifications?.().then(notices => {
      for (const notice of notices) {
        if (notice.tag.startsWith("capitalflow-") && notice.data?.sessionId) notice.close();
      }
    }),
  ]));
});
self.addEventListener("sync", event => {
  if (event.tag !== syncTag) return;
  running ??= drain().finally(() => { running = undefined; });
  event.waitUntil(running);
});
self.addEventListener("message", event => {
  if (event.data?.type !== "capitalflow-session-revoked") return;
  const { sessionId, queueScope } = event.data;
  if (activeUpload?.grant.sessionId === sessionId) activeUpload.controller.abort();
  event.waitUntil(transaction("readwrite", settings => {
    const row = settings.get(backgroundKey);
    row.onsuccess = () => {
      if (row.result?.sessionId === sessionId && row.result.queueScope === queueScope) {
        settings.delete(backgroundKey);
      }
    };
  }));
});
