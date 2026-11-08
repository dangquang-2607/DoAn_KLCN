"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, ScanLine } from "lucide-react";
import { Alert, Field } from "@/dung-chung/UI-chung/ui";
import styles from "../CSS/BillPayment.module.css";

export default function BillQrScanner({ onRead }: { onRead: (value: string, signal: AbortSignal) => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [captureOnly, setCaptureOnly] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const capture = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    generation.current += 1;
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  useEffect(() => () => { stop(); request.current?.abort(); }, [stop]);

  const accept = async (value: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(""); stop(); setCamera(false);
    request.current = new AbortController();
    try { await onRead(value.trim(), request.current.signal); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Không đọc được hóa đơn. Hãy thử lại."); }
    finally { pending.current = false; setBusy(false); }
  };

  const fromImage = async (file?: File) => {
    if (!file || pending.current) return;
    if (file.size > 10 * 1024 * 1024 || !/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setError("Chọn ảnh QR PNG, JPG, WebP hoặc SVG, tối đa 10 MB."); return;
    }
    pending.current = true; setBusy(true); setError("");
    stop(); setCamera(false);
    const version = generation.current;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Trình duyệt chưa hỗ trợ đọc ảnh QR.");
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { default: jsQR } = await import("jsqr");
      const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (!code) throw new Error("Không tìm thấy QR trong ảnh. Hãy chọn ảnh có mã QR rõ, đủ bốn góc.");
      if (generation.current !== version) return;
      pending.current = false;
      await accept(code.data);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Không đọc được ảnh QR."); }
    finally { URL.revokeObjectURL(url); pending.current = false; setBusy(false); }
  };

  const startCamera = async () => {
    if (pending.current || camera || busy) return;
    if (captureOnly || !navigator.mediaDevices?.getUserMedia) {
      setCaptureOnly(true); setError(""); capture.current?.click(); return;
    }
    const version = ++generation.current;
    setBusy(true); setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (generation.current !== version) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const element = video.current;
      if (!element) { stop(); return; }
      element.srcObject = media; await element.play();
      if (generation.current !== version) { media.getTracks().forEach((track) => track.stop()); return; }
      setCamera(true);
      const { default: jsQR } = await import("jsqr");
      if (generation.current !== version) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const scan = async () => {
        if (generation.current !== version || !context) return;
        try {
        if (element.readyState >= 2 && element.videoWidth && element.videoHeight) {
          const scale = Math.min(1, 960 / element.videoWidth);
          canvas.width = Math.round(element.videoWidth * scale); canvas.height = Math.round(element.videoHeight * scale);
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
          if (code) { await accept(code.data); return; }
        }
        timer.current = setTimeout(() => { void scan(); }, 250);
        } catch {
          stop(); setCamera(false); setError("Không đọc được camera. Hãy bật lại camera hoặc chọn ảnh QR.");
        }
      };
      void scan();
    } catch (failure) {
      stop(); setCamera(false); setCaptureOnly(true);
      const denied = failure instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(failure.name);
      setError(denied
        ? "Trình duyệt chưa cho phép quét trực tiếp. Bạn có thể chụp ảnh QR, chọn ảnh hoặc cho phép camera trong cài đặt trình duyệt."
        : "Không mở được camera trực tiếp. Hãy chụp ảnh QR hoặc chọn ảnh có sẵn.");
    } finally { setBusy(false); }
  };

  return <section className={styles.scanner} aria-label="Quét QR hóa đơn">
    <p>Quét mã từ màn hình hóa đơn mô phỏng. Bạn sẽ kiểm tra thông tin và chọn ví trước khi thanh toán.</p>
    {error && <Alert persistent>{error}</Alert>}
    <video ref={video} muted playsInline hidden={!camera} className={styles.video} aria-label="Camera quét QR" />
    <div className={styles.paymentActions}>
      <button type="button" className="cf-btn" disabled={busy} onClick={() => camera ? (stop(), setCamera(false)) : void startCamera()}><Camera size={17} />{camera ? "Tắt camera" : captureOnly ? "Chụp ảnh QR" : "Mở camera"}</button>
      <button type="button" className="cf-btn cf-btn-primary" disabled={busy} onClick={() => { setError(""); input.current?.click(); }}><ImagePlus size={17} />Chọn ảnh QR</button>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { void fromImage(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={capture} type="file" hidden accept="image/*" capture="environment" aria-label="Chụp ảnh QR" onChange={(event) => { void fromImage(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {busy && <p role="status">Đang đọc QR…</p>}
    <details><summary>Dán nội dung QR</summary>
      <Field label="Nội dung QR hóa đơn"><textarea className="cf-input" rows={3} maxLength={4096} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} /></Field>
      <button type="button" className="cf-btn" disabled={busy || !text.trim()} onClick={() => void accept(text)}><ScanLine size={17} />Đọc hóa đơn</button>
    </details>
  </section>;
}
