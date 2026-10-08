import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

// Portal prevents menus from being clipped by horizontally scrollable tables.
// Standard buttons support Tab navigation; Escape/outside click closes safely.
export default function ActionMenu({ label, actions }) {
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector("button")?.focus();
    const closeOutside = (event) => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null);
    };
    const escape = (event) => { if (event.key === "Escape") { setPosition(null); trigger.current?.focus(); } };
    const closeOnMove = (event) => { if (!menu.current?.contains(event.target)) setPosition(null); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", closeOnMove, true);
    window.addEventListener("resize", closeOnMove);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", closeOnMove, true);
      window.removeEventListener("resize", closeOnMove);
    };
  }, [position]);
  if (!actions.length) return null;
  return <>
    <button ref={trigger} className="cf-icon-btn" aria-label={label} aria-expanded={!!position} aria-controls={position ? id : undefined} onClick={() => {
      const rect = trigger.current.getBoundingClientRect();
      setPosition(position ? null : { left: Math.max(8, Math.min(rect.right - 230, window.innerWidth - 238)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - actions.length * 42 - 22)) });
    }}><MoreHorizontal size={18} /></button>
    {position && createPortal(<div className="cf-admin cf-action-menu-layer"><div ref={menu} id={id} className="cf-action-menu" style={position} role="group" aria-label={label}>{actions.map(({ key, label: itemLabel, Icon, danger, onClick }) => <button key={key} className={danger ? "is-danger" : ""} onClick={() => { trigger.current?.focus(); setPosition(null); onClick(); }}><Icon size={16} />{itemLabel}</button>)}</div></div>, document.body)}
  </>;
}
