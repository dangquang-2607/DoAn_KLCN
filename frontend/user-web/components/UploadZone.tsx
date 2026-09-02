"use client";

import { useRef, useState } from "react";

export default function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  async function upload(fileList: FileList | File[]) {
    setError("");
    const form = new FormData();
    for (const file of Array.from(fileList)) form.append("files", file);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) setError(data.error ?? "Upload thất bại");
    else if (data.rejected?.length)
      setError(`Bỏ qua file không hỗ trợ: ${data.rejected.join(", ")}`);

    onUploaded(); // báo page.tsx refresh danh sách file
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-500"
        }`}
      >
        <p className="font-semibold text-slate-800">Kéo thả hoá đơn vào đây hoặc bấm để chọn file</p>
        <p className="mt-1 text-sm text-slate-600">Hỗ trợ JPG, PNG, WebP, PDF — chọn được nhiều file</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
