"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, Pencil, Trash2, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import {
  PageHead,
  Panel,
  Field,
  Modal,
  Alert,
  Loading,
  ErrorState,
  Empty,
} from "@/components/ui";
import { money, accountTypes, errorMessage, type Account } from "@/lib/finance";
export default function Accounts() {
  const cache = useQueryClient();
  const query = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const [editing, setEditing] = useState<Account | null>(null),
    [show, setShow] = useState(false),
    [deleting, setDeleting] = useState<Account | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    account_type: "CASH",
    institution_name: "",
    balance: "0",
    currency: "VND",
  });
  const open = (account?: Account) => {
    setEditing(account || null);
    setForm(
      account
        ? {
            name: account.name,
            account_type: account.account_type,
            institution_name: account.institution_name || "",
            balance: String(account.balance),
            currency: account.currency,
          }
        : {
            name: "",
            account_type: "CASH",
            institution_name: "",
            balance: "0",
            currency: "VND",
          },
    );
    setError("");
    setShow(true);
  };
  const refresh = () =>
    Promise.all(
      ["accounts", "dashboard", "transactions"].map((key) =>
        cache.invalidateQueries({ queryKey: [key] }),
      ),
    );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        institution_name: form.institution_name.trim() || null,
      };
      if (editing) await api.patch("/accounts/" + editing.id, payload);
      else await api.post("/accounts", payload);
      await refresh();
      setShow(false);
      setNotice(editing ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api.delete("/accounts/" + deleting.id);
      await refresh();
      setDeleting(null);
      setNotice("Đã ngừng sử dụng ví. Lịch sử giao dịch vẫn được lưu.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="TÀI KHOẢN"
        title="Ví & tài khoản"
        description="Theo dõi số dư tiền mặt, ngân hàng và các tài khoản của bạn."
        actions={
          <button className="cf-btn cf-btn-primary" onClick={() => open()}>
            <Plus />
            Thêm tài khoản
          </button>
        }
      />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <Panel>
          <Empty
            title="Một nơi cho mọi tài khoản"
            description="Thêm tài khoản và nhập số dư ban đầu. Bạn sẽ tự ghi nhận giao dịch để cập nhật số dư."
            action={
              <button className="cf-btn cf-btn-primary" onClick={() => open()}>
                <Plus />
                Tạo tài khoản đầu tiên
              </button>
            }
          />
        </Panel>
      ) : (
        <div className="cf-grid">
          {query.data.map((a) => (
            <Panel key={a.id} className="cf-wallet-card">
              <div className="cf-panel-body">
                <div className="cf-row cf-between">
                  <span className="cf-icon">
                    <Wallet />
                  </span>
                  <span className="cf-badge">
                    {accountTypes[a.account_type] || a.account_type}
                  </span>
                </div>
                <h2 style={{ margin: "24px 0 4px", fontSize: 19 }}>{a.name}</h2>
                <p className="cf-muted" style={{ fontSize: 13 }}>
                  {a.institution_name || "Tài khoản theo dõi thủ công"}
                </p>
                <div
                  className="cf-number"
                  style={{ fontSize: 30, fontWeight: 650, margin: "22px 0" }}
                >
                  {money(a.balance, a.currency)}
                </div>
                <div className="cf-row cf-between">
                  <Link
                    href={`/transactions?account_id=${a.id}`}
                    className="cf-inline-link"
                  >
                    Giao dịch{" "}
                    <ArrowRight size={14} style={{ display: "inline" }} />
                  </Link>
                  <div className="cf-row">
                    <button
                      className="cf-icon-btn"
                      aria-label={`Sửa ${a.name}`}
                      onClick={() => open(a)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="cf-icon-btn"
                      aria-label={`Ngừng sử dụng ${a.name}`}
                      onClick={() => {
                        setDeleting(a);
                        setError("");
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {show && (
        <Modal
          title={editing ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"}
          onClose={() => setShow(false)}
          busy={busy}
        >
          <form className="cf-form" onSubmit={save}>
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <Field label="Tên tài khoản">
              <input
                className="cf-input"
                required
                maxLength={150}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví tiền mặt, tài khoản lương…"
              />
            </Field>
            <div className="cf-form-grid">
              <Field label="Loại tài khoản">
                <select
                  className="cf-input"
                  value={form.account_type}
                  onChange={(e) =>
                    setForm({ ...form, account_type: e.target.value })
                  }
                >
                  {Object.entries(accountTypes).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tiền tệ">
                <select
                  className="cf-input"
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                >
                  {["VND"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Tổ chức / ngân hàng (tùy chọn)">
              <input
                className="cf-input"
                maxLength={150}
                value={form.institution_name}
                onChange={(e) =>
                  setForm({ ...form, institution_name: e.target.value })
                }
              />
            </Field>
            <Field
              label={editing ? "Số dư điều chỉnh" : "Số dư ban đầu"}
              hint={
                editing
                  ? "Thay đổi số dư sẽ tạo bản ghi điều chỉnh, lưu số dư trước/sau và không tính vào thu/chi."
                  : undefined
              }
            >
              <input
                className="cf-input"
                required
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </Field>
            <div className="cf-form-actions">
              <button
                type="button"
                className="cf-btn"
                onClick={() => setShow(false)}
                disabled={busy}
              >
                Hủy
              </button>
              <button className="cf-btn cf-btn-primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu tài khoản"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Ngừng sử dụng tài khoản"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <div className="cf-form">
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <p>
              Ngừng sử dụng <strong>{deleting.name}</strong>? Lịch sử giao dịch
              vẫn được giữ lại.
            </p>
            {Number(deleting.balance) !== 0 && (
              <Alert kind="info">
                Ví còn {money(deleting.balance, deleting.currency)}. Chuyển hoặc
                điều chỉnh số dư về 0 trước khi tiếp tục.
              </Alert>
            )}
            <div className="cf-form-actions">
              <button
                className="cf-btn"
                onClick={() => setDeleting(null)}
                disabled={busy}
              >
                Hủy
              </button>
              <button
                className="cf-btn cf-btn-danger"
                onClick={remove}
                disabled={busy || Number(deleting.balance) !== 0}
              >
                {busy ? "Đang xử lý…" : "Ngừng sử dụng"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
