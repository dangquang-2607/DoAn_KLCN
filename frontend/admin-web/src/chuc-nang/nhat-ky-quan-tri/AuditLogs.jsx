import density from "../../dung-chung/CSS/operations.module.css";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AuditInspector, AuditLogActions, AuditLogTable } from "./thanh-phan/AuditWorkspace";
import DateInput from "../../dung-chung/UI-chung/DateInput";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import { ChevronDown, Filter, Globe, RotateCcw, Search, X } from "lucide-react";
import { useDebouncedValue } from "../../dung-chung/tien-ich/hooks";
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
  const query = useQuery({
    queryKey: ["audit-logs", page, term, group, result, start, end],
    queryFn: async ({ signal }) =>
      (
        await api.get("/admin/audit-logs", {
          params: {
            page,
            page_size: 20,
            search: term || undefined,
            group: group || undefined,
            result: result || undefined,
            start_date: start || undefined,
            end_date: end || undefined,
          },
          signal,
        })
      ).data,
  });
  const list = query.data?.items || [];
  const selectedId = selected === undefined ? list[0]?.id : selected;
  const detail = useQuery({
    queryKey: ["audit-detail", selectedId],
    queryFn: async ({ signal }) =>
      (await api.get(`/admin/audit-logs/${selectedId}`, { signal })).data,
    enabled: !!selectedId,
  });
  const filter = (setter, value) => {
    setter(value);
    setPage(1);
    setSelected(undefined);
  };
  const resetFilters = () => {
    setSearch("");
    setGroup("");
    setResult("");
    setStart("");
    setEnd("");
    setPage(1);
    setSelected(undefined);
  };
  const hasFilter = Boolean(search || group || result || start || end);

  return (
    <div className={`adm-surface adm-live adm-audit ${density.page}`}>
      <PageHead
        eyebrow="KIỂM TRA HOẠT ĐỘNG"
        title="Nhật ký quản trị"
        description="Lịch sử thao tác được ghi nhận để kiểm tra và đối soát."
        actions={
          <AuditLogActions
            page={page}
            list={query.isError ? [] : list}
            fetching={query.isFetching}
          />
        }
      />

      <div className="adm-audit-header">
        <div>
          <p className="adm-eyebrow">NHẬT KÝ HỆ THỐNG</p>
          <h2>Dòng hoạt động</h2>
          <span>{list.length} / {query.data?.total ?? "—"} bản ghi khớp bộ lọc</span>
        </div>
      </div>

      {/* Thanh bộ lọc gọn gàng, liền mạch trên cùng 1 hàng */}
      <div className="adm-audit-filter-bar">
        {/* Ô tìm kiếm */}
        <div className="adm-audit-filter-item adm-audit-search-item">
          <Search size={15} className="adm-audit-icon" aria-hidden="true" />
          <input
            maxLength={150}
            value={search}
            onChange={(e) => filter(setSearch, e.target.value)}
            placeholder="Hành động, người dùng, mã truy vết…"
            aria-label="Tìm kiếm nhật ký"
          />
          {search && (
            <button
              type="button"
              className="adm-audit-clear-btn"
              onClick={() => filter(setSearch, "")}
              title="Xóa tìm kiếm"
              aria-label="Xóa tìm kiếm"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Lọc theo Nhóm hoạt động */}
        <div className="adm-audit-filter-item adm-audit-select-item">
          <Filter size={15} className="adm-audit-icon" aria-hidden="true" />
          <select
            value={group}
            onChange={(e) => filter(setGroup, e.target.value)}
            aria-label="Lọc nhóm hoạt động"
          >
            <option value="">Mọi hoạt động</option>
            <option value="auth">Đăng nhập & phiên</option>
            <option value="users">Người dùng</option>
            <option value="categories">Danh mục</option>
            <option value="ocr">Hóa đơn / OCR</option>
            <option value="email">Email & cấu hình</option>
          </select>
          <ChevronDown size={14} className="adm-audit-chevron" aria-hidden="true" />
        </div>

        {/* Lọc theo Kết quả HTTP */}
        <div className="adm-audit-filter-item adm-audit-select-item">
          <Globe size={15} className="adm-audit-icon" aria-hidden="true" />
          <select
            value={result}
            onChange={(e) => filter(setResult, e.target.value)}
            aria-label="Lọc kết quả HTTP"
          >
            <option value="">Mọi kết quả HTTP</option>
            <option value="success">HTTP 2xx / 3xx</option>
            <option value="error">HTTP lỗi ≥ 400</option>
            <option value="unknown">Chưa ghi mã HTTP</option>
          </select>
          <ChevronDown size={14} className="adm-audit-chevron" aria-hidden="true" />
        </div>

        {/* Từ ngày */}
        <div className="adm-audit-filter-item adm-audit-date-item">
          <span className="adm-audit-inline-label">Từ</span>
          <DateInput
            value={start}
            max={end || undefined}
            onChange={(val) => filter(setStart, val)}
            aria-label="Từ ngày"
          />
        </div>

        {/* Đến ngày */}
        <div className="adm-audit-filter-item adm-audit-date-item">
          <span className="adm-audit-inline-label">Đến</span>
          <DateInput
            value={end}
            min={start || undefined}
            onChange={(val) => filter(setEnd, val)}
            aria-label="Đến ngày"
          />
        </div>

        {/* Nút Bỏ lọc */}
        {hasFilter && (
          <button
            type="button"
            className="adm-audit-reset-btn"
            onClick={resetFilters}
            title="Xóa toàn bộ bộ lọc"
          >
            <RotateCcw size={14} />
            <span>Bỏ lọc</span>
          </button>
        )}
      </div>

      <div className="adm-audit-layout">
        <AuditLogTable
          query={query}
          page={page}
          onPageChange={(value) => {
            setPage(value);
            setSelected(undefined);
          }}
          selectedId={selectedId}
          onSelect={(log) => setSelected(log.id)}
        />
        <AuditInspector
          selectedId={selectedId}
          query={detail}
          onClose={() => setSelected(null)}
        />
      </div>
      <p className="cf-data-note">
        Bộ lọc tìm trên toàn bộ nhật ký; Excel chỉ xuất trang đang hiển thị. Thời gian trên web theo múi giờ Việt Nam, trong file là UTC.
      </p>
    </div>
  );
}
