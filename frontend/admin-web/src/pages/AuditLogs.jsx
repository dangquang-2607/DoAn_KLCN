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
 *   Xuất route AuditLogs với làm mới, xuất CSV và modal chi tiết.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ truyền page/page_size vì backend chưa hỗ trợ các filter khác.
 * ============================================================================
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import AuditDetailModal from "../components/audit-logs/AuditDetailModal";
import AuditLogActions from "../components/audit-logs/AuditLogActions";
import AuditLogTable from "../components/audit-logs/AuditLogTable";
import { PageHead } from "../components/design";
import api from "../services/api";

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const query = useQuery({ queryKey: ["audit-logs", page], queryFn: async () => (await api.get("/admin/audit-logs", { params: { page, page_size: 20 } })).data });
  const list = query.data?.items || [];
  return (
    <div className="cf-stack">
      <PageHead eyebrow="KIỂM TRA HOẠT ĐỘNG" title="Nhật ký quản trị" description="Lịch sử thao tác được ghi nhận để kiểm tra và đối soát." actions={<AuditLogActions page={page} list={list} fetching={query.isFetching} onRefresh={() => query.refetch()} />} />
      <AuditLogTable query={query} page={page} onPageChange={setPage} onSelect={setSelected} />
      <AuditDetailModal selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
