/**
 * ============================================================================
 * TÊN FILE: SessionManager.tsx
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
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
import { useState } from "react";
import { ChevronLeft, ChevronRight, Laptop } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Empty, ErrorState, Loading, Panel } from "@/dung-chung/UI-chung/ui";
import { dateLabel } from "@/dung-chung/tien-ich/finance";

type Session = { id: string; device_name: string; ip_address: string; created_at: string; expires_at: string };

/** Tải và hiển thị riêng các phiên đăng nhập còn hiệu lực của tài khoản. */
export default function SessionManager() {
  const [requestedPage, setPage] = useState(1);
  const sessions = useQuery<Session[]>({ queryKey: ["sessions"], queryFn: async () => (await api.get("/auth/sessions")).data });
  const total = sessions.data?.length || 0;
  const pages = Math.max(1, Math.ceil(total / 4));
  const page = Math.min(requestedPage, pages);
  const start = (page - 1) * 4;
  const items = sessions.data?.slice(start, start + 4) || [];
  return <Panel className="cf-security-card cf-security-sessions" title="Phiên đăng nhập"
    description={sessions.isPending ? "Đang kiểm tra các phiên…" : sessions.isError ? "Chưa tải được thông tin phiên" : `${total} phiên còn hiệu lực của tài khoản.`}
    action={<Laptop size={21} aria-hidden="true" />}>
    {sessions.isPending ? <Loading /> : sessions.isError ? <ErrorState retry={() => sessions.refetch()} /> : !total ? <Empty title="Chưa có phiên đăng nhập" /> : <>
      <ul className="cf-security-session-list">{items.map((session) => <li className="cf-security-session" key={session.id}>
        <span className="cf-security-device-icon"><Laptop size={18} aria-hidden="true" /></span>
        <div><strong>{session.device_name || "Thiết bị chưa xác định"}</strong><span className="cf-security-session-address">{session.ip_address || "Không có địa chỉ IP"}</span><small>Bắt đầu {dateLabel(session.created_at)}</small>
          <details><summary>Thông tin phiên</summary><dl><dt>Thiết bị ghi nhận</dt><dd>{session.device_name || "Chưa ghi nhận"}</dd><dt>Hết hạn</dt><dd>{dateLabel(session.expires_at)}</dd></dl></details>
        </div>
      </li>)}</ul>
      <footer className="cf-security-session-footer"><span aria-live="polite">{start + 1}–{Math.min(start + 4, total)} / {total} phiên</span>{pages > 1 && <nav aria-label="Phân trang phiên đăng nhập">
        <button type="button" className="cf-icon-btn" aria-label="Các phiên trước" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span>{page} / {pages}</span><button type="button" className="cf-icon-btn" aria-label="Các phiên tiếp theo" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button>
      </nav>}</footer>
    </>}
  </Panel>;
}
