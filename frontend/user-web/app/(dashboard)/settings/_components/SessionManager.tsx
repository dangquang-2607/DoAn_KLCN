/**
 * ============================================================================
 * TÊN FILE: SessionManager.tsx
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Tải và hiển thị các phiên đăng nhập còn hiệu lực.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất SessionManager để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không ghi log mật khẩu/token; khóa thao tác khi đang gửi và xử lý phiên hết hạn nhất quán.
 * ============================================================================
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Empty, ErrorState, Loading, Panel } from "@/components/ui/ui";
import { dateLabel } from "@/lib/finance";

type Session = { id: string; device_name: string; ip_address: string; created_at: string; expires_at: string };

/** Tải và hiển thị riêng các phiên đăng nhập còn hiệu lực của tài khoản. */
export default function SessionManager() {
  const sessions = useQuery<Session[]>({ queryKey: ["sessions"], queryFn: async () => (await api.get("/auth/sessions")).data });
  return <Panel title="Phiên đăng nhập" description="Các phiên còn hiệu lực của tài khoản.">
    {sessions.isPending ? <Loading /> : sessions.isError ? <ErrorState retry={() => sessions.refetch()} /> : !sessions.data?.length ? <Empty title="Chưa có phiên đăng nhập" /> : sessions.data.map((session) => <div className="cf-list-row" key={session.id}><div><strong>{session.device_name || "Thiết bị chưa xác định"}</strong><small>{session.ip_address || "Không có địa chỉ IP"} · Bắt đầu {dateLabel(session.created_at)}</small></div><span className="cf-muted">Hết hạn {dateLabel(session.expires_at)}</span></div>)}
  </Panel>;
}
