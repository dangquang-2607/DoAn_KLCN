/**
 * ============================================================================
 * TÊN FILE: categories.ts
 * MÀN HÌNH / PHÂN HỆ: Quản lý Danh mục & OCR
 * NHÓM VỆ TINH: dung-chung (Nghiệp vụ dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Xử lý phân giải lỗi xung đột khi tạo mới danh mục bị trùng tên (HTTP 409 Conflict),
 *   trích xuất thông tin danh mục đã lưu trữ để hỗ trợ khôi phục tức thì.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Axios error, kiểu Category từ finance module.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Kiểu ArchivedCategory, hàm archivedCategoryFromError, categoryConflictMessage.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Phân biệt danh mục hệ thống mặc định và danh mục cá nhân đã ẩn.
 * ============================================================================
 */
/** Hợp đồng lỗi danh mục để tạo mới và khôi phục dùng chung giữa Danh mục và OCR. */
import { isAxiosError } from "axios";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import { type Category } from "@/dung-chung/nghiep-vu/finance";

export type ArchivedCategory = Pick<Category, "id" | "name" | "type">;

type CategoryConflict = {
  detail?: { code?: string; message?: string; category?: ArchivedCategory };
};

/**
 * Trích xuất đối tượng danh mục đã lưu trữ từ phản hồi lỗi 409 Conflict.
 * 
 * @param error - Đối tượng lỗi trả về từ API.
 * @returns ArchivedCategory nếu phát hiện xung đột danh mục cũ, ngược lại null.
 */
export function archivedCategoryFromError(error: unknown): ArchivedCategory | null {
  if (!isAxiosError<CategoryConflict>(error) || error.response?.status !== 409) return null;
  const detail = error.response.data?.detail;
  const category = detail?.category;
  return detail?.code === "CATEGORY_ARCHIVED" && category && typeof category.id === "string"
    && typeof category.name === "string" && ["INCOME", "EXPENSE"].includes(category.type)
    ? category : null;
}

export function categoryErrorMessage(error: unknown) {
  if (isAxiosError<CategoryConflict>(error)) {
    const message = error.response?.data?.detail?.message;
    if (typeof message === "string") return message;
  }
  return errorMessage(error);
}
