import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import api from "../../dung-chung/connect-api/api";
import { Alert, Empty, ErrorState, Field, Loading, Pagination, Panel } from "../../dung-chung/UI-chung/ui";
import { errorMessage, timestamp } from "../../dung-chung/tien-ich/format";
import styles from "./CSS/SupportCases.module.css";

const supportPath = "/admin/support-requests";
const statuses = { NEW: "Chưa phản hồi", QUEUED: "Đang gửi email", SENT: "Đã gửi email", FAILED: "Gửi email thất bại", UNKNOWN: "Cần kiểm tra kết quả gửi" };
const requestCode = id => `HT-${id.slice(0, 8).toUpperCase()}`;

function RequestDetail({ id, refresh }) {
  const cache = useQueryClient();
  const pending = useRef(false);
  const [reply, setReply] = useState("");
  const query = useQuery({
    queryKey: ["support-request", id],
    queryFn: async ({ signal }) => (await api.get(`${supportPath}/${id}`, { signal })).data,
    refetchInterval: query => query.state.data?.reply_status === "QUEUED" ? 3000 : false,
  });
  const mutation = useMutation({
    mutationFn: content => api.post(`${supportPath}/${id}/reply`, { reply: content }),
    onSuccess: response => cache.setQueryData(["support-request", id], response.data),
    onSettled: () => refresh().finally(() => { pending.current = false; }),
  });
  const submit = event => {
    event.preventDefault();
    const content = (query.data?.reply || reply).trim();
    if (pending.current || !content) return;
    pending.current = true;
    mutation.mutate(content);
  };
  if (query.isPending) return <Panel><Loading /></Panel>;
  if (query.isError) return <Panel><ErrorState retry={() => query.refetch()} /></Panel>;
  const item = query.data;
  const canSend = item.reply_status === "NEW" || item.reply_status === "FAILED";
  return (
    <Panel title="Nội dung yêu cầu" description={requestCode(item.id)}>
      <div className="cf-panel-body cf-stack">
        <h3 className={styles.requestTitle}>{item.title}</h3>
        <p className={styles.requestMeta}>{item.full_name} · {item.email}<br />{timestamp(item.created_at)}</p>
        <p className={styles.requestMessage}>{item.message}</p>
        <p role="status" className={styles.deliveryStatus}>{statuses[item.reply_status]}</p>
        {item.reply_status === "FAILED" && <Alert persistent>Chưa gửi được email. Kiểm tra cấu hình SMTP và dùng nút gửi lại.</Alert>}
        {item.reply_status === "UNKNOWN" && <Alert persistent>Cần đối chiếu nhật ký email trước khi gửi lại vì máy chủ chưa xác nhận kết quả.</Alert>}
        {(canSend || item.reply) && (
          <form className={styles.replyForm} onSubmit={submit} aria-busy={mutation.isPending}>
            <Field label="Nội dung email phản hồi">
              <textarea className="cf-input" rows={5} required maxLength={1500} value={item.reply ?? reply}
                readOnly={Boolean(item.reply)} disabled={mutation.isPending}
                placeholder="Nhập nội dung hướng dẫn hoặc kết quả xử lý."
                onChange={event => setReply(event.target.value)} />
            </Field>
            <div className={styles.replyActions}>
              <span>Đến {item.email}</span>
              {canSend && <button type="submit" className="cf-btn cf-btn-primary" disabled={mutation.isPending || !(item.reply ?? reply).trim()}>
                <Send size={16} aria-hidden="true" />{mutation.isPending ? "Đang gửi…" : item.reply_status === "FAILED" ? "Gửi lại email" : "Gửi email phản hồi"}
              </button>}
            </div>
          </form>
        )}
        {mutation.isError && <Alert persistent>{errorMessage(mutation.error)}</Alert>}
      </div>
    </Panel>
  );
}

export default function SupportRequests() {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const query = useQuery({
    queryKey: ["support-requests", page],
    queryFn: async ({ signal }) => (await api.get(supportPath, { signal, params: { page } })).data,
    refetchInterval: 15000,
  });
  const refresh = () => Promise.all([
    cache.invalidateQueries({ queryKey: ["support-requests"] }),
    cache.invalidateQueries({ queryKey: ["support-request"] }),
  ]);
  const items = query.data?.items ?? [];
  const selectedId = selected ?? items[0]?.id;
  return (
    <div className={styles.workspace}>
      <Panel title="Hộp thư yêu cầu" description={query.data ? `${query.data.total} yêu cầu` : undefined}>
        <div className="cf-panel-body cf-stack">
          {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !items.length ? (
            <Empty title="Chưa có yêu cầu hỗ trợ" description="Các yêu cầu người dùng gửi sẽ hiển thị tại đây." />
          ) : <ul className={styles.list}>
            {items.map(item => <li key={item.id}>
              <div className={styles.wrap}><strong>{item.title}</strong><br />
                <small>{item.full_name} · {item.email}</small><br />
                <small>{requestCode(item.id)} · {timestamp(item.created_at)}</small><br />
                <span className="cf-badge">{statuses[item.reply_status]}</span>
              </div>
              <button type="button" className="cf-btn cf-btn-sm" aria-pressed={selectedId === item.id}
                aria-label={`Xem yêu cầu ${item.title}`} onClick={() => setSelected(item.id)}>Xem</button>
            </li>)}
          </ul>}
          {query.data?.total > 15 && <Pagination page={page} total={query.data.total} pageSize={15}
            onChange={next => { setPage(next); setSelected(null); }} />}
        </div>
      </Panel>
      {selectedId ? <RequestDetail key={selectedId} id={selectedId} refresh={refresh} /> : (
        <Panel><Empty title="Chọn yêu cầu để phản hồi" description="Nội dung yêu cầu và form gửi email sẽ xuất hiện tại đây." /></Panel>
      )}
    </div>
  );
}
