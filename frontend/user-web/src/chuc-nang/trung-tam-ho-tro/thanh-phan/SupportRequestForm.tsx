"use client";

import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import type { Profile } from "@/dung-chung/nghiep-vu/finance";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import { Alert, ErrorState, Field, Loading, Panel } from "@/dung-chung/UI-chung/ui";
import styles from "../CSS/support.module.css";
import { newRequestId } from "@/dung-chung/tien-ich/browserCrypto";

export default function SupportRequestForm() {
  const profile = useQuery<Profile>({ queryKey: ["user-me"], queryFn: async () => (await api.get("/auth/me")).data });
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const pending = useRef(false);
  const submission = useRef<{ id: string; title: string; message: string } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || !profile.data) return;
    const values = { title: title.trim(), message: message.trim() };
    if (values.title.length < 4 || values.message.length < 10) {
      setError("Nhập tiêu đề từ 4 ký tự và mô tả từ 10 ký tự.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      if (!submission.current || submission.current.title !== values.title || submission.current.message !== values.message) {
        submission.current = { ...values, id: newRequestId() };
      }
      await api.post("/support/requests", { request_id: submission.current.id, ...values });
      setSent(true);
      setTitle("");
      setMessage("");
      submission.current = null;
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <Panel title="Gửi yêu cầu hỗ trợ" className={styles.requestPanel}>
      <div className="cf-panel-body">
        {profile.isPending ? <Loading /> : profile.isError ? <ErrorState retry={() => profile.refetch()} /> : (
          <form className={styles.requestForm} onSubmit={submit} aria-busy={busy}>
            <Field label="Tiêu đề">
              <input className="cf-input" required minLength={4} maxLength={100} value={title} disabled={busy}
                placeholder="Ví dụ: Giao dịch chưa xuất hiện trong lịch sử"
                onChange={event => { setTitle(event.target.value); setSent(false); }} />
            </Field>
            <Field label="Mô tả vấn đề">
              <textarea className="cf-input" rows={3} required minLength={10} maxLength={1500} value={message} disabled={busy}
                placeholder="Mô tả điều bạn gặp phải và thời điểm xảy ra."
                onChange={event => { setMessage(event.target.value); setSent(false); }} />
            </Field>
            {error && <Alert persistent>{error}</Alert>}
            {sent && <p role="status" className={styles.sent}>Đã tiếp nhận yêu cầu. Phản hồi sẽ được gửi đến email tài khoản của bạn.</p>}
            <div className={styles.formActions}>
              <p><Mail size={16} aria-hidden="true" />Nhận phản hồi tại <strong>{profile.data?.email}</strong></p>
              <button type="submit" className="cf-btn cf-btn-primary" disabled={busy}>
                <Send size={16} aria-hidden="true" />{busy ? "Đang gửi…" : "Gửi yêu cầu"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}
