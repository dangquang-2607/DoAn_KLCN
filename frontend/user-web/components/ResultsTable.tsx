"use client";

import { useState } from "react";

// Index các cột tiền → hiển thị định dạng 1.234.567 và căn phải
const MONEY_COLUMNS = new Set([5, 7, 8]);
const STATUS_COLUMN = 10; // "Tình trạng hoá đơn" → hiển thị badge màu

function display(column: number, value: string): string {
  if (MONEY_COLUMNS.has(column) && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value).toLocaleString("vi-VN");
  }
  return value;
}

export default function ResultsTable({
  fields,
  rows,
  onSave,
}: {
  fields: string[];
  rows: string[][];
  onSave: (index: number, row: string[]) => Promise<void>;
}) {
  // State lưu ô đang được chỉnh sửa: { r: row index, c: col index, value }
  const [editing, setEditing] = useState<{ r: number; c: number; value: string } | null>(null);

  async function commit() {
    if (!editing) return;
    const row = [...rows[editing.r]]; // clone để không mutate trực tiếp
    row[editing.c] = editing.value;
    setEditing(null);
    await onSave(editing.r, row); // gọi PUT /api/results
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Chưa có kết quả OCR nào. Upload hoá đơn rồi bấm <b>Chạy OCR</b>.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1600px] border-collapse text-sm">
        <thead>
          <tr className="bg-emerald-800 text-left text-xs uppercase tracking-wide text-white">
            <th className="border border-emerald-700 px-3 py-2.5">\#</th>
            {fields.map((field) => (
              <th key={field} className="border border-emerald-700 px-3 py-2.5 font-bold">
                {field}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={`${row[14]}-${r}`} className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 transition-colors">
              <td className="border border-slate-200 px-3 py-1.5 text-center text-sm font-medium text-slate-600">{r + 1}</td>
              {row.map((value, c) => (
                <td
                  key={c}
                  className={`border border-slate-200 px-3 py-1.5 text-slate-800 ${
                    MONEY_COLUMNS.has(c) ? "text-right tabular-nums" : ""
                  }`}
                  onClick={() => setEditing({ r, c, value })} // click vào ô → chỉnh sửa
                >
                  {editing && editing.r === r && editing.c === c ? (
                    // Ô đang được chỉnh sửa → hiện input
                    <input
                      autoFocus
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onBlur={() => void commit()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commit();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="w-full min-w-24 rounded border border-emerald-500 bg-white px-1 py-0.5 text-slate-900 outline-none ring-2 ring-emerald-300"
                    />
                  ) : c === STATUS_COLUMN && value ? (
                    // Cột tình trạng → badge màu
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        /hợp lệ|gốc/i.test(value)
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {value}
                    </span>
                  ) : (
                    <span className="block min-h-5 cursor-text">{display(c, value)}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
