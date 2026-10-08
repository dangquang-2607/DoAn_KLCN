/** Hợp đồng lỗi danh mục để tạo mới và khôi phục dùng chung giữa Danh mục và OCR. */
import { isAxiosError } from "axios";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import { type Category } from "@/dung-chung/nghiep-vu/finance";

export type ArchivedCategory = Pick<Category, "id" | "name" | "type">;

type CategoryConflict = {
  detail?: { code?: string; message?: string; category?: ArchivedCategory };
};

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
