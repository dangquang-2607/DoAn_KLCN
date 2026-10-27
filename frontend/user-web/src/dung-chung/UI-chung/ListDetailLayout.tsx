/**
 * ============================================================================
 * TÊN FILE: ListDetailLayout.tsx
 * MÀN HÌNH / PHÂN HỆ: Bố cục Master - Detail dùng chung
 * NHÓM VỆ TINH: dung-chung (Bố cục giao diện)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp bố cục hai cột chuẩn hóa: cột trái danh sách phân loại, cột phải hiển thị
 *   chi tiết bản ghi được chọn; tự động chuyển sang chế độ ngăn kéo (drawer) trên di động.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   listTitle, count, list, selectedKey, title, eyebrow, header, onClose, children.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export ListDetailLayout component và component phụ RecordRow.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tuân thủ quy chuẩn W3C WAI-ARIA cho vùng hiển thị danh sách và chi tiết.
 * ============================================================================
 */
"use client";

import { useId, useRef, type MouseEvent, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import { Empty } from "./ui";
import styles from "./ListDetailLayout.module.css";

/** Khung danh sách/chi tiết dùng chung; không đọc hoặc thay đổi dữ liệu nghiệp vụ. */
/**
 * Bố cục giao diện hai cột Master - Detail thích ứng đa màn hình.
 */
export default function ListDetailLayout({ listTitle, count, list, selectedKey, title, eyebrow, header, onClose, children }: {
  listTitle: string; count: number; list: ReactNode; selectedKey?: string;
  title: string; eyebrow: string; header?: ReactNode; onClose: () => void; children: ReactNode;
}) {
  const headingId = useId();
  const listRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const revealDetails = (event: MouseEvent<HTMLElement>) => {
    const origin = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-record-key]") : null;
    if (!origin || !listRef.current?.contains(origin)) return;
    originRef.current = origin;
    if (window.matchMedia("(max-width: 1100px)").matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
        headingRef.current?.focus({ preventScroll: true });
      });
    }
  };

  const close = () => {
    onClose();
    if (originRef.current?.isConnected) {
      originRef.current.focus({ preventScroll: true });
      originRef.current.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  };

  return <div className={styles.layout}>
    <section ref={listRef} className={styles.library} aria-label={listTitle} onClickCapture={revealDetails}>
      <div className={styles.listHead}><h2>{listTitle}</h2><span>{count} mục</span><p>Chọn một dòng để xem chi tiết.</p></div>
      {list}
    </section>
    <aside ref={detailRef} className={styles.inspector} aria-labelledby={headingId}>
      <div className={styles.detailHead}>
        <div>{header}<p className="cf-eyebrow">{eyebrow}</p></div>
        {selectedKey && <button type="button" className="cf-icon-btn" aria-label="Đóng chi tiết" onClick={close}><X size={17} /></button>}
      </div>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.detailTitle}>{title}</h2>
      {selectedKey ? children : <Empty title="Chưa chọn mục nào" description="Chọn một dòng trong danh sách để xem thông tin và các thao tác." />}
    </aside>
  </div>;
}

export function RecordRow({ recordKey, selected, leading, title, description, trailing, onSelect }: {
  recordKey: string; selected: boolean; leading: ReactNode; title: string;
  description: ReactNode; trailing?: ReactNode; onSelect: () => void;
}) {
  return <button type="button" data-record-key={recordKey} className={`${styles.row} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onSelect}>
    <span className={styles.leading}>{leading}</span>
    <span className={styles.rowCopy}><strong>{title}</strong><span>{description}</span></span>
    <span className={styles.trailing}>{trailing}</span>
    <ChevronRight className={styles.chevron} size={16} aria-hidden="true" />
  </button>;
}
