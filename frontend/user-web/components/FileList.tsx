"use client";

export type FileInfo = { name: string; processed: boolean };

export default function FileList({
  files,
  busy,
  errors,
  onRunOne,
}: {
  files: FileInfo[];
  busy: boolean;
  errors: Record<string, string>;
  onRunOne: (name: string) => void;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-slate-600">Chưa có hoá đơn nào được upload.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200">
      {files.map((file) => {
        const error = errors[file.name];
        return (
          <li key={file.name} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{file.name}</span>

            {/* Badge trạng thái */}
            {error ? (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700" title={error}>
                Lỗi
              </span>
            ) : file.processed ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                Đã xử lý
              </span>
            ) : busy ? (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                Đang xử lý…
              </span>
            ) : (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Chưa xử lý
              </span>
            )}

            {/* Nút chạy lại OCR cho từng file */}
            <button
              onClick={() => onRunOne(file.name)}
              disabled={busy}
              className="rounded border border-slate-400 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Chạy lại
            </button>
          </li>
        );
      })}
    </ul>
  );
}
