import type { ReactNode, ReactPortal } from "react";
export default function Toast(props: {
  children: ReactNode;
  kind?: "success" | "error" | "info";
  duration?: number;
  onDismiss?: () => void;
}): ReactPortal | null;
