import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Empty } from "./design";

export default function Inspector({ selectedId, title, description, icon: Icon, onClose, ready = true, children, className = "", eyebrow = "CHI TIẾT ĐANG XEM", header }) {
  const heading = useRef(null);
  const previousId = useRef(null);
  const origin = useRef(null);
  useEffect(() => {
    if (selectedId && selectedId !== previousId.current) origin.current = document.activeElement;
    previousId.current = selectedId;
    if (!selectedId || !ready || !window.matchMedia("(max-width: 1100px)").matches ||
      !origin.current?.closest(".adm-rest-list,.adm-category-library,.adm-email-list,.adm-audit-mobile-list,.adm-audit-table-wrap")) return;
    heading.current?.closest(".cf-inspector")?.scrollIntoView({ block: "start", behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [selectedId, ready]);
  const close = () => {
    onClose?.();
    if (origin.current?.isConnected) {
      origin.current.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1100px)").matches) origin.current.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  };
  return <aside className={`adm-card cf-inspector ${className}`} aria-label={eyebrow}>
      <div className="adm-live-inspector-head"><div>{header || <><span className="cf-accent-icon cf-tone-violet">{Icon && <Icon size={21} aria-hidden="true" />}</span><p className="adm-eyebrow">{eyebrow}</p></>}</div>{selectedId && <button className="cf-icon-btn" aria-label="Đóng chi tiết" onClick={close}><X size={17} /></button>}</div>
      {header && <p className="adm-eyebrow">{eyebrow}</p>}
      <h2 ref={heading} tabIndex={-1} className="cf-inspector-title">{title}</h2>
      {description && <p className="cf-muted">{description}</p>}
      {selectedId ? children : <Empty title="Chọn một bản ghi" description="Chọn một mục trong danh sách để kiểm tra thông tin chi tiết." />}
  </aside>;
}
