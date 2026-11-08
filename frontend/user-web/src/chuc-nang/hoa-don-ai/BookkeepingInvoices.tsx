"use client";
import "./CSS/ocr.css";
import density from "./CSS/invoice-density.module.css";
/** Trang điều phối upload, theo dõi xử lý và kiểm duyệt kết quả hóa đơn OCR. */
import { OcrSteps } from "@/dung-chung/UI-chung/Motion";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
} from "lucide-react";
import api, { sessionOwner } from "@/dung-chung/connect-api/api";
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
import Toast from "@/dung-chung/UI-chung/Toast";
import InvoiceStatusBadge from "./thanh-phan/InvoiceStatusBadge";
import InvoiceDetailForm from "./thanh-phan/InvoiceRecordForm";
import InvoiceQueueList from "./thanh-phan/InvoiceQueueList";
import InvoiceTrashNotice from "./thanh-phan/InvoiceTrashNotice";
import InvoiceUploadZone from "./thanh-phan/InvoiceUploadZone";
import InvoiceIntakeFeedback from "./thanh-phan/InvoiceIntakeFeedback";
import InvoicePdfPreview from "./thanh-phan/InvoicePdfPreview";
import type { Invoice, UploadEntry } from "./xu-ly/InvoiceTypes";
import { uploadInvoice, invoiceMutation, invoiceError } from "./xu-ly/invoiceApi";
import { invoiceUploadError, prepareInvoiceImage } from "./xu-ly/invoiceUpload";
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
  const [uploadResults, setUploadResults] = useState<UploadEntry[]>([]);
  const [duplicateNotice, setDuplicateNotice] = useState<{ created: number; reused: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; index: number; total: number } | null>(null);
  const uploadPending = useRef(false);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [missingFile, setMissingFile] = useState(false);
  const query = useQuery<{ items: Invoice[]; total: number }>({
    queryKey: ["invoices", page, status],
    queryFn: async () =>
      (
        await api.get("/invoices", {
          params: { page, page_size: 15, status: status === "HIDDEN" ? undefined : status || undefined, visibility: status === "HIDDEN" ? "trash" : "active" },
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
        "analytics", "payment-records", "wallet-history",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  };
  // Validate the entire selection before starting one OCR request per image.
  const upload = async (files: FileList | File[] | null, ticket?: string) => {
    if (!files?.length || busy || uploadPending.current) return;
    const valid = Array.from(files);
    const selectionError = invoiceUploadError(valid);
    if (selectionError) {
      if (uploadInput.current) uploadInput.current.value = "";
      setError(selectionError);
      setNotice("");
      setDuplicateNotice(null);
      return;
    }
    uploadPending.current = true;
    const owner = sessionOwner();
    setBusy("upload");
    setError("");
    setNotice("");
    setDuplicateNotice(null);
    const results: UploadEntry[] = uploadResults.filter(r => r.error && !valid.some(file =>
      file.name === r.file.name && file.size === r.file.size &&
      file.type === r.file.type && file.lastModified === r.file.lastModified,
    ));
    try {
      for (const [index, file] of valid.entries()) {
        if (sessionOwner() !== owner) {
          setError("Phiên đăng nhập đã thay đổi. Hãy đăng nhập và chọn lại các ảnh chưa tải.");
          break;
        }
        setUploadProgress({ name: file.name, index: index + 1, total: valid.length });
        try {
          const prepared = await prepareInvoiceImage(file);
          if (sessionOwner() !== owner) throw new Error("Phiên đăng nhập đã thay đổi. Hãy đăng nhập và chọn lại ảnh.");
          const result = await uploadInvoice(prepared, ticket);
          results.push({ file, result }); setSelectedId(result.id);
        } catch (e) { const issue = invoiceError(e); results.push({ file, error: issue.message, issue }); }
        setUploadResults([...results]);
      }
      setStatus("");
      setPage(1);
      setChecked([]);
      const created = results.filter(r => r.result?.outcome === "CREATED").length;
      const reused = results.filter(r => r.result && r.result.outcome !== "CREATED").length;
      const incomplete = results.filter(r => r.error).length;
      const summary = `${created} hóa đơn mới · ${reused} ảnh khớp hóa đơn đã có · ${incomplete} ảnh chưa hoàn tất.`;
      if (incomplete) setError(summary);
      else if (reused) setDuplicateNotice({ created, reused });
      else setNotice(summary);
    } catch (e) {
      setError(invoiceError(e).message);
    } finally {
      try {
        await invalidate(); setPreviewVersion(v => v + 1);
      } finally {
        uploadPending.current = false;
        setUploadProgress(null);
        setBusy("");
        if (uploadInput.current) uploadInput.current.value = "";
      }
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
      const result = await invoiceMutation<{ outcome: string }>(activeSelectedId, "record", payload);
      await invalidate();
      setVersion((v) => v + 1);
      setNotice(result.outcome === "ALREADY_CONFIRMED" ? "Hóa đơn đã được ghi sổ trước đó; không tạo thêm khoản chi." : result.outcome === "LINKED_PAYMENT" ? "Đã gắn hóa đơn vào khoản thanh toán có sẵn, không ghi chi lần hai." : "Đã ghi sổ hóa đơn và cập nhật khoản chi.");
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
      const { data } = await api.post(permanentDelete ? "/invoices/batch-purge" : "/invoices/batch-delete", {
        invoice_ids: deleting,
      });
      const removedCurrent = deleting.includes(activeSelectedId || "");
      setPage(1);
      setChecked([]);
      setDeleting(null);
      await invalidate();
      if (removedCurrent) setSelectedId(null);
      setNotice(
        permanentDelete
          ? `Đã xóa vĩnh viễn ${data.deleted} hóa đơn. Các khoản chi đã ghi sổ vẫn được giữ lại.`
          : `Đã chuyển ${data.deleted} hóa đơn vào Thùng rác, giữ trong 30 ngày. Các khoản chi đã ghi nhận vẫn được giữ lại.`,
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
    <div className={`cf-stack ${density.workspace}`}>
      <PageHead
        eyebrow="HÓA ĐƠN AI"
        title="Từ hóa đơn đến khoản chi"
        description="01 Tải lên · 02 Quét và kiểm tra · 03 Xác nhận giao dịch"
      />
      <div className={density.content}>
        {duplicateNotice && <Toast kind="info" title="Phát hiện hóa đơn trùng" className={density.duplicateToast} duration={6000} onDismiss={() => setDuplicateNotice(null)}>
          {duplicateNotice.created ? `Đã thêm ${duplicateNotice.created} hóa đơn mới; ${duplicateNotice.reused} ảnh trùng được giữ nguyên bản cũ.` : `${duplicateNotice.reused} ảnh đã có trong hệ thống. Không tạo thêm hóa đơn.`}
        </Toast>}
        {error && !deleting && <Alert onDismiss={() => setError("")}>{error}</Alert>}
        {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
        <InvoiceUploadZone inputRef={uploadInput} busy={!!busy} onUpload={upload} />
        <InvoiceIntakeFeedback entries={uploadResults} progress={uploadProgress} busy={!!busy} checking={busy === "upload"}
          onRetry={(file, token) => upload([file], token)} onOpen={id => { setSelectedId(id); setVersion(v => v + 1); }}
          onRemove={file => setUploadResults(rows => rows.filter(r => r.file !== file))} />
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
            onDelete={ids => { setError(""); setPermanentDelete(status === "HIDDEN"); setDeleting(ids); }}
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
                    style={{ paddingBottom: 0, justifyContent: inv.deleted_at ? "flex-end" : "space-between" }}
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
                      disabled={!!busy}
                      onClick={() => { setError(""); setPermanentDelete(!!inv.deleted_at); setDeleting([inv.id]); }}
                    >
                      <Trash2 />
                      {inv.deleted_at ? "Xóa vĩnh viễn" : "Chuyển vào Thùng rác"}
                    </button>
                  </div>
                  <InvoiceTrashNotice invoice={inv} busy={!!busy} onRestore={restoreInvoice} />
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
            <div style={{ minHeight: 240 }} className={`cf-ocr-preview-body ${inv?.status === "PROCESSING" ? "is-processing" : ""}`}>
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
                  <InvoicePdfPreview key={blob} src={blob} />
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
        <p className={`cf-muted ${density.note}`}>
          Nhận ảnh JPG, JPEG, PNG và WEBP, tối đa 3 ảnh/lượt và 20 MB/ảnh. Ảnh lớn được tự động giảm dung lượng trước khi tải lên.
          Mỗi lần quét lại hàng loạt tối đa 5 hóa đơn đã có.
        </p>
      </div>
      {deleting && (
        <Modal
          className={density.dialog}
          title={permanentDelete ? "Xóa vĩnh viễn hóa đơn" : "Chuyển hóa đơn vào Thùng rác"}
          onClose={() => { setDeleting(null); setError(""); }}
          busy={!!busy}
        >
          <div className={density.form}>
            <div className={density.fields}>
              {error && <Alert persistent onDismiss={() => setError("")}>{error}</Alert>}
              {permanentDelete ? <p>Xóa vĩnh viễn {deleting.length} hóa đơn cùng ảnh và chi tiết mặt hàng? Thao tác này không thể khôi phục. Các khoản chi đã ghi sổ vẫn được giữ lại.</p> : <p>
                Chuyển {deleting.length} hóa đơn vào Thùng rác? Giữ ảnh và thông tin trong 30 ngày, sau đó xóa vĩnh viễn hóa đơn. Các khoản chi đã ghi sổ vẫn được giữ.
                Bạn có thể khôi phục hóa đơn từ Thùng rác trước khi hết hạn.
              </p>}
            </div>
            <div className={density.footer}>
              <button
                className="cf-btn"
                disabled={!!busy}
                onClick={() => { setDeleting(null); setError(""); }}
              >
                Hủy
              </button>
              <button
                className="cf-btn cf-btn-danger"
                disabled={!!busy}
                onClick={remove}
              >
                {busy ? "Đang xử lý…" : permanentDelete ? "Xóa vĩnh viễn" : "Chuyển vào Thùng rác"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
