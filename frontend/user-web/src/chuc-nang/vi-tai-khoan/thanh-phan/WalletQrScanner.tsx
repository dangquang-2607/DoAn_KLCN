"use client";
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Alert } from "@/dung-chung/UI-chung/ui";
import styles from "../CSS/BillPayment.module.css";

export default function WalletQrScanner({ kind, onRead }: {
  kind: "bill" | "transfer";
  onRead: (value: string, signal: AbortSignal) => void | Promise<void>;
}) {
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"starting" | "scanning" | "reading" | "idle">("starting");
  const [attempt, setAttempt] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const onReadRef = useRef(onRead);

  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const element = video.current;
    const stop = () => {
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (element) element.srcObject = null;
    };
    const fail = (message: string) => {
      if (!active) return;
      stop();
      setError(message);
      setStatus("idle");
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Trình duyệt chưa hỗ trợ camera. Hãy mở trang bằng HTTPS trên Safari hoặc Chrome để quét QR.");
        }
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (!active || !element) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        element.srcObject = media;
        await element.play();
        if (!active) return;
        const { default: jsQR } = await import("jsqr");
        if (!active) return;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Trình duyệt chưa hỗ trợ đọc QR từ camera.");
        setStatus("scanning");

        const scan = async () => {
          if (!active) return;
          try {
            if (element.readyState >= 2 && element.videoWidth && element.videoHeight) {
              const scale = Math.min(1, 960 / element.videoWidth);
              canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
              canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
              context.drawImage(element, 0, 0, canvas.width, canvas.height);
              const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data,
                canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
              if (code) {
                stop();
                setStatus("reading");
                await onReadRef.current(code.data.trim(), controller.signal);
                if (active) setStatus("idle");
                return;
              }
            }
            timer = setTimeout(() => { void scan(); }, 250);
          } catch (failure) {
            fail(failure instanceof Error ? failure.message : "Không đọc được mã QR. Hãy thử lại.");
          }
        };
        void scan();
      } catch (failure) {
        const denied = failure instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(failure.name);
        fail(denied
          ? "Chưa có quyền dùng camera. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại."
          : failure instanceof Error && !(failure instanceof DOMException) ? failure.message
            : "Không mở được camera. Hãy kiểm tra camera có đang được ứng dụng khác sử dụng rồi thử lại.");
      }
    };
    void start();
    return () => {
      active = false;
      stop();
      controller.abort();
    };
  }, [attempt]);

  return <section className={styles.scanner} aria-label={kind === "transfer" ? "Quét QR nhận tiền" : "Quét QR hóa đơn"}>
    <video ref={video} muted playsInline hidden={status === "idle" || status === "reading"}
      className={styles.video} aria-label="Camera quét QR" />
    {status !== "idle" && <p role="status">{status === "starting" ? "Đang mở camera…"
      : status === "reading" ? "Đang đọc QR…"
        : "Đưa mã QR vào khung hình để quét."}</p>}
    {error && <>
      <Alert persistent>{error}</Alert>
      <button type="button" className="cf-btn" onClick={() => {
        setError(""); setStatus("starting"); setAttempt((value) => value + 1);
      }}><Camera size={17} aria-hidden="true" />Thử lại camera</button>
    </>}
  </section>;
}
