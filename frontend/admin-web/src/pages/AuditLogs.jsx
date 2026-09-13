import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import api from "../services/api";
import { exportCsv } from "../services/format";
import {
  PageHead,
  Panel,
  Loading,
  ErrorState,
  Empty,
  Pagination,
  Modal,
} from "../components/design";
export default function AuditLogs() {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState(null);
  const query = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: async () =>
      (await api.get("/admin/audit-logs", { params: { page, page_size: 20 } }))
        .data,
  });
  const list = query.data?.items || [];
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="KIỂM TRA HOẠT ĐỘNG"
        title="Nhật ký quản trị"
        description="Lịch sử thao tác được ghi nhận để kiểm tra và đối soát."
        actions={
          <>
            <button
              className="cf-btn"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw />
              Làm mới
            </button>
            <button
              className="cf-btn"
              disabled={!list.length}
              onClick={() =>
                exportCsv("nhat-ky-trang-" + page + ".csv", [
                  [
                    "Thời gian",
                    "Người thực hiện",
                    "Hành động",
                    "Đối tượng",
                    "Mã đối tượng",
                  ],
                  ...list.map((l) => [
                    l.created_at,
                    l.admin_id,
                    l.action,
                    l.target_type,
                    l.target_id,
                  ]),
                ])
              }
            >
              <Download />
              Xuất trang này
            </button>
          </>
        }
      />
      <Panel>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState retry={() => query.refetch()} />
        ) : !list.length ? (
          <Empty title="Chưa có nhật ký" />
        ) : (
          <div className="cf-table-wrap">
            <table className="cf-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Hành động</th>
                  <th>Người thực hiện</th>
                  <th>Đối tượng</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString("vi-VN")}</td>
                    <td>
                      <span className="cf-badge info">{l.action}</span>
                    </td>
                    <td title={l.admin_id}>
                      {l.admin_id === "None"
                        ? "Hệ thống"
                        : l.admin_id?.slice(0, 8) || "—"}
                    </td>
                    <td>{l.target_type || "—"}</td>
                    <td>
                      <button
                        className="cf-btn cf-btn-sm"
                        onClick={() => setSelected(l)}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          pageSize={20}
          total={query.data?.total || 0}
          onChange={setPage}
        />
      </Panel>
      {selected && (
        <Modal title="Chi tiết nhật ký" onClose={() => setSelected(null)}>
          <div className="cf-form">
            {[
              ["Hành động", selected.action],
              ["Người thực hiện", selected.admin_id],
              ["Loại đối tượng", selected.target_type],
              ["Mã đối tượng", selected.target_id],
              [
                "Thời gian",
                new Date(selected.created_at).toLocaleString("vi-VN"),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="cf-eyebrow">{label}</div>
                <div style={{ overflowWrap: "anywhere" }}>{value || "—"}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
