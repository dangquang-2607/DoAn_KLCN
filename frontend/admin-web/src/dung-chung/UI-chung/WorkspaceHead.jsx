/**
 * ============================================================================
 * TÊN FILE: WorkspaceHead.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Thành phần giao diện dùng chung (UI Primitives)
 * NHÓM VỆ TINH: dung-chung (Tiêu đề không gian làm việc)
 * MỤC ĐÍCH CỤ THỂ:
 *   Phần đầu trang chuẩn hóa cho mọi màn hình quản trị: tiêu đề lớn, nhãn phụ (eyebrow),
 *   mô tả chức năng và khu vực chứa các nút hành động chính (actions).
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props title, eyebrow, description, actions.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export WorkspaceHead component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Sử dụng thẻ h1 chuẩn ngữ nghĩa semantic HTML phục vụ SEO và khả năng tiếp cận.
 * ============================================================================
 */
/**
 * Khung tiêu đề tiêu chuẩn đầu trang cho các phân hệ quản trị.
 */
export default function WorkspaceHead({ eyebrow, title, description, actions }) {
  return <header className="adm-intro cf-workspace-head"><div><p className="cf-eyebrow">{eyebrow}</p><h1>{title}<span className="cf-heading-dot" aria-hidden="true">.</span></h1>{description && <p className="cf-heading-description">{description}</p>}</div>{actions && <div className="cf-row cf-heading-actions adm-live-actions">{actions}</div>}</header>;
}
