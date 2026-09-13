"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, Search, Pencil, Trash2 } from "lucide-react";
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
import { errorMessage, type Category } from "@/lib/finance";
export default function Categories() {
  const cache = useQueryClient();
  const query = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const [type, setType] = useState("EXPENSE"),
    [search, setSearch] = useState(""),
    [show, setShow] = useState(false),
    [editing, setEditing] = useState<Category | null>(null),
    [deleting, setDeleting] = useState<Category | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing)
        await api.patch("/categories/" + editing.id, {
          name: name.trim(),
          type,
        });
      else await api.post("/categories", { name: name.trim(), type });
      await cache.invalidateQueries({ queryKey: ["categories"] });
      setShow(false);
      setName("");
      setNotice(editing ? "Đã cập nhật danh mục." : "Đã tạo danh mục cá nhân.");
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
      await api.delete("/categories/" + deleting.id);
      await cache.invalidateQueries({ queryKey: ["categories"] });
      setDeleting(null);
      setNotice("Đã ẩn danh mục. Lịch sử giao dịch được giữ nguyên.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const list = (query.data || []).filter(
    (c) =>
      c.type === type &&
      c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="TỔ CHỨC DỮ LIỆU"
        title="Danh mục"
        description="Phân loại khoản thu và chi bằng danh mục hệ thống hoặc danh mục riêng."
        actions={
          <button
            className="cf-btn cf-btn-primary"
            onClick={() => {
              setEditing(null);
              setName("");
              setShow(true);
              setError("");
            }}
          >
            <Plus />
            Tạo danh mục
          </button>
        }
      />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      <div className="cf-row cf-between">
        <div className="cf-tabs" role="tablist" aria-label="Loại danh mục">
          {[
            ["EXPENSE", "Chi tiêu"],
            ["INCOME", "Thu nhập"],
          ].map(([v, l]) => (
            <button
              key={v}
              role="tab"
              aria-selected={type === v}
              onClick={() => setType(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="cf-search">
          <Search />
          <input
            className="cf-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm danh mục"
            placeholder="Tìm danh mục…"
          />
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !list.length ? (
        <Panel>
          <Empty
            title="Chưa có danh mục phù hợp"
            description="Tạo danh mục riêng để phân loại các giao dịch của bạn."
          />
        </Panel>
      ) : (
        <div className="cf-grid">
          {list.map((c) => (
            <Panel key={c.id}>
              <div className="cf-panel-body cf-row">
                <span className="cf-icon">
                  <Tags />
                </span>
                <div style={{ flex: 1 }}>
                  <h2>{c.name}</h2>
                  <p
                    className="cf-muted"
                    style={{ fontSize: 12, margin: "5px 0 0" }}
                  >
                    {c.type === "EXPENSE" ? "Khoản chi" : "Khoản thu"}
                  </p>
                </div>
                <span className={`cf-badge ${c.owner_user_id ? "info" : ""}`}>
                  {c.owner_user_id ? "Cá nhân" : "Hệ thống"}
                </span>
                {c.owner_user_id && (
                  <div className="cf-row">
                    <button
                      className="cf-icon-btn"
                      aria-label={"Sửa " + c.name}
                      onClick={() => {
                        setEditing(c);
                        setName(c.name);
                        setType(c.type);
                        setError("");
                        setShow(true);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="cf-icon-btn"
                      aria-label={"Ẩn " + c.name}
                      onClick={() => {
                        setDeleting(c);
                        setError("");
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
      {deleting && (
        <Modal
          title="Ẩn danh mục"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          <p>
            Ẩn danh mục “{deleting.name}” khỏi các lựa chọn mới? Giao dịch và
            ngân sách đã dùng danh mục này vẫn được giữ nguyên.
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
              {busy ? "Đang xử lý…" : "Ẩn danh mục"}
            </button>
          </div>
        </Modal>
      )}
      {show && (
        <Modal
          title={editing ? "Sửa danh mục cá nhân" : "Tạo danh mục cá nhân"}
          busy={busy}
          onClose={() => setShow(false)}
        >
          <form className="cf-form" onSubmit={save}>
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <Field label="Tên danh mục">
              <input
                className="cf-input"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Loại danh mục">
              <select
                className="cf-input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="EXPENSE">Chi tiêu</option>
                <option value="INCOME">Thu nhập</option>
              </select>
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
                {busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo danh mục"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
