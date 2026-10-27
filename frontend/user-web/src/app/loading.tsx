export default function Loading() {
  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="w-10 h-10 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm font-medium text-slate-500">Đang tải không gian làm việc…</span>
    </div>
  );
}
