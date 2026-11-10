"use client";

import axios from "axios";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api, { sessionFamily, sessionOwner } from "@/dung-chung/connect-api/api";
import { revokeWorkerSession, syncInvoiceWorker } from "@/dung-chung/thong-bao/backgroundWorker";
import { sha256Hex } from "@/dung-chung/tien-ich/browserCrypto";
import { invoiceUploadError, prepareInvoiceImage } from "./invoiceUpload";
import { invoiceError, uploadInvoice } from "./invoiceApi";
import {
  addImages, claimImage, pauseQueue, readQueue, releaseClaim, removeImage,
  renewClaim, resumeAuthentication, retryImage, updateClaim,
  type QueueSnapshot,
} from "./invoiceQueueStore";

type UploadQueue = QueueSnapshot & {
  ready: boolean;
  online: boolean;
  error: string;
  enqueue: (files: File[]) => Promise<number>;
  retry: (id: string, ticket?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  pause: (paused: boolean) => Promise<void>;
};
const QueueContext = createContext<UploadQueue | null>(null);

export function useInvoiceUploadQueue() {
  const queue = useContext(QueueContext);
  if (!queue) throw new Error("Hàng đợi ảnh cần được mở trong tài khoản đã đăng nhập.");
  return queue;
}

export default function InvoiceUploadQueue({ owner, enabled, children }: {
  owner: string; enabled: boolean; children: ReactNode;
}) {
  const cache = useQueryClient();
  const [snapshot, setSnapshot] = useState<QueueSnapshot>({ jobs: [], paused: false });
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const runtime = useRef<{
    scope: string;
    valid: () => boolean;
    changed: () => void;
    stopRequest: () => void;
    scheduleWorker: (pending: boolean) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const scope = new URL(api.defaults.baseURL || "/api/v1", location.origin).href + "|" + owner;
    const family = sessionFamily();
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("capitalflow-invoice-queue");
    let active = true;
    let running = false;
    let readVersion = 0;
    let request: AbortController | null = null;
    let workerUpdate: Promise<void> | undefined;
    let schedulePending = false;
    let lastGrantCheck = 0;
    const valid = () => {
      if (!active || !sessionStorage.getItem("user_access_token")) return false;
      try { return sessionOwner() === owner; } catch { return false; }
    };
    const scheduleWorker = (pending: boolean) => {
      if (!family || !valid()) return Promise.resolve();
      if (workerUpdate) {
        schedulePending ||= pending;
        return workerUpdate;
      }
      if (!pending && Date.now() - lastGrantCheck < 5 * 60_000) return Promise.resolve();
      lastGrantCheck = Date.now();
      workerUpdate = (async () => {
        do {
          schedulePending = false;
          await syncInvoiceWorker(scope, family, valid, pending)
            .catch(() => { /* The foreground runner remains available. */ });
          pending = schedulePending;
        } while (pending && valid());
      })().finally(() => { workerUpdate = undefined; });
      return workerUpdate;
    };
    const reportError = (failure: unknown) => {
      if (active) {
        const message = failure instanceof Error && failure.name === "QuotaExceededError"
          ? "Trình duyệt không còn chỗ lưu ảnh. Hãy bỏ bớt ảnh chờ hoặc giải phóng dung lượng rồi thử lại."
          : failure instanceof Error ? failure.message : "Chưa mở được hàng đợi ảnh trên thiết bị. Hãy thử tải lại trang.";
        setError(message);
      }
    };
    const refresh = async () => {
      const version = ++readVersion;
      const next = await readQueue(scope);
      if (!active || version !== readVersion) return;
      setSnapshot(next);
      setReady(true);
      setError("");
      if (next.paused) request?.abort();
      const pending = !next.paused && next.jobs.some(job => ["waiting", "sending", "retry"].includes(job.state));
      void scheduleWorker(pending);
    };
    const broadcast = () => channel?.postMessage(scope);
    const run = async () => {
      if (!valid()) return;
      if (running) {
        await refresh().catch(reportError);
        return;
      }
      running = true;
      try {
        await refresh();
        while (valid() && navigator.onLine) {
          const job = await claimImage(scope, valid);
          if (!job) break;
          if (!valid()) { await releaseClaim(job); break; }
          request = new AbortController();
          const controller = request;
          const heartbeat = setInterval(() => {
            void renewClaim(job).catch(() => controller.abort());
          }, 15000);
          broadcast();
          try {
            await refresh();
            if (controller.signal.aborted || !valid()) {
              await releaseClaim(job);
              break;
            }
            if (!job.blob) throw new Error("Ảnh chờ không còn dữ liệu. Hãy bỏ ảnh này và chọn lại tệp gốc.");
            const file = new File([job.blob], job.name, { type: job.type, lastModified: job.lastModified });
            const result = await uploadInvoice(file, job.uploadTicket, {
              owner, requestKey: job.requestKey, signal: controller.signal,
            });
            if (!result?.id || !["CREATED", "REUSED_DRAFT", "ALREADY_CONFIRMED", "RESTORE_REQUIRED"].includes(result.outcome)) {
              throw new Error("Chưa xác định kết quả tải ảnh. Hệ thống sẽ thử lại bằng cùng yêu cầu.");
            }
            if (!valid()) { await releaseClaim(job); break; }
            const hidden = result.outcome === "RESTORE_REQUIRED";
            await updateClaim(job, {
              state: hidden ? "attention" : "done", result,
              blob: hidden ? job.blob : undefined,
              issue: hidden ? { message: "Bản cũ đang trong Thùng rác. Mở hóa đơn để khôi phục, sau đó thử lại ảnh này." } : undefined,
              uploadTicket: undefined, leaseId: undefined, leaseUntil: 0,
            });
            for (const key of ["invoices", "invoice", "subscription", "notifications"]) {
              void cache.invalidateQueries({ queryKey: [key] });
            }
          } catch (failure) {
            if (controller.signal.aborted || !valid()) {
              await releaseClaim(job);
              break;
            }
            const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
            const retry = !status || [408, 429].includes(status) || status >= 500;
            const issue = invoiceError(failure);
            const attempts = job.attempts + 1;
            await updateClaim(job, {
              state: status === 401 ? "auth" : retry ? "retry" : "attention",
              issue, attempts, nextAttempt: Date.now() + Math.min(900000, 15000 * 2 ** Math.min(attempts - 1, 6)),
              uploadTicket: issue.code === "UPLOAD_TICKET_EXPIRED" ? undefined : job.uploadTicket,
              leaseId: undefined, leaseUntil: 0,
            });
            if (retry || status === 401) break;
          } finally {
            clearInterval(heartbeat);
            request = null;
            broadcast();
            await refresh();
          }
        }
      } catch (failure) { reportError(failure); }
      finally { running = false; }
    };
    const changed = () => { broadcast(); void run(); };
    const stopRequest = () => request?.abort();
    const sessionChanged = () => {
      active = false;
      stopRequest();
      if (family) void revokeWorkerSession(family, scope).catch(() => {});
    };
    const connectionChanged = () => {
      if (active) setOnline(navigator.onLine);
      if (!navigator.onLine) stopRequest();
      else void run();
    };
    runtime.current = { scope, valid, changed, stopRequest, scheduleWorker };
    const poll = setInterval(() => void run(), 5000);
    channel?.addEventListener("message", (event) => { if (event.data === scope) void run(); });
    window.addEventListener("online", connectionChanged);
    window.addEventListener("offline", connectionChanged);
    window.addEventListener("focus", changed);
    window.addEventListener("capitalflow-session-changed", sessionChanged);
    window.addEventListener("pagehide", stopRequest);
    queueMicrotask(() => {
      if (!active) return;
      setOnline(navigator.onLine);
      void resumeAuthentication(scope).then(() => run()).catch(reportError);
    });
    return () => {
      active = false;
      stopRequest();
      runtime.current = null;
      clearInterval(poll);
      channel?.close();
      window.removeEventListener("online", connectionChanged);
      window.removeEventListener("offline", connectionChanged);
      window.removeEventListener("focus", changed);
      window.removeEventListener("capitalflow-session-changed", sessionChanged);
      window.removeEventListener("pagehide", stopRequest);
    };
  }, [owner, enabled, cache]);

  const current = () => {
    const value = runtime.current;
    if (!value?.valid()) throw new Error("Hãy đăng nhập lại để tiếp tục ảnh chờ.");
    return value;
  };
  const enqueue = async (files: File[]) => {
    const runtime = current();
    const problem = invoiceUploadError(files);
    if (problem) throw new Error(problem);
    const prepared = [];
    for (const file of files) {
      const image = await prepareInvoiceImage(file);
      prepared.push({ file: image, hash: await sha256Hex(await image.arrayBuffer()) });
    }
    let count: number;
    try {
      count = await addImages(runtime.scope, prepared, runtime.valid);
    } catch (failure) {
      if (failure instanceof DOMException && ["QuotaExceededError", "SecurityError"].includes(failure.name)) {
        throw new Error("Trình duyệt chưa lưu được ảnh trên thiết bị. Hãy kiểm tra dung lượng và quyền lưu dữ liệu trang web rồi chọn lại ảnh.");
      }
      throw failure;
    }
    setError("");
    runtime.changed();
    if (count > 0) {
      // Prefer registering Sync before confirming intake. A slow or unavailable
      // service worker must not prevent saving an image for foreground retry.
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([runtime.scheduleWorker(true), new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); })]);
      clearTimeout(timer);
    }
    return count;
  };
  const retry = async (id: string, ticket?: string) => {
    const runtime = current();
    await retryImage(runtime.scope, id, ticket);
    runtime.changed();
  };
  const remove = async (id: string) => {
    const runtime = current();
    await removeImage(runtime.scope, id);
    runtime.changed();
  };
  const pause = async (paused: boolean) => {
    const runtime = current();
    await pauseQueue(runtime.scope, paused);
    if (paused) runtime.stopRequest();
    runtime.changed();
  };

  return <QueueContext.Provider value={{ ...snapshot, ready, online, error, enqueue, retry, remove, pause }}>
    {children}
  </QueueContext.Provider>;
}
