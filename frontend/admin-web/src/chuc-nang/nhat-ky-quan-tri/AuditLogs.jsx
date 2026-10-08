/**
 * ============================================================================
 * TÊN FILE: AuditLogs.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Nhật ký quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối phân trang, truy vấn và bản ghi nhật ký đang được xem.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query, admin API client và các component audit-logs.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route AuditLogs với bộ lọc, xuất CSV trang hiện tại và bảng chi tiết.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   API phân trang và lọc phía máy chủ; dữ liệu nhạy cảm được che ở backend.
 * ============================================================================
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import AuditInspector from "./thanh-phan/AuditInspector";
import AuditLogActions from "./thanh-phan/AuditLogActions";
import AuditLogTable from "./thanh-phan/AuditLogTable";
import { Field } from "../../dung-chung/UI-chung/design";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import { Filter, Search } from "lucide-react";
import useDebouncedValue from "../../dung-chung/tien-ich/useDebouncedValue";
import api from "../../dung-chung/connect-api/api";

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(undefined);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [result, setResult] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const term = useDebouncedValue(search);
  const query = useQuery({ queryKey: ["audit-logs", page, term, group, result, start, end], queryFn: async ({ signal }) => (await api.get("/admin/audit-logs", { params: { page, page_size: 20, search: term || undefined, group: group || undefined, result: result || undefined, start_date: start || undefined, end_date: end || undefined }, signal })).data });
  const list = query.data?.items || [];
  const selectedId = selected === undefined ? list[0]?.id : selected;
  const detail = useQuery({ queryKey: ["audit-detail", selectedId], queryFn: async ({ signal }) => (await api.get(`/admin/audit-logs/${selectedId}`, { signal })).data, enabled: !!selectedId });
  const filter = (setter, value) => { setter(value); setPage(1); setSelected(undefined); };
  return (
    <div className="adm-surface adm-live adm-audit-demo">
      <PageHead eyebrow="KIỂM TRA HOẠT ĐỘNG" title="Nhật ký quản trị" description="Lịch sử thao tác được ghi nhận để kiểm tra và đối soát." actions={<AuditLogActions page={page} list={list} fetching={query.isFetching} onRefresh={() => query.refetch()} />} />
      <div className="adm-audit-toolbar"><div><p className="adm-eyebrow">NHẬT KÝ HỆ THỐNG</p><h2>Dòng hoạt động</h2><span>{list.length} / {query.data?.total ?? "—"} bản ghi khớp bộ lọc</span></div><div className="adm-audit-controls"><label className="adm-audit-search"><Search size={17} /><span className="adm-visually-hidden">Tìm nhật ký</span><input maxLength={150} value={search} onChange={(e) => filter(setSearch, e.target.value)} placeholder="Hành động, người dùng, mã truy vết…" /></label><label className="adm-audit-filter"><Filter size={16} /><span className="adm-visually-hidden">Nhóm hoạt động</span><select value={group} onChange={(e) => filter(setGroup, e.target.value)}>{[["", "Mọi hoạt động"], ["auth", "Đăng nhập & phiên"], ["users", "Người dùng"], ["categories", "Danh mục"], ["ocr", "Hóa đơn / OCR"], ["email", "Email & cấu hình"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></div>
      <details className="adm-live-advanced"><summary>Lọc thêm theo ngày & kết quả HTTP{result || start || end ? " · Đang áp dụng" : ""}</summary><div className="cf-filter-bar"><Field label="Kết quả HTTP"><select className="cf-input" value={result} onChange={(e) => filter(setResult, e.target.value)}><option value="">Mọi kết quả</option><option value="success">HTTP 2xx / 3xx</option><option value="error">HTTP lỗi ≥ 400</option><option value="unknown">Chưa ghi mã HTTP</option></select></Field><Field label="Từ ngày"><input className="cf-input" type="date" value={start} max={end || undefined} onChange={(e) => filter(setStart, e.target.value)} /></Field><Field label="Đến ngày"><input className="cf-input" type="date" value={end} min={start || undefined} onChange={(e) => filter(setEnd, e.target.value)} /></Field></div></details>
      {(search || group || result || start || end) && <button className="cf-btn" onClick={() => { setSearch(""); setGroup(""); setResult(""); setStart(""); setEnd(""); setPage(1); setSelected(undefined); }}>Bỏ lọc</button>}
      <div className="adm-audit-layout"><AuditLogTable query={query} page={page} onPageChange={(value) => { setPage(value); setSelected(undefined); }} selectedId={selectedId} onSelect={(log) => setSelected(log.id)} /><AuditInspector selectedId={selectedId} query={detail} onClose={() => setSelected(null)} /></div>
      <p className="cf-data-note">Bộ lọc tìm trên toàn bộ nhật ký; CSV chỉ xuất trang đang hiển thị. Thời gian hiển thị theo múi giờ Việt Nam.</p>
    </div>
  );
}
