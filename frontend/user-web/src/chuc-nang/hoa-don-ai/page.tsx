/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giới hạn định dạng/kích thước/số lượng tệp; chỉ tạo khoản chi sau bước người dùng xác nhận.
 * ============================================================================
 */
﻿"use client";
import "./CSS/ocr.css";
/** Trang điều phối upload, theo dõi xử lý và kiểm duyệt kết quả hóa đơn OCR. */
import { OcrSteps } from "@/dung-chung/UI-chung/Motion";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  Trash2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
} from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import {
  PageHead,
  Panel,
  Modal,
  Alert,
  Loading,
  ErrorState,
  Empty,
} from "@/dung-chung/UI-chung/ui";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import InvoiceStatusBadge from "./thanh-phan/InvoiceStatusBadge";
import InvoiceDetailForm from "./thanh-phan/InvoiceDetailForm";
import InvoiceQueueList from "./thanh-phan/InvoiceQueueList";
import InvoiceUploadZone from "./thanh-phan/InvoiceUploadZone";
import type { Invoice, UploadResult } from "./xu-ly/InvoiceTypes";
import { uploadInvoice, invoiceMutation, invoiceError } from "./xu-ly/invoiceApi";
import { ocrStyles } from "./CSS/ocr.styles";
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
  const [uploadResults, setUploadResults] = useState<Array<{ file: File; result?: UploadResult; error?: string }>>([]);
  const [missingFile, setMissingFile] = useState(false);
  const query = useQuery<{ items: Invoice[]; total: number }>({
    queryKey: ["invoices", page, status],
    queryFn: async () =>
      (
        await api.get("/invoices", {
          params: { page, page_size: 15, status: status === "HIDDEN" ? undefined : status || undefined, visibility: status === "HIDDEN" ? "hidden" : "active" },
        })
      ).data,
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => i.status === "PROCESSING") ? 4000 : false,
  });
  const list = query.data?.items || [];
  const activeSelectedId = selectedId || list[0]?.id || null;
  const detail = useQuery<Invoice>({
    queryKey: ["invoice", activeSelectedId],
    queryFn: async () => (await api.get("/invoices/" + activeSelectedId)).data,
    enabled: !!activeSelectedId,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => q.state.data?.status === "PROCESSING" ? 4000 : false,
  });
  useEffect(() => {
    let active = true,
      url = "";
    queueMicrotask(() => {
      if (!active) return;
      setBlob("");
      setPreviewError(false);
      setMissingFile(false);
      setZoom(1);
      setRotation(0);
      setPreviewBusy(Boolean(activeSelectedId));
    });
    if (!activeSelectedId) return;
    api
      .get("/invoices/" + activeSelectedId + "/file", { responseType: "blob" })
      .then((res) => {
        if (active) {
          url = URL.createObjectURL(res.data);
          setBlob(url);
        }
      })
      .catch((e) => {
        if (active) { setPreviewError(true); setMissingFile(e.response?.status === 404); }
      })
      .finally(() => {
        if (active) setPreviewBusy(false);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [activeSelectedId, previewVersion]);
  // Xác nhận OCR có thể tạo khoản chi nên phải làm mới cả hóa đơn và các cache tài chính.
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
  // Kiểm tra định dạng và giới hạn 10 MB trước khi tuần tự tải từng tệp lên backend.
  const upload = async (files: FileList | File[] | null) => {
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
    const results: Array<{ file: File; result?: UploadResult; error?: string }> = [];
    try {
      for (const file of valid) {
        try {
          const result = await uploadInvoice(file);
          results.push({ file, result }); setSelectedId(result.id);
        } catch (e) { results.push({ file, error: invoiceError(e).message }); }
        setUploadResults([...results]);
      }
      setStatus("");
      setPage(1);
      setChecked([]);
      const created = results.filter(r => r.result?.outcome === "CREATED").length;
      const reused = results.filter(r => r.result && r.result.outcome !== "CREATED").length;
      setNotice(`${created} hóa đơn mới · ${reused} bản đã có · ${results.filter(r => r.error).length} tệp chưa hoàn tất.`);
    } catch (e) {
      setError(invoiceError(e).message);
    } finally {
      await invalidate(); setPreviewVersion(v => v + 1);
      setBusy("");
      if (uploadInput.current) uploadInput.current.value = "";
    }
  };
  // Giới hạn tối đa năm hóa đơn mỗi lô và bỏ qua tài liệu đang xử lý/đã xác nhận.
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
  // Chỉ sau bước người dùng xác nhận mới tạo khoản chi và cập nhật số dư tài khoản.
  const confirm = async (payload: Record<string, unknown>) => {
    if (!activeSelectedId) return;
    setBusy("confirm");
    setError("");
    setNotice("");
    try {
      const result = await invoiceMutation<{ outcome: string }>(activeSelectedId, "confirm", payload);
      await invalidate();
      setVersion((v) => v + 1);
      setNotice(result.outcome === "ALREADY_CONFIRMED" ? "Hóa đơn đã được ghi sổ trước đó; không tạo thêm khoản chi." : "Đã ghi sổ hóa đơn và cập nhật khoản chi.");
    } catch (e) {
      setError(invoiceError(e).message);
      throw e;
    } finally {
      setBusy("");
    }
  };
  const restoreInvoice = async () => {
    if (!detail.data || busy) return;
    setBusy("restore"); setError("");
    try {
      const result = await invoiceMutation<{ requires_file: boolean }>(detail.data.id, "restore", { expected_revision: detail.data.revision });
      await invalidate(); setVersion(v => v + 1); setPreviewVersion(v => v + 1);
      setNotice(result.requires_file ? "Đã khôi phục thông tin. Tải lại đúng ảnh hóa đơn nếu cần xem hoặc quét lại; chưa có khoản chi mới." : "Đã khôi phục hóa đơn; chưa có khoản chi mới.");
    } catch (e) { setError(invoiceError(e).message); } finally { setBusy(""); }
  };
  // Xóa tệp hóa đơn đã chọn nhưng giữ lại giao dịch đã được ghi nhận trước đó.
  const remove = async () => {
    if (!deleting) return;
    setBusy("delete");
    setError("");
    try {
      const { data } = await api.post("/invoices/batch-delete", {
        invoice_ids: deleting,
      });
      const removedCurrent = deleting.includes(activeSelectedId || "");
      setPage(1);
      setChecked([]);
      setDeleting(null);
      await invalidate();
      if (removedCurrent) setSelectedId(null);
      setNotice(
        `Đã ẩn ${data.deleted} hóa đơn và yêu cầu xóa ảnh. Các khoản chi đã ghi nhận vẫn được giữ lại.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const eligible = checked.filter((id) =>
    list.some(
      (i) => i.id === id && !i.deleted_at && i.mime_type !== "application/xml" && !["CONFIRMED", "PROCESSING"].includes(i.status),
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
          </>
        }
      />
      {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      <InvoiceUploadZone inputRef={uploadInput} busy={!!busy} onUpload={upload} />
      {uploadResults.length > 0 && <div className="cf-panel-body cf-stack" aria-label="Kết quả tải hóa đơn">
        {uploadResults.map((entry, index) => <div key={index} className="cf-row" style={{ flexWrap: "wrap" }}>
          <span>{entry.file.name}: {entry.error || ({ CREATED: "Hóa đơn mới", REUSED_DRAFT: "Tiếp tục bản đã tải", ALREADY_CONFIRMED: "Đã ghi sổ trước đó", RESTORE_REQUIRED: "Đã ẩn — cần khôi phục" }[entry.result!.outcome])}</span>
          {entry.result && <button className="cf-btn cf-btn-sm" disabled={!!busy} onClick={() => setSelectedId(entry.result!.id)}>Mở hóa đơn</button>}
          {entry.error && <button className="cf-btn cf-btn-sm" disabled={!!busy} onClick={() => upload([entry.file])}>Thử lại tệp này</button>}
        </div>)}
      </div>}
      <div className="cf-ocr-grid">
        <InvoiceQueueList
          query={query}
          list={list}
          status={status}
          page={page}
          checked={checked}
          eligible={eligible}
          selectedId={activeSelectedId}
          busy={!!busy}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
            setSelectedId(null);
            setChecked([]);
          }}
          onPageChange={(nextPage) => {
            if (busy) return;
            setPage(nextPage);
            setSelectedId(null);
            setChecked([]);
          }}
          onCheckedChange={setChecked}
          onSelect={setSelectedId}
          onScan={scan}
          onDelete={setDeleting}
        />
        <Panel
          title="Kiểm tra thông tin"
          action={inv && <InvoiceStatusBadge value={inv.status} />}
        >
          {!activeSelectedId ? (
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
                  {!inv.deleted_at && !["CONFIRMED", "PROCESSING"].includes(inv.status) && inv.mime_type !== "application/xml" && (
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
                    disabled={!!busy || !!inv.deleted_at}
                    onClick={() => setDeleting([inv.id])}
                  >
                    <Trash2 />
                    Ẩn và xóa ảnh
                  </button>
                </div>
                {inv.deleted_at && <div className="cf-panel-body"><Alert persistent kind="info">Hóa đơn đã ẩn. Khoản chi đã ghi sổ vẫn được giữ; khôi phục thông tin không tự tạo khoản chi.</Alert><button className="cf-btn" disabled={!!busy} onClick={restoreInvoice}>Khôi phục hóa đơn</button></div>}
                <InvoiceDetailForm
                  key={inv.id + ":" + inv.status + ":" + version}
                  invoice={inv}
                  busy={!!busy}
                  onConfirm={confirm}
                  onOpen={setSelectedId}
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
          <div style={ocrStyles.preview} className={`cf-ocr-preview-body ${inv?.status === "PROCESSING" ? "is-processing" : ""}`}>
          {!activeSelectedId ? (
              <Empty title="Chưa chọn tài liệu" />
            ) : previewBusy ? (
              <Loading />
            ) : missingFile ? (
              <Empty title="Ảnh gốc không còn lưu" description="Thông tin hóa đơn vẫn được giữ. Sau khi khôi phục, tải lại đúng tệp nếu cần xem hoặc quét lại." />
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
                  {/* URL blob là bản xem trước cục bộ nên không thể dùng tối ưu ảnh của Next.js. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
          title="Ẩn hóa đơn và xóa ảnh"
          onClose={() => setDeleting(null)}
          busy={!!busy}
        >
          <div className="cf-form">
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <p>
              Ẩn {deleting.length} hóa đơn và xóa tệp gốc? Thông tin chống trùng và các khoản chi đã ghi sổ vẫn được giữ.
              Bạn có thể khôi phục thông tin trong mục “Đã ẩn”; ảnh đã xóa cần tải lại.
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
