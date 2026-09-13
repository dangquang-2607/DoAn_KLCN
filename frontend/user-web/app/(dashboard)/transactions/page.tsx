"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Download,
  Search,
} from "lucide-react";
import api from "@/lib/api";
import { TransferFlow } from "@/components/Motion";
import {
  PageHead,
  Panel,
  Field,
  Modal,
  Alert,
  Loading,
  ErrorState,
  Empty,
  Pagination,
} from "@/components/ui";
import {
  money,
  dateLabel,
  localDate,
  exportCsv,
  errorMessage,
  type Account,
  type Category,
  type Transaction,
} from "@/lib/finance";
const fresh = () => ({
  account_id: "",
  category_id: "",
  type: "EXPENSE",
  amount: "",
  transaction_date: localDate(),
  description: "",
  note: "",
  to_account_id: "",
});
export default function Transactions() {
  const cache = useQueryClient();
  const [receipt, setReceipt] = useState<{from: string; to: string; amount: string} | null>(null);
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState({
      type: "",
      account_id: "",
      category_id: "",
      start_date: "",
      end_date: "",
    }),
    [search, setSearch] = useState(""),
    [mode, setMode] = useState(""),
    [editing, setEditing] = useState<Transaction | null>(null),
    [deleting, setDeleting] = useState<Transaction | null>(null),
    [form, setForm] = useState(fresh),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new")) setMode("create");
    if (params.get("account_id"))
      setFilters((f) => ({ ...f, account_id: params.get("account_id") || "" }));
  }, []);
  const accounts = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const categories = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const query = useQuery<{ items: Transaction[]; total: number }>({
    queryKey: ["transactions", page, filters],
    queryFn: async () =>
      (
        await api.get("/transactions", {
          params: {
            page,
            page_size: 15,
            ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
          },
        })
      ).data,
  });
  const list = (query.data?.items || []).filter(
    (t) =>
      t.description?.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
      !search,
  );
  const account = (id: string) => accounts.data?.find((a) => a.id === id);
  const category = (id: string | null) =>
    categories.data?.find((c) => c.id === id);
  const invalidate = () =>
    Promise.all(
      ["transactions", "accounts", "dashboard", "budgets", "analytics"].map(
        (key) => cache.invalidateQueries({ queryKey: [key] }),
      ),
    );
  const open = (kind: string, tx?: Transaction) => {
    setMode(kind);
    setEditing(tx || null);
    setError("");
    setForm(
      tx
        ? {
            ...fresh(),
            account_id: tx.account_id,
            category_id: tx.category_id || "",
            type: tx.type,
            amount: String(Math.abs(Number(tx.amount))),
            transaction_date: tx.transaction_date,
            description: tx.description || "",
            note: tx.note || "",
          }
        : { ...fresh(), account_id: accounts.data?.[0]?.id || "" },
    );
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    setReceipt(null);
    try {
      if (mode === "transfer") {
        const from = account(form.account_id),
          to = account(form.to_account_id);
        if (!from || !to || from.id === to.id)
          throw new Error("Chọn hai tài khoản khác nhau.");
        if (from.currency !== to.currency)
          throw new Error("Chỉ chuyển giữa các tài khoản cùng loại tiền tệ.");
        await api.post("/transactions/transfer", {
          from_account_id: form.account_id,
          to_account_id: form.to_account_id,
          amount: form.amount,
          transaction_date: form.transaction_date,
          note: form.note || null,
        });
      } else {
        const payload = {
          account_id: form.account_id,
          category_id: form.category_id || null,
          type: form.type,
          amount: form.amount,
          transaction_date: form.transaction_date,
          description: form.description.trim(),
          note: form.note || null,
        };
        if (editing) await api.patch("/transactions/" + editing.id, payload);
        else await api.post("/transactions", payload);
      }
      await invalidate();
      if (mode === "transfer") setReceipt({from: account(form.account_id)?.name || "Ví nguồn", to: account(form.to_account_id)?.name || "Ví nhận", amount: money(form.amount)});
      setMode("");
      setNotice(
        mode === "transfer"
          ? "Đã chuyển tiền giữa hai tài khoản."
          : "Đã lưu giao dịch và cập nhật số dư.",
      );
    } catch (e) {
      setError(
        e instanceof Error && !("response" in e) ? e.message : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api.delete("/transactions/" + deleting.id);
      await invalidate();
      setDeleting(null);
      setNotice("Đã xóa giao dịch và hoàn lại số dư.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const filter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setSearch("");
  };
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="SỔ GIAO DỊCH"
        title="Giao dịch"
        description="Ghi nhận thu chi và theo dõi dòng tiền qua từng tài khoản."
        actions={
          <>
            <button className="cf-btn" onClick={() => open("transfer")}>
              <ArrowLeftRight />
              Chuyển tiền
            </button>
            <button
              className="cf-btn cf-btn-primary"
              onClick={() => open("create")}
            >
              <Plus />
              Thêm giao dịch
            </button>
          </>
        }
      />
      {receipt && <TransferFlow {...receipt} confirmed onClose={() => setReceipt(null)} />}
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      <Panel>
        <div className="cf-toolbar">
          <Field label="Loại giao dịch">
            <select
              className="cf-input"
              value={filters.type}
              onChange={(e) => filter("type", e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="INCOME">Thu nhập</option>
              <option value="EXPENSE">Chi tiêu</option>
            </select>
          </Field>
          <Field label="Tài khoản">
            <select
              className="cf-input"
              value={filters.account_id}
              onChange={(e) => filter("account_id", e.target.value)}
            >
              <option value="">Tất cả tài khoản</option>
              {accounts.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Danh mục">
            <select
              className="cf-input"
              value={filters.category_id}
              onChange={(e) => filter("category_id", e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Từ ngày">
            <input
              className="cf-input"
              type="date"
              value={filters.start_date}
              max={filters.end_date || undefined}
              onChange={(e) => filter("start_date", e.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              className="cf-input"
              type="date"
              value={filters.end_date}
              min={filters.start_date || undefined}
              onChange={(e) => filter("end_date", e.target.value)}
            />
          </Field>
          <button
            className="cf-btn cf-btn-ghost"
            onClick={() => {
              setFilters({
                type: "",
                account_id: "",
                category_id: "",
                start_date: "",
                end_date: "",
              });
              setPage(1);
              setSearch("");
            }}
          >
            Đặt lại
          </button>
        </div>
        <div className="cf-panel-head">
          <div className="cf-search">
            <Search />
            <input
              className="cf-input"
              aria-label="Tìm mô tả trong trang hiện tại"
              placeholder="Tìm mô tả trong trang này…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="cf-btn cf-btn-sm"
            disabled={!list.length}
            onClick={() =>
              exportCsv("giao-dich-trang-" + page + ".csv", [
                [
                  "Ngày",
                  "Mô tả",
                  "Tài khoản",
                  "Danh mục",
                  "Số tiền",
                  "Tiền tệ",
                ],
                ...list.map((t) => [
                  t.transaction_date,
                  t.description,
                  account(t.account_id)?.name,
                  category(t.category_id)?.name,
                  t.amount,
                  account(t.account_id)?.currency || "VND",
                ]),
              ])
            }
          >
            <Download />
            Xuất trang này
          </button>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState retry={() => query.refetch()} />
        ) : !list.length ? (
          <Empty
            title="Không có giao dịch phù hợp"
            description="Thử thay đổi bộ lọc hoặc thêm giao dịch mới."
          />
        ) : (
          <div className="cf-table-wrap">
            <table className="cf-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giao dịch</th>
                  <th>Danh mục</th>
                  <th>Tài khoản</th>
                  <th className="right">Số tiền</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="cf-muted">
                      {dateLabel(t.transaction_date)}
                    </td>
                    <td>
                      <strong>{t.description || "Giao dịch"}</strong>
                      <div className="cf-sub">
                        {t.source === "OCR"
                          ? "Từ hóa đơn"
                          : t.kind === "TRANSFER"
                            ? "Chuyển nội bộ"
                            : t.kind === "ADJUSTMENT"
                              ? "Điều chỉnh số dư"
                              : t.source === "SYSTEM"
                                ? "Hệ thống"
                                : "Nhập thủ công"}
                      </div>
                    </td>
                    <td>
                      <span className="cf-badge">
                        {category(t.category_id)?.name || "Chưa phân loại"}
                      </span>
                    </td>
                    <td>
                      {account(t.account_id)?.name ||
                        "Tài khoản đã ngừng sử dụng"}
                    </td>
                    <td
                      className={`right cf-number ${Number(t.amount) > 0 ? "cf-success" : ""}`}
                    >
                      {Number(t.amount) > 0 ? "+" : ""}
                      {money(
                        t.amount,
                        account(t.account_id)?.currency || "VND",
                      )}
                    </td>
                    <td>
                      {t.source !== "SYSTEM" && (
                        <div className="cf-row">
                          <button
                            className="cf-icon-btn"
                            aria-label="Sửa giao dịch"
                            onClick={() => open("edit", t)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="cf-icon-btn"
                            aria-label="Xóa giao dịch"
                            onClick={() => {
                              setDeleting(t);
                              setError("");
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          total={query.data?.total || 0}
          pageSize={15}
          onChange={setPage}
        />
      </Panel>
      {mode && (
        <Modal
          title={
            mode === "transfer"
              ? "Chuyển tiền giữa tài khoản"
              : editing
                ? "Chỉnh sửa giao dịch"
                : "Thêm giao dịch"
          }
          onClose={() => setMode("")}
          busy={busy}
        >
          <form className="cf-form" onSubmit={submit}>
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            {accounts.isError || categories.isError ? (
              <Alert persistent>
                Không thể tải tài khoản hoặc danh mục. Đóng biểu mẫu và thử lại.
              </Alert>
            ) : !accounts.data?.length ? (
              <Alert kind="info">
                Bạn cần tạo tài khoản ở mục Ví & tài khoản trước khi ghi nhận
                giao dịch.
              </Alert>
            ) : null}
            {mode === "transfer" && <TransferFlow from={account(form.account_id)?.name || ""} to={account(form.to_account_id)?.name || ""} />}
            {mode !== "transfer" && (
              <Field label="Loại giao dịch">
                <select
                  className="cf-input"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value, category_id: "" })
                  }
                >
                  <option value="EXPENSE">Chi tiêu</option>
                  <option value="INCOME">Thu nhập</option>
                </select>
              </Field>
            )}
            <Field
              label={mode === "transfer" ? "Tài khoản chuyển đi" : "Tài khoản"}
            >
              <select
                required
                className="cf-input"
                value={form.account_id}
                onChange={(e) =>
                  setForm({ ...form, account_id: e.target.value })
                }
              >
                <option value="">Chọn tài khoản</option>
                {accounts.data?.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name} · {money(a.balance, a.currency)}
                  </option>
                ))}
              </select>
            </Field>
            {mode === "transfer" ? (
              <Field label="Tài khoản nhận">
                <select
                  className="cf-input"
                  required
                  value={form.to_account_id}
                  onChange={(e) =>
                    setForm({ ...form, to_account_id: e.target.value })
                  }
                >
                  <option value="">Chọn tài khoản nhận</option>
                  {accounts.data
                    ?.filter(
                      (a) =>
                        a.id !== form.account_id &&
                        a.currency === account(form.account_id)?.currency,
                    )
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <Field label="Danh mục">
                <select
                  className="cf-input"
                  value={form.category_id}
                  onChange={(e) =>
                    setForm({ ...form, category_id: e.target.value })
                  }
                >
                  <option value="">Chưa phân loại</option>
                  {categories.data
                    ?.filter((c) => c.type === form.type)
                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <div className="cf-form-grid">
              <Field
                label={`Số tiền (${account(form.account_id)?.currency || "VND"})`}
              >
                <input
                  className="cf-input"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field label="Ngày giao dịch">
                <input
                  className="cf-input"
                  required
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) =>
                    setForm({ ...form, transaction_date: e.target.value })
                  }
                />
              </Field>
            </div>
            {mode !== "transfer" && (
              <Field label="Mô tả">
                <input
                  className="cf-input"
                  required
                  maxLength={255}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </Field>
            )}
            <Field label="Ghi chú (tùy chọn)">
              <textarea
                className="cf-input"
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
            <div className="cf-form-actions">
              <button
                type="button"
                disabled={busy}
                className="cf-btn"
                onClick={() => setMode("")}
              >
                Hủy
              </button>
              <button
                className="cf-btn cf-btn-primary"
                disabled={
                  busy ||
                  !accounts.data?.length ||
                  accounts.isError ||
                  categories.isError
                }
              >
                {busy
                  ? "Đang xử lý…"
                  : mode === "transfer"
                    ? "Xác nhận chuyển tiền"
                    : "Lưu giao dịch"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Xóa giao dịch"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <div className="cf-form">
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <p>
              Xóa “{deleting.description}” với số tiền{" "}
              {money(deleting.amount, account(deleting.account_id)?.currency)}?
              Số dư tài khoản sẽ được hoàn lại.
            </p>
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
                disabled={busy}
              >
                {busy ? "Đang xóa…" : "Xóa giao dịch"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
