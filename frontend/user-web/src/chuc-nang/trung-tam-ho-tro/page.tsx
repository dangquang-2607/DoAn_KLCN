/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Trung tâm hỗ trợ
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
"use client";
import { PageHead } from "@/dung-chung/UI-chung/ui";
import FaqAccordion from "./thanh-phan/FaqAccordion";
import ContactSupportCard from "./thanh-phan/ContactSupportCard";

/** Điều phối nội dung trợ giúp; các khối nội dung tĩnh nằm trong thanh-phan. */
export default function Support() {
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="TRỢ GIÚP"
        title="Bạn muốn bắt đầu từ đâu?"
        description="Hướng dẫn những thao tác thường dùng trong CapitalFlow."
      />
      <ContactSupportCard />
      <FaqAccordion />
    </div>
  );
}
