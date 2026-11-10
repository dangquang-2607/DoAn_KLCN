import { newRequestId } from "@/dung-chung/tien-ich/browserCrypto";
import type { UploadIssue, UploadResult } from "./InvoiceTypes";

export type QueueState = "waiting" | "sending" | "retry" | "attention" | "auth" | "done";
export type QueuedImage = {
  id: string;
  scope: string;
  name: string;
  type: string;
  lastModified: number;
  blob?: Blob;
  hash: string;
  requestKey: string;
  state: QueueState;
  createdAt: number;
  attempts: number;
  nextAttempt: number;
  leaseId?: string;
  leaseUntil: number;
  uploadTicket?: string;
  issue?: UploadIssue;
  result?: UploadResult;
};
type Settings = { scope: string; paused: boolean };
export type QueueSnapshot = { jobs: QueuedImage[]; paused: boolean };
type PreparedImage = { file: File; hash: string };
const databaseName = "capitalflow-invoice-queue";
const leaseDuration = 60_000;
let database: Promise<IDBDatabase> | undefined;

export type WorkerSetting = {
  scope: string; queueScope: string; sessionId: string;
  value?: string; expiresAt?: number;
};

export async function workerSetting(key: string, change?: (previous?: WorkerSetting) => WorkerSetting | null | undefined): Promise<WorkerSetting | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", change ? "readwrite" : "readonly");
    const store = tx.objectStore("settings");
    const row = store.get(key);
    row.onsuccess = () => {
      const value = change?.(row.result);
      if (value === null) store.delete(key);
      else if (value !== undefined) store.put(value);
    };
    tx.oncomplete = () => resolve(row.result);
    tx.onabort = () => reject(tx.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Trình duyệt chưa hỗ trợ lưu ảnh chờ. Hãy mở bằng trình duyệt có hỗ trợ IndexedDB."));
  }
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const jobs = request.result.createObjectStore("images", { keyPath: "id" });
      jobs.createIndex("scope", "scope");
      request.result.createObjectStore("settings", { keyPath: "scope" });
    };
    request.onerror = () => reject(new Error("Trình duyệt chưa mở được bộ nhớ ảnh chờ. Hãy kiểm tra quyền lưu dữ liệu trang web rồi tải lại."));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Hãy đóng tab CapitalFlow cũ rồi thử lại hàng đợi ảnh."));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
  }).catch((error) => { database = undefined; throw error; });
  return database;
}

// Read, choose and write within one transaction so different tabs cannot claim the same image.
async function transact<T>(scope: string, write: boolean, change: (
  jobs: QueuedImage[], settings: Settings, images: IDBObjectStore, preferences: IDBObjectStore,
) => T): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["images", "settings"], write ? "readwrite" : "readonly");
    const images = tx.objectStore("images");
    const preferences = tx.objectStore("settings");
    const rows = images.index("scope").getAll(scope);
    const setting = preferences.get(scope);
    let result: T;
    let failure: unknown;
    setting.onsuccess = () => {
      try {
        result = change(rows.result, setting.result ?? { scope, paused: false }, images, preferences);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Chưa lưu được ảnh trên thiết bị. Hãy thử lại."));
    tx.onerror = () => { /* onabort reports the transaction error. */ };
  });
}

export function readQueue(scope: string): Promise<QueueSnapshot> {
  return transact(scope, false, (jobs, settings) => ({
    jobs: jobs.sort((a, b) => a.createdAt - b.createdAt),
    paused: settings.paused,
  }));
}

export function addImages(scope: string, files: PreparedImage[], validSession: () => boolean) {
  return transact(scope, true, (jobs, _settings, images) => {
    if (!validSession()) throw new Error("Phiên đăng nhập đã thay đổi. Hãy chọn lại ảnh.");
    const pending = jobs.filter(job => job.state !== "done");
    const additions: QueuedImage[] = [];
    const createdAt = Math.max(Date.now(), ...jobs.map(job => job.createdAt + 1));
    for (const { file, hash } of files) {
      if ([...pending, ...additions].some(job => job.hash === hash)) continue;
      if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("Ảnh chờ gửi phải có dung lượng từ 1 byte đến 2 MiB.");
      additions.push({
        id: newRequestId(), scope, name: file.name, type: file.type,
        lastModified: file.lastModified, blob: file, hash, requestKey: newRequestId(),
        state: "waiting", createdAt: createdAt + additions.length, attempts: 0, nextAttempt: 0, leaseUntil: 0,
      });
    }
    const size = [...pending, ...additions].reduce((sum, job) => sum + (job.blob?.size ?? 0), 0);
    if (pending.length + additions.length > 20 || size > 40 * 1024 * 1024) {
      throw new Error("Hàng đợi đã đầy. Hãy gửi hoặc bỏ bớt ảnh chờ trước khi thêm (tối đa 20 ảnh, 40 MiB).");
    }
    additions.forEach(job => images.put(job));
    return additions.length;
  });
}

export function claimImage(scope: string, validSession: () => boolean) {
  return transact(scope, true, (jobs, settings, images) => {
    if (settings.paused || !validSession()) return;
    const now = Date.now();
    const job = jobs.sort((a, b) => a.createdAt - b.createdAt).find(job =>
      ["waiting", "retry", "sending"].includes(job.state) &&
      job.nextAttempt <= now && job.leaseUntil <= now);
    if (!job) return;
    job.state = "sending";
    job.leaseId = newRequestId();
    job.leaseUntil = now + leaseDuration;
    images.put(job);
    return job;
  });
}

export function updateClaim(job: QueuedImage, values: Partial<QueuedImage>) {
  return transact(job.scope, true, (jobs, _settings, images) => {
    const current = jobs.find(item => item.id === job.id);
    if (!current || current.leaseId !== job.leaseId) return;
    images.put({ ...current, ...values });
    if (values.state === "done") {
      jobs.filter(item => item.state === "done").sort((a, b) => b.createdAt - a.createdAt)
        .slice(19).forEach(item => images.delete(item.id));
    }
  });
}

export function renewClaim(job: QueuedImage) {
  return updateClaim(job, { leaseUntil: Date.now() + leaseDuration });
}

export function releaseClaim(job: QueuedImage) {
  return updateClaim(job, { state: "waiting", leaseId: undefined, leaseUntil: 0 });
}

export function pauseQueue(scope: string, paused: boolean) {
  return transact(scope, true, (_jobs, settings, _images, preferences) => {
    preferences.put({ ...settings, paused });
  });
}

export function retryImage(scope: string, id: string, ticket?: string) {
  return transact(scope, true, (jobs, _settings, images) => {
    const job = jobs.find(item => item.id === id);
    if (!job || job.state === "done" || job.leaseUntil > Date.now()) return;
    if (ticket && ticket !== job.issue?.upload_ticket) throw new Error("Kết quả đối chiếu đã thay đổi. Hãy mở lại ảnh chờ.");
    images.put({
      ...job, state: "waiting", nextAttempt: 0, issue: undefined,
      uploadTicket: ticket, leaseId: undefined, leaseUntil: 0,
    });
  });
}

export function resumeAuthentication(scope: string) {
  return transact(scope, true, (jobs, _settings, images) => {
    jobs.filter(job => job.state === "auth").forEach(job =>
      images.put({ ...job, state: "waiting", nextAttempt: 0 }));
  });
}

export function removeImage(scope: string, id: string) {
  return transact(scope, true, (jobs, _settings, images) => {
    const job = jobs.find(item => item.id === id);
    if (job && job.leaseUntil > Date.now()) throw new Error("Ảnh đang gửi. Hãy tạm dừng hàng đợi rồi bỏ ảnh.");
    images.delete(id);
  });
}
