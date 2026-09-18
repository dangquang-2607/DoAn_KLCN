﻿﻿"use client";
import { OcrSteps } from "@/components/Motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  ScanLine,
  Trash2,
  RefreshCw,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Plus,
  ExternalLink,
  Save,
} from "lucide-react";
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
  Pagination,
} from "@/components/ui";
import {
  money,
  localDate,
  errorMessage,
  type Account,
  type Category,
  type Money,
} from "@/lib/finance";
import InvoiceStatusBadge from "@/components/ocr/InvoiceStatusBadge";
import InvoiceDetailForm from "@/components/ocr/InvoiceDetailForm";
import type { Invoice } from "@/components/ocr/InvoiceTypes";
import { STATUSES } from "@/components/ocr/InvoiceTypes";
export default function Ocr() {
  const cache = useQueryClient(),
    uploadInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [checked, setChecked] = useState<string[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [deleting, setDeleting] = useState<string[] | null>(null),
    [version, setVersion] = useState(0),
    [blob, setBlob] = useState(""),
    [previewBusy, setPreviewBusy] = useState(false),
    [previewError, setPreviewError] = useState(false),
    [previewVersion, setPreviewVersion] = useState(0),
    [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0);
  const query = useQuery<{ items: Invoice[]; total: number }>({
    queryKey: ["invoices", page, status],
    queryFn: async () =>
      (
        await api.get("/invoices", {
          params: { page, page_size: 15, status: status || undefined },
        })
      ).data,
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => i.status === "PROCESSING") ? 4000 : false,
  });
  const detail = useQuery<Invoice>({
    queryKey: ["invoice", selectedId],
    queryFn: async () => (await api.get("/invoices/" + selectedId)).data,
    enabled: !!selectedId,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => q.state.data?.status === "PROCESSING" ? 4000 : false,
  });
  const list = query.data?.items || [];
  useEffect(() => {
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }, [list, selectedId]);
  useEffect(() => {
    let active = true,
      url = "";
    setBlob("");
    setPreviewError(false);
    setZoom(1);
    setRotation(0);
    if (!selectedId) return;
    setPreviewBusy(true);
    api
      .get("/invoices/" + selectedId + "/file", { responseType: "blob" })
      .then((res) => {
        if (active) {
          url = URL.createObjectURL(res.data);
          setBlob(url);
        }
      })
      .catch(() => {
        if (active) setPreviewError(true);
      })
      .finally(() => {
        if (active) setPreviewBusy(false);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedId, previewVersion]);
  const invalidate = async () => {
    await Promise.all(
      [
        "invoices",
        "invoice",
        "accounts",
        "transactions",
        "dashboard",
        "budgets",
        "analytics",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    const valid = Array.from(files);
    const unsupported = valid.find(
      (f) =>
        f.size > 10 * 1024 * 1024 || !/\.(jpe?g|png|webp|pdf|xml)$/i.test(f.name),
    );
    if (unsupported) {
      setError(
        `Tệp “${unsupported.name}” không hợp lệ. Chỉ nhận JPG, PNG, WEBP, PDF, XML tối đa 10 MB/tệp.`,
      );
      return;
    }
    setBusy("upload");
    setError("");
    setNotice("");
    let count = 0;
    try {
      for (const file of valid) {
        const data = new FormData();
        data.append("file", file);
        const res = await api.post("/invoices", data);
        count++;
        setSelectedId(res.data.id);
      }
      setStatus("");
      setPage(1);
      setChecked([]);
      setNotice(`Đã tải ${count} hóa đơn. XML được đọc trực tiếp; ảnh và PDF có thể Quét AI.`);
    } catch (e) {
      setError(`Đã tải ${count}/${valid.length} tệp. ${errorMessage(e)}`);
    } finally {
      await cache.invalidateQueries({ queryKey: ["invoices"] });
      setBusy("");
      if (uploadInput.current) uploadInput.current.value = "";
    }
  };
  const scan = async (ids: string[]) => {
    if (!ids.length) return;
    if (ids.length > 5) {
      setError("Mỗi lần quét tối đa 5 hóa đơn.");
      return;
    }
    setBusy("scan");
    setError("");
    setNotice("");
    try {
      if (ids.length === 1) {
        await api.post("/invoices/" + ids[0] + "/ocr");
        setNotice(
          "Đã xếp hàng nhận diện. Kết quả sẽ tự cập nhật khi xử lý xong.",
        );
      } else {
        const { data } = await api.post("/invoices/batch-ocr", {
          invoice_ids: ids,
        });
        const failed = data.results.filter(
          (r: { success: boolean }) => !r.success,
        );
        setNotice(
          `Đã xếp hàng ${data.results.length - failed.length}/${data.results.length} hóa đơn.`,
        );
        if (failed.length)
          setError(failed.map((r: { error: string }) => r.error).join("; "));
      }
      await invalidate();
      setVersion((v) => v + 1);
      setChecked([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const confirm = async (payload: Record<string, unknown>) => {
    if (!selectedId) return;
    setBusy("confirm");
    setError("");
    setNotice("");
    try {
      await api.post("/invoices/" + selectedId + "/confirm", payload);
      await invalidate();
      setVersion((v) => v + 1);
      setNotice("Đã xác nhận hóa đơn và cập nhật khoản chi trong tài khoản.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy("delete");
    setError("");
    try {
      const { data } = await api.post("/invoices/batch-delete", {
        invoice_ids: deleting,
      });
      const removedCurrent = deleting.includes(selectedId || "");
      setChecked([]);
      setDeleting(null);
      await invalidate();
      if (removedCurrent) setSelectedId(null);
      setNotice(
        `Đã xóa ${data.deleted} hóa đơn. Các giao dịch đã ghi nhận vẫn được giữ lại.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const eligible = checked.filter((id) =>
    list.some(
      (i) => i.id === id && i.mime_type !== "application/xml" && !["CONFIRMED", "PROCESSING"].includes(i.status),
    ),
  );
  const inv = detail.data;
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="HÓA ĐƠN AI"
        title="Từ hóa đơn đến khoản chi"
        description="01 Tải lên · 02 Quét và kiểm tra · 03 Xác nhận giao dịch"
        actions={
          <>
            <button
              className="cf-btn"
              onClick={() => query.refetch()}
              disabled={!!busy}
            >
              <RefreshCw />
              Làm mới
            </button>
            <button
              className="cf-btn cf-btn-primary"
              onClick={() => uploadInput.current?.click()}
              disabled={!!busy}
            >
              <Upload />
              {busy === "upload" ? "Đang tải…" : "Tải hóa đơn"}
            </button>
            <input
              type="file"
              ref={uploadInput}
              accept=".jpg,.jpeg,.png,.webp,.pdf,.xml"
              multiple
              hidden
              onChange={(e) => upload(e.target.files)}
            />
          </>
        }
      />
      {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      <div
        className="cf-ocr-drop"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("is-dragging"); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.classList.remove("is-dragging"); }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("is-dragging");
          upload(e.dataTransfer.files);
        }}
      >
        <Upload size={20} />
        <span>Kéo thả hóa đơn vào đây, hoặc</span>
        <button
          className="cf-btn cf-btn-sm"
          disabled={!!busy}
          onClick={() => uploadInput.current?.click()}
        >
          Chọn tệp
        </button>
        <span className="cf-muted">JPG, PNG, WEBP, PDF · Tối đa 10 MB</span>
      </div>
      <div className="cf-ocr-grid">
        <Panel className="cf-ocr-list" title="Tài liệu">
          <div className="cf-panel-body" style={{ padding: 16 }}>
            <Field label="Trạng thái">
              <select
                className="cf-input"
                value={status}
                disabled={!!busy}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                  setSelectedId(null);
                  setChecked([]);
                }}
              >
                <option value="">Tất cả hóa đơn</option>
                {Object.entries(STATUSES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {checked.length > 0 && (
            <div
              className="cf-panel-body"
              style={{ padding: 12, borderTop: "1px solid var(--cf-line)" }}
            >
              <div className="cf-row">
                <strong style={{ fontSize: 13 }}>
                  {checked.length} đã chọn
                </strong>
                <button
                  className="cf-btn cf-btn-sm"
                  disabled={!!busy || !eligible.length || eligible.length > 5}
                  onClick={() => scan(eligible)}
                >
                  <ScanLine />
                  Quét {eligible.length}/5
                </button>
                <button
                  className="cf-icon-btn"
                  disabled={!!busy}
                  aria-label="Xóa các hóa đơn đã chọn"
                  onClick={() => setDeleting(checked)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState retry={() => query.refetch()} />
          ) : !list.length ? (
            <Empty
              title="Chưa có hóa đơn"
              description="Tải ảnh hoặc PDF, tối đa 10 MB mỗi tệp."
            />
          ) : (
            <div className="cf-ocr-documents">
              {list.map((i) => (
                <div
                  key={i.id}
                  className={`cf-ocr-document ${selectedId === i.id ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${i.original_filename}`}
                    disabled={!!busy || i.status === "PROCESSING"}
                    checked={checked.includes(i.id)}
                    onChange={(e) =>
                      setChecked((ids) =>
                        e.target.checked
                          ? [...ids, i.id]
                          : ids.filter((id) => id !== i.id),
                      )
                    }
                  />
                  <button
                    className="cf-ocr-document-button"
                    disabled={!!busy}
                    onClick={() => setSelectedId(i.id)}
                  >
                    <span
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <FileText size={20} />
                      <strong>{i.merchant_name || i.original_filename}</strong>
                    </span>
                    <span
                      className="cf-row cf-between"
                      style={{ marginTop: 12 }}
                    >
                      <InvoiceStatusBadge value={i.status} />
                      <span className="cf-number">
                        {i.total_amount
                          ? money(i.total_amount, i.currency)
                          : "—"}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            pageSize={15}
            total={query.data?.total || 0}
            onChange={(p) => {
              if (busy) return;
              setPage(p);
              setSelectedId(null);
              setChecked([]);
            }}
          />
        </Panel>
        <Panel
          title="Kiểm tra thông tin"
          action={inv && <InvoiceStatusBadge value={inv.status} />}
        >
          {!selectedId ? (
            <Empty
              title="Chọn một hóa đơn"
              description="Thông tin nhận diện sẽ xuất hiện ở đây."
            />
          ) : detail.isPending ? (
            <Loading />
          ) : detail.isError ? (
            <ErrorState retry={() => detail.refetch()} />
          ) : (
            inv && (
              <>
                <div
                  className="cf-panel-body cf-row cf-between"
                  style={{ paddingBottom: 0 }}
                >
                  {!["CONFIRMED", "PROCESSING"].includes(inv.status) && inv.mime_type !== "application/xml" && (
                    <button
                      className="cf-btn cf-btn-primary cf-btn-sm"
                      disabled={!!busy}
                      onClick={() => scan([inv.id])}
                    >
                      <ScanLine />
                      {busy === "scan"
                        ? "Đang nhận diện…"
                        : inv.status === "REVIEW_REQUIRED"
                          ? "Quét lại"
                          : "Quét AI"}
                    </button>
                  )}
                  <button
                    className="cf-btn cf-btn-ghost cf-btn-sm"
                    disabled={!!busy || inv.status === "PROCESSING"}
                    onClick={() => setDeleting([inv.id])}
                  >
                    <Trash2 />
                    Xóa hóa đơn
                  </button>
                </div>
                <InvoiceDetailForm
                  key={inv.id + ":" + inv.status + ":" + version}
                  invoice={inv}
                  busy={!!busy}
                  onConfirm={confirm}
                />
              </>
            )
          )}
        </Panel>
        <Panel
          title="Bản gốc"
          className="cf-ocr-preview"
          action={
            <div className="cf-row" style={{ gap: 4 }}>
              <button
                className="cf-icon-btn"
                disabled={!blob || inv?.mime_type === "application/pdf" || inv?.mime_type === "application/xml"}
                aria-label="Thu nhỏ"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut size={16} />
              </button>
              <button
                className="cf-icon-btn"
                disabled={!blob || inv?.mime_type === "application/pdf" || inv?.mime_type === "application/xml"}
                aria-label="Phóng to"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="cf-icon-btn"
                disabled={!blob || inv?.mime_type === "application/pdf" || inv?.mime_type === "application/xml"}
                aria-label="Xoay ảnh"
                onClick={() => setRotation((r) => r + 90)}
              >
                <RotateCw size={16} />
              </button>
            </div>
          }
        >
          {inv && <OcrSteps status={inv.status} />}
          <div className={`cf-ocr-preview-body ${inv?.status === "PROCESSING" ? "is-processing" : ""}`}>
            {!selectedId ? (
              <Empty title="Chưa chọn tài liệu" />
            ) : previewBusy ? (
              <Loading />
            ) : previewError ? (
              <ErrorState retry={() => setPreviewVersion((v) => v + 1)} />
            ) : blob ? (
              inv?.mime_type === "application/pdf" ? (
                <object
                  data={blob}
                  type="application/pdf"
                  className="cf-pdf"
                  aria-label="Bản gốc hóa đơn PDF"
                >
                  <a
                    className="cf-btn"
                    href={blob}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở PDF
                  </a>
                </object>
              ) : inv?.mime_type === "application/xml" ? (
                <object data={blob} type="application/xml" className="cf-pdf" aria-label="Bản gốc hóa đơn XML">
                  <a className="cf-btn" href={blob} target="_blank" rel="noreferrer">Mở XML</a>
                </object>
              ) : (
                <div className="cf-image-scroll">
                  <img
                    src={blob}
                    alt={inv?.original_filename || "Bản gốc hóa đơn"}
                    style={{
                      width: `${zoom * 100}%`,
                      maxWidth: "none",
                      transform: `rotate(${rotation}deg)`,
                      transformOrigin: "center",
                    }}
                  />
                </div>
              )
            ) : null}
          </div>
          {blob && (
            <div className="cf-panel-body">
              <a
                className="cf-btn cf-btn-sm"
                href={blob}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Mở bản gốc
              </a>
            </div>
          )}
        </Panel>
      </div>
      <p className="cf-muted" style={{ fontSize: 12 }}>
        Nhận JPG, PNG, WEBP và PDF tối đa 10 MB/tệp. Mỗi lần quét hàng loạt tối
        đa 5 hóa đơn.
      </p>
      {deleting && (
        <Modal
          title="Xóa hóa đơn"
          onClose={() => setDeleting(null)}
          busy={!!busy}
        >
          <div className="cf-form">
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <p>
              Xóa vĩnh viễn {deleting.length} hóa đơn và tệp gốc? Các khoản chi
              đã được ghi nhận vẫn được giữ lại trong sổ giao dịch.
            </p>
            <div className="cf-form-actions">
              <button
                className="cf-btn"
                disabled={!!busy}
                onClick={() => setDeleting(null)}
              >
                Hủy
              </button>
              <button
                className="cf-btn cf-btn-danger"
                disabled={!!busy}
                onClick={remove}
              >
                {busy ? "Đang xóa…" : "Xóa hóa đơn"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
