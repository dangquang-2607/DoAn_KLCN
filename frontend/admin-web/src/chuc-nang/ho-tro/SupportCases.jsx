import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../dung-chung/connect-api/api";
import WorkspaceHead from "../../dung-chung/UI-chung/WorkspaceHead";
import { Alert, Empty, ErrorState, Field, Loading, Pagination, Panel } from "../../dung-chung/UI-chung/ui";
import { errorMessage, timestamp } from "../../dung-chung/tien-ich/format";
import styles from "./CSS/SupportCases.module.css";
import SupportRequests from "./SupportRequests";

const issues = {
  LOCKED: "Tài khoản bị khóa",
  NO_EMAIL: "Mất quyền truy cập email đăng ký",
};
const statuses = { OPEN: "Đang mở", ESCALATED: "Chờ admin gốc", RESOLVED: "Đã xử lý" };
const supportPath = "/admin/support-cases";

function CaseDetail({ id, onChange }) {
  const pending = useRef(false);
  const query = useQuery({
    queryKey: ["support-case", id],
    queryFn: async ({ signal }) => (await api.get(`${supportPath}/${id}`, { signal })).data,
    refetchInterval: 15000,
  });
  const mutation = useMutation({
    mutationFn: (status) => api.patch(`${supportPath}/${id}`, { status }),
    onSettled: () => onChange().finally(() => { pending.current = false; }),
  });
  const act = (status) => {
    if (pending.current) return;
    pending.current = true;
    mutation.mutate(status);
  };
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  const item = query.data;
  return (
    <Panel title={issues[item.issue]} description={item.email}>
      <div className="cf-panel-body cf-stack">
        <dl className="adm-rest-dl">
          <div><dt>Mã yêu cầu</dt><dd className={styles.wrap}>{item.id}</dd></div>
          <div><dt>Trạng thái</dt><dd>{statuses[item.status]}</dd></div>
          <div><dt>Tiếp nhận từ</dt><dd>{item.source === "USER" ? "Màn đăng nhập" : "Admin tạo"}</dd></div>
          <div><dt>Tiếp nhận lúc</dt><dd>{timestamp(item.created_at)}</dd></div>
          {item.contact_email && <div><dt>Email liên hệ chưa xác minh</dt><dd className={styles.wrap}>{item.contact_email}</dd></div>}
        </dl>
        {mutation.isError && <Alert persistent>{errorMessage(mutation.error)}</Alert>}
        <div className="cf-row">
          {item.status === "OPEN" && <button className="cf-btn" disabled={mutation.isPending}
            onClick={() => act("ESCALATED")}>Chuyển admin gốc</button>}
          {item.can_resolve && <button className="cf-btn" disabled={mutation.isPending}
            onClick={() => act("RESOLVED")}>Đánh dấu đã xử lý</button>}
        </div>
      </div>
    </Panel>
  );
}

function AccountCases() {
  const cache = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const query = useQuery({
    queryKey: ["support-cases", status, page],
    queryFn: async ({ signal }) => (await api.get(supportPath, {
      params: { page, status: status || undefined }, signal,
    })).data,
  });
  const refresh = () => Promise.all([
    cache.invalidateQueries({ queryKey: ["support-cases"] }),
    cache.invalidateQueries({ queryKey: ["support-case"] }),
  ]);
  return (
    <div className="cf-stack">
      <div className={styles.workspace}>
        <Panel title="Yêu cầu hỗ trợ">
          <div className="cf-panel-body cf-stack">
            <Field label="Trạng thái yêu cầu">
              <select className="cf-input" value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(null); }}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </Field>
            {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> :
              query.data.items.length ? (
                <ul className={styles.list}>
                  {query.data.items.map((item) => (
                    <li key={item.id}>
                      <div className={styles.wrap}><strong>{issues[item.issue]}</strong><br />
                        <small>{item.email} · {statuses[item.status]}</small><br />
                        <small>{timestamp(item.created_at)}</small></div>
                      <button className="cf-btn" aria-pressed={selected === item.id}
                        aria-label={`Xem yêu cầu ${issues[item.issue]} của ${item.email}`}
                        onClick={() => setSelected(item.id)}>Xem</button>
                    </li>
                  ))}
                </ul>
              ) : <Empty title="Không có yêu cầu phù hợp" description="Chọn trạng thái khác để xem các yêu cầu đã tiếp nhận từ người dùng." />}
            {query.data?.total > 15 && <Pagination page={page} total={query.data.total} pageSize={15}
              onChange={(next) => { setPage(next); setSelected(null); }} />}
          </div>
        </Panel>
        {selected ? <CaseDetail key={selected} id={selected} onChange={refresh} /> :
          <Panel><Empty title="Chọn yêu cầu để xử lý" description="Mở một yêu cầu để xem trạng thái và các thao tác được phép." /></Panel>}
      </div>
    </div>
  );
}

export default function SupportCases() {
  const [section, setSection] = useState("requests");
  return (
    <div className="cf-stack">
      <WorkspaceHead title="Hỗ trợ tài khoản" description="Đọc yêu cầu từ người dùng và gửi phản hồi qua email." />
      <div className={styles.sections} role="group" aria-label="Nhóm hỗ trợ">
        <button type="button" className="cf-btn" aria-pressed={section === "requests"} onClick={() => setSection("requests")}>Yêu cầu hỗ trợ chung</button>
        <button type="button" className="cf-btn" aria-pressed={section === "account"} onClick={() => setSection("account")}>Hỗ trợ đăng nhập</button>
      </div>
      {section === "requests" ? <SupportRequests /> : <AccountCases />}
    </div>
  );
}
