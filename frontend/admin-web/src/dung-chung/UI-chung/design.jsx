/**
 * ============================================================================
 * TÊN FILE: design.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Hệ thống thiết kế dùng chung
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp các primitive giao diện nhất quán cho toàn bộ cổng quản trị.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React, Lucide, Toast, Motion và class cf-* trong swiss.css.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất PageHead, Panel, Stat, form field, modal, pagination và các trạng thái.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Primitive chỉ trình bày; không tự gọi API hoặc quyết định quyền truy cập.
 * ============================================================================
 */
"use client";
import Toast from "./Toast";
import { MotionValue } from "./Motion";
import { useEffect, useId, useRef, cloneElement, isValidElement } from "react";
import {
  AlertCircle,
  Inbox,
  LoaderCircle,
  X,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
export function PageHead({ title, description, actions, eyebrow }) {
  return (
    <div className="cf-page-head">
      <div>
        {eyebrow && <div className="cf-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="cf-row">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section className={`cf-panel ${className}`}>
      {title && (
        <div className="cf-panel-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Stat({ label, value, note, icon, tone = "blue" }) {
  return (
    <div className={`cf-panel cf-stat cf-stat--${tone}`}>
      <div className="cf-stat-label">
        {label}
        {icon}
      </div>
      <div className="cf-stat-value cf-number"><MotionValue>{value}</MotionValue></div>
      {note && <p className="cf-stat-note">{note}</p>}
    </div>
  );
}
export function Alert({ children, kind = "error", persistent = false, onDismiss }) {
  if (persistent || kind === "info") {
    return <div role="status" className={`cf-alert ${kind}`}><AlertCircle /><div>{children}</div></div>;
  }
  return <Toast onDismiss={onDismiss} key={typeof children === "string" ? children : kind} kind={kind} duration={kind === "error" ? 8000 : 5000}>{children}</Toast>;
}
export function Empty({ title = "Chưa có dữ liệu", description, action }) {
  return (
    <div className="cf-state">
      <span className="cf-icon">
        <Inbox />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="cf-state" role="status">
      <LoaderCircle className="cf-spin" size={24} />
      <p>Đang tải dữ liệu…</p>
    </div>
  );
}
export function ErrorState({ retry }) {
  return (
    <div className="cf-state" role="alert">
      <AlertCircle size={24} />
      <h3>Không thể tải dữ liệu</h3>
      <p>Kiểm tra kết nối và thử lại.</p>
      <button className="cf-btn" onClick={retry}>
        Thử lại
      </button>
    </div>
  );
}
export function Field({ label, children, hint }) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": hint ? id + "-hint" : undefined,
      })
    : children;
  return (
    <div className="cf-field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
function visiblePages(page, pages) {
  const start = pages <= 7 || page <= 3 ? 1 : page >= pages - 2 ? pages - 4 : page - 2;
  const end = pages <= 7 || page >= pages - 2 ? pages : page <= 3 ? 5 : page + 2;
  const numbers = [...new Set([1, pages, ...Array.from({ length: end - start + 1 }, (_, index) => start + index)])].sort((a, b) => a - b);
  const result = [];
  for (const number of numbers) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && number - previous === 2) result.push(previous + 1);
    else if (typeof previous === "number" && number - previous > 2) result.push("…");
    result.push(number);
  }
  return result;
}

export function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const items = visiblePages(page, pages);
  return (
    <div className="cf-pagination">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`
          : "0"}{" "}
        / {total.toLocaleString("vi-VN")} bản ghi
      </span>
      <nav className="cf-page-controls" aria-label="Phân trang">
        <button
          type="button"
          className="cf-page-button"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronsLeft size={15} />
        </button>
        {items.map((item, index) => typeof item === "number" ? (
          <button
            key={item}
            type="button"
            className={`cf-page-button${item === page ? " active" : ""}`}
            aria-label={`Trang ${item}`}
            aria-current={item === page ? "page" : undefined}
            disabled={item === page}
            onClick={() => onChange(item)}
          >{item}</button>
        ) : <span key={`ellipsis-${index}`} className="cf-page-ellipsis" aria-hidden="true">…</span>)}
        <button
          type="button"
          className="cf-page-button"
          aria-label="Trang sau"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronsRight size={15} />
        </button>
      </nav>
    </div>
  );
}
export function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  const id = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const prior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busy) closeRef.current();
      if (e.key === "Tab") {
        const items = focusable();
        if (!items.length) {
          e.preventDefault();
          return;
        }
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [busy]);
  return (
    <div
      className="cf-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="cf-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
      >
        <div className="cf-dialog-head">
          <h2 id={id}>{title}</h2>
          <button
            className="cf-icon-btn"
            aria-label="Đóng"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>
        <div className="cf-dialog-body">{children}</div>
      </div>
    </div>
  );
}
export function Password({
  id,
  value,
  onChange,
  autoComplete = "new-password",
  minLength = 6,
  "aria-describedby": describedBy,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="cf-password">
      <input
        id={id}
        aria-describedby={describedBy}
        className="cf-input"
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
