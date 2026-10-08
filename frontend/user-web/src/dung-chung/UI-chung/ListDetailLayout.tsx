"use client";

import { useId, useRef, type MouseEvent, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import { Empty } from "./ui";
import styles from "./ListDetailLayout.module.css";

/** Khung danh sách/chi tiết dùng chung; không đọc hoặc thay đổi dữ liệu nghiệp vụ. */
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
