"use client";

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, AlertTriangle, Info, X } from "lucide-react";

export interface ToastProps {
  children: ReactNode;
  kind?: "success" | "error" | "info";
  duration?: number;
  onDismiss?: () => void;
}

export default function Toast({
  children,
  kind = "info",
  duration = 5000,
  onDismiss,
}: ToastProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let region = document.getElementById("cf-toast-region");
    if (!region) {
      region = document.createElement("section");
      region.id = "cf-toast-region";
      region.className = "cf-toast-region";
      region.setAttribute("aria-label", "Thông báo hệ thống");
      document.body.appendChild(region);
    }
    const slot = document.createElement("div");
    region.appendChild(slot);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(slot);

    return () => {
      slot.remove();
      if (!region.childElementCount) region.remove();
    };
  }, []);

  const Icon = kind === "success" ? Check : kind === "error" ? AlertTriangle : Info;
  if (!host || hidden) return null;

  return createPortal(
    <article
      className={`cf-toast cf-toast-${kind}${leaving ? " cf-toast-leaving" : ""}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && leaving) {
          setHidden(true);
          onDismiss?.();
        }
      }}
    >
      <span className="cf-toast-emblem" aria-hidden="true">
        <Icon size={21} strokeWidth={2.2} />
      </span>
      <div className="cf-toast-content" role={kind === "error" ? "alert" : "status"} aria-atomic="true">
        <strong>
          {kind === "success" ? "Thành công" : kind === "error" ? "Cần kiểm tra" : "Thông tin"}
        </strong>
        <div>{children}</div>
      </div>
      <button
        className="cf-toast-close"
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => setLeaving(true)}
      >
        <X size={17} />
      </button>
      <span className="cf-toast-track" aria-hidden="true">
        <span
          style={{ animationDuration: `${duration}ms` }}
          onAnimationEnd={() => setLeaving(true)}
        />
      </span>
    </article>,
    host,
  );
}
