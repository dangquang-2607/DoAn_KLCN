"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export default function InvoicePdfPreview({ src }: { src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [failedPage, setFailedPage] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;

    async function load() {
      const pdf = await import("pdfjs-dist");
      if (!active) return;
      pdf.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
      ).href;
      task = pdf.getDocument({ url: src, useWasm: false, enableXfa: false });
      const result = await task.promise;
      if (active) setDocument(result);
    }

    void load().catch(() => { if (active) setFailedPage(0); });
    return () => {
      active = false;
      void task?.destroy().catch(() => {});
    };
  }, [src]);

  useEffect(() => {
    const target = canvas.current;
    if (!document || !target) return;
    let active = true;
    let renderTask: RenderTask | undefined;

    const render = async () => {
      const pdfPage = await document.getPage(page);
      if (!active) return;
      const size = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(2, 1800 / Math.max(size.width, size.height));
      const viewport = pdfPage.getViewport({ scale });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      renderTask = pdfPage.render({ canvas: target, viewport });
      await renderTask.promise;
      if (active) {
        setFailedPage(null);
        setRenderedPage(page);
      }
    };

    void render().catch(() => { if (active) setFailedPage(page); });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, page]);

  const failed = failedPage === 0 || failedPage === page;
  const ready = renderedPage === page && !failed;

  return (
    <div className="cf-image-scroll">
      {document && document.numPages > 1 && (
        <nav className="cf-pdf-pages" aria-label="Trang bản gốc PDF">
          <button type="button" className="cf-btn cf-btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
          <span aria-live="polite">{page} / {document.numPages}</span>
          <button type="button" className="cf-btn cf-btn-sm" disabled={page === document.numPages} onClick={() => setPage(page + 1)}>Trang sau</button>
        </nav>
      )}
      <canvas ref={canvas} role="img" aria-label={`Bản gốc hóa đơn PDF, trang ${page}`} hidden={!ready} />
      {!ready && (
        <p role="status" className="cf-muted">
          {failed ? "Không hiển thị được bản xem trước. Chọn Mở bản gốc để xem tệp." : "Đang tải bản xem trước PDF…"}
        </p>
      )}
    </div>
  );
}
