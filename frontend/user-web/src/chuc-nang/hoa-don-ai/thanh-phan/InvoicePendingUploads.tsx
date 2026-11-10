"use client";

import { useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import InvoiceIntakeFeedback from "./InvoiceIntakeFeedback";
import { useInvoiceUploadQueue } from "../xu-ly/InvoiceUploadQueue";
import type { QueueState } from "../xu-ly/invoiceQueueStore";
import styles from "../CSS/InvoicePendingUploads.module.css";

const labels: Record<QueueState, string> = {
  waiting: "Chờ gửi", sending: "Đang nhận diện và đối chiếu", retry: "Chờ thử lại",
  attention: "Cần kiểm tra", auth: "Cần đăng nhập lại", done: "Đã tiếp nhận",
};

export default function InvoicePendingUploads({ onOpen }: { onOpen: (id: string) => void }) {
  const queue = useInvoiceUploadQueue();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = queue.jobs.filter(job => job.state !== "done");
  const visibleJobs = [...pending, ...queue.jobs.filter(job => job.state === "done")];
  const entries = useMemo(() => queue.jobs.map(job => ({
    job,
    file: new File(job.blob ? [job.blob] : [], job.name, { type: job.type, lastModified: job.lastModified }),
    result: job.result,
    issue: job.issue,
    error: job.state === "attention" ? job.issue?.message : undefined,
  })), [queue.jobs]);
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Chưa hoàn tất thao tác. Hãy thử lại."); }
    finally { setBusy(false); }
  };
  if (!queue.ready && !queue.error) return <p className="cf-muted" role="status">Đang mở ảnh chờ trên thiết bị…</p>;
  if (!queue.jobs.length && !queue.error && !error) return null;
  return <section className={styles.queue} aria-label="Ảnh chờ trên thiết bị">
    <header className={styles.header}>
      <div>
        <h2>Ảnh chờ trên thiết bị</h2>
        <p>{queue.paused ? "Đã tạm dừng gửi ảnh." : !queue.online ? "Đang ngoại tuyến. Ảnh được giữ để gửi khi có mạng." : "Ảnh được gửi tự động khi bạn mở web và có mạng."}</p>
        <p>{pending.length} ảnh chưa hoàn tất · Tối đa 20 ảnh, 40 MiB</p>
      </div>
      {!!pending.length && <button type="button" className="cf-btn cf-btn-sm" disabled={busy}
        onClick={() => void act(() => queue.pause(!queue.paused))}>
        {queue.paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        {queue.paused ? "Tiếp tục gửi" : "Tạm dừng"}
      </button>}
    </header>
    {(error || queue.error) && <p className={styles.error} role="alert">{error || queue.error}</p>}
    <ul className={styles.list}>
      {visibleJobs.map(job => <li key={job.id}>
        <div className={styles.description}>
          <strong>{job.name}</strong>
          <span role="status">{labels[job.state]}{job.state === "waiting" && queue.paused ? " · Đã tạm dừng" : ""}</span>
          {job.state === "retry" && <small>Ảnh vẫn được giữ. Hệ thống sẽ tự thử lại khi kết nối ổn định.</small>}
        </div>
        <div className={styles.actions}>
          {job.result && <button type="button" className="cf-btn cf-btn-sm" onClick={() => onOpen(job.result!.id)}>Mở hóa đơn</button>}
          {["retry", "auth"].includes(job.state) && <button type="button" className="cf-icon-btn" disabled={busy}
            title="Thử lại" aria-label={`Thử lại ${job.name}`} onClick={() => void act(() => queue.retry(job.id))}>
            <RotateCcw size={16} aria-hidden="true" />
          </button>}
          <button type="button" className="cf-icon-btn" disabled={busy || job.state === "sending"}
            title={job.state === "done" ? "Bỏ khỏi danh sách trên thiết bị" : "Bỏ ảnh chờ"}
            aria-label={`Bỏ ảnh ${job.name}`} onClick={() => void act(() => queue.remove(job.id))}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </li>)}
    </ul>
    <InvoiceIntakeFeedback entries={entries} progress={null} busy={busy} checking={false}
      onOpen={onOpen}
      onRetry={(file, ticket) => {
        const entry = entries.find(entry => entry.file === file);
        if (entry) void act(() => queue.retry(entry.job.id, ticket));
      }}
      onRemove={file => {
        const entry = entries.find(entry => entry.file === file);
        if (entry) void act(() => queue.remove(entry.job.id));
      }} />
    {!!pending.length && <p className={styles.note}>Ảnh chờ được lưu cho tài khoản này trong trình duyệt hiện tại. Xóa dữ liệu trang web sẽ xóa các ảnh chưa gửi.</p>}
  </section>;
}
