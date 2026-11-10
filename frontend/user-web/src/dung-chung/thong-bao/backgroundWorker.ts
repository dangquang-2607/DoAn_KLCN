import api, { sessionFamily } from "@/dung-chung/connect-api/api";
import { resumeAuthentication, workerSetting } from "@/chuc-nang/hoa-don-ai/xu-ly/invoiceQueueStore";

const uploadKey = "__background_upload";
type SyncRegistration = ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
let worker: Promise<SyncRegistration | undefined> | undefined;

export function backgroundWorker(): Promise<SyncRegistration | undefined> {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return Promise.resolve(undefined);
  worker ??= navigator.serviceWorker.register("/capitalflow-sw.js", { scope: "/", updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready).catch(() => { worker = undefined; return undefined; });
  return worker;
}

export function revokeWorkerSession(sessionId: string, queueScope: string) {
  const data = { type: "capitalflow-session-revoked", sessionId, queueScope };
  navigator.serviceWorker?.controller?.postMessage(data);
  return workerSetting(uploadKey, previous =>
    previous?.sessionId === sessionId && previous.queueScope === queueScope ? null : undefined);
}

export async function syncInvoiceWorker(queueScope: string, sessionId: string, valid: () => boolean, hasPending: boolean) {
  const registration = await backgroundWorker();
  if (!registration?.sync || !valid()) return;
  const existing = await workerSetting(uploadKey);
  if (!valid()) return;
  const currentGrant = existing?.sessionId === sessionId && existing.queueScope === queueScope ? existing : undefined;
  if (hasPending && (currentGrant?.expiresAt ?? 0) > Date.now()) {
    await registration.sync.register("capitalflow-invoice-upload");
  }
  if ((!currentGrant || (currentGrant.expiresAt ?? 0) < Date.now() + 30 * 60_000) && navigator.onLine) {
    // Activate only the signed-in scope. Credentials cannot be reused for another account.
    const { data } = await api.post<{ grant: string; session_id: string; expires_at: string }>("/invoices/background-grant", undefined, { timeout: 5000 });
    if (!valid() || data.session_id !== sessionId || sessionFamily() !== sessionId) return;
    const expiresAt = Date.parse(data.expires_at);
    if (!data.grant || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
    await workerSetting(uploadKey, () => valid() ? { scope: uploadKey, queueScope, sessionId, expiresAt, value: data.grant } : undefined);
    if (valid()) await resumeAuthentication(queueScope);
    if (valid() && hasPending) await registration.sync.register("capitalflow-invoice-upload");
  }
}

