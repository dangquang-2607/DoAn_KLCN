"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import {
  PageHead,
  Panel,
  Stat,
  Field,
  Modal,
  Alert,
  Loading,
  ErrorState,
  Empty,
} from "@/components/ui";
import {
  money,
  localDate,
  dateLabel,
  errorMessage,
  type Budget,
  type Category,
} from "@/lib/finance";
const fresh = () => ({
  name: "",
  category_id: "",
  amount_limit: "",
  currency: "VND",
  period_type: "MONTHLY",
  start_date: localDate(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  ),
  end_date: localDate(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  ),
  warning_percent: "80",
});
export default function Budgets() {
  const cache = useQueryClient();
  const query = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: async () => (await api.get("/budgets")).data,
  });
  const categories = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const [show, setShow] = useState(false),
    [editing, setEditing] = useState<Budget | null>(null),
    [deleting, setDeleting] = useState<Budget | null>(null),
    [form, setForm] = useState(fresh),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const open = (b?: Budget) => {
    setEditing(b || null);
    setError("");
    setForm(
      b
        ? {
            name: b.budget_name,
            category_id: b.category_id || "",
            amount_limit: String(b.amount_limit),
            currency: b.currency,
            period_type: b.period_type,
            start_date: b.start_date,
            end_date: b.end_date,
            warning_percent: String(b.warning_percent),
          }
        : fresh(),
    );
    setShow(true);
  };
  const refresh = () => cache.invalidateQueries({ queryKey: ["budgets"] });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.end_date < form.start_date) {
      setError("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        category_id: form.category_id || null,
      };
      if (editing) {
        const { category_id, ...update } = payload;
        await api.patch("/budgets/" + editing.budget_id, update);
      } else await api.post("/budgets", payload);
      await refresh();
      setShow(false);
      setNotice("Đã lưu ngân sách.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete("/budgets/" + deleting.budget_id);
      await refresh();
      setDeleting(null);
      setNotice("Đã xóa ngân sách. Giao dịch chi tiêu được giữ lại.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const list = query.data || [];
  const active = list.filter((b) => b.is_active);
  const alerts = active.filter((b) => b.progress_status !== "SAFE");
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="KẾ HOẠCH CHI TIÊU"
        title="Ngân sách"
        description="Đặt hạn mức, theo dõi tiến độ và điều chỉnh kế hoạch của bạn."
        actions={
          <button className="cf-btn cf-btn-primary" onClick={() => open()}>
            <Plus />
            Tạo ngân sách
          </button>
        }
      />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <>
          <div className="cf-grid">
            <Stat
              label="Ngân sách đang bật"
              value={active.length}
              note="Theo tất cả các kỳ đã thiết lập"
            />
            <Stat
              label="Cần chú ý"
              value={alerts.length}
              note="Gần hoặc đã vượt hạn mức"
            />
            <Stat
              label="Trong hạn mức"
              value={active.filter((b) => b.progress_status === "SAFE").length}
              note="Chi tiêu dưới ngưỡng cảnh báo"
            />
          </div>
          {!list.length ? (
            <Panel>
              <Empty
                title="Chủ động cho từng khoản chi"
                description="Tạo ngân sách đầu tiên và chọn thời gian bạn muốn theo dõi."
                action={
                  <button
                    className="cf-btn cf-btn-primary"
                    onClick={() => open()}
                  >
                    Thiết lập ngân sách
                  </button>
                }
              />
            </Panel>
          ) : (
            <div className="cf-grid-2">
              {list.map((b) => (
                <Panel key={b.budget_id}>
                  <div className="cf-panel-body cf-stack" style={{ gap: 18 }}>
                    <div className="cf-row cf-between">
                      <h2>{b.budget_name}</h2>
                      <span
                        className={`cf-badge ${b.progress_status === "EXCEEDED" ? "danger" : b.progress_status === "WARNING" ? "warning" : "success"}`}
                      >
                        {b.progress_status === "EXCEEDED"
                          ? "Vượt hạn mức"
                          : b.progress_status === "WARNING"
                            ? "Gần hạn mức"
                            : "Trong hạn mức"}
                      </span>
                    </div>
                    <p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>
                      {categories.data?.find((c) => c.id === b.category_id)
                        ?.name || "Tất cả danh mục"}{" "}
                      · {dateLabel(b.start_date)} – {dateLabel(b.end_date)}
                    </p>
                    <div className="cf-row cf-between">
                      <strong className="cf-number" style={{ fontSize: 27 }}>
                        {money(b.spent_amount, b.currency)}
                      </strong>
                      <span className="cf-muted" style={{ fontSize: 14 }}>
                        / {money(b.amount_limit, b.currency)}
                      </span>
                    </div>
                    <div className="cf-progress">
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, Number(b.usage_percent)))}%`,
                          background:
                            b.progress_status === "EXCEEDED"
                              ? "var(--cf-danger)"
                              : b.progress_status === "WARNING"
                                ? "#b48215"
                                : undefined,
                        }}
                      />
                    </div>
                    <div className="cf-row cf-between" style={{ fontSize: 13 }}>
                      <span className="cf-muted">
                        Đã dùng {Number(b.usage_percent).toFixed(0)}%
                      </span>
                      <span>
                        Còn lại {money(b.remaining_amount, b.currency)}
                      </span>
                    </div>
                    <div className="cf-row cf-between">
                      <span className="cf-muted" style={{ fontSize: 12 }}>
                        Cảnh báo tại {Number(b.warning_percent)}%
                      </span>
                      <div className="cf-row">
                        <button
                          className="cf-btn cf-btn-sm"
                          onClick={() => open(b)}
                        >
                          <Pencil />
                          Sửa
                        </button>
                        <button
                          className="cf-icon-btn"
                          aria-label={`Xóa ${b.budget_name}`}
                          onClick={() => {
                            setDeleting(b);
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
        </>
      )}
      {show && (
        <Modal
          title={editing ? "Điều chỉnh ngân sách" : "Tạo ngân sách"}
          onClose={() => setShow(false)}
          busy={busy}
        >
          <form className="cf-form" onSubmit={save}>
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <Field label="Tên ngân sách">
              <input
                className="cf-input"
                required
                maxLength={150}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Chi tiêu tháng này…"
              />
            </Field>
            <Field
              label="Danh mục"
              hint={
                editing ? "Danh mục được giữ nguyên sau khi tạo." : undefined
              }
            >
              <select
                className="cf-input"
                disabled={!!editing}
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
              >
                <option value="">Tất cả danh mục</option>
                {categories.data
                  ?.filter((c) => c.type === "EXPENSE")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="cf-form-grid">
              <Field label="Hạn mức">
                <input
                  className="cf-input"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount_limit}
                  onChange={(e) =>
                    setForm({ ...form, amount_limit: e.target.value })
                  }
                />
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
              <Field label="Từ ngày">
                <input
                  className="cf-input"
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                />
              </Field>
              <Field label="Đến ngày">
                <input
                  className="cf-input"
                  required
                  type="date"
                  min={form.start_date}
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                />
              </Field>
              <Field label="Kỳ ngân sách">
                <select
                  className="cf-input"
                  value={form.period_type}
                  onChange={(e) =>
                    setForm({ ...form, period_type: e.target.value })
                  }
                >
                  <option value="MONTHLY">Hàng tháng</option>
                  <option value="WEEKLY">Hàng tuần</option>
                  <option value="YEARLY">Hàng năm</option>
                  <option value="CUSTOM">Tùy chỉnh</option>
                </select>
              </Field>
              <Field label="Ngưỡng cảnh báo (%)">
                <input
                  className="cf-input"
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={form.warning_percent}
                  onChange={(e) =>
                    setForm({ ...form, warning_percent: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="cf-form-actions">
              <button
                type="button"
                className="cf-btn"
                disabled={busy}
                onClick={() => setShow(false)}
              >
                Hủy
              </button>
              <button className="cf-btn cf-btn-primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu ngân sách"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Xóa ngân sách"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <div className="cf-form">
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <p>
              Xóa ngân sách “{deleting.budget_name}”? Các giao dịch chi tiêu vẫn
              được giữ lại.
            </p>
            <div className="cf-form-actions">
              <button
                className="cf-btn"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Hủy
              </button>
              <button
                className="cf-btn cf-btn-danger"
                disabled={busy}
                onClick={remove}
              >
                Xóa ngân sách
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
