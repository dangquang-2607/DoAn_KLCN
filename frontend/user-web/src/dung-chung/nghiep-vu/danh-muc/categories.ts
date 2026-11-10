/** Hợp đồng lỗi danh mục để tạo mới và khôi phục dùng chung giữa Danh mục và OCR. */
import { useQuery } from "@tanstack/react-query";
import api from "@/dung-chung/connect-api/api";
import { isAxiosError } from "axios";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import { type Category } from "@/dung-chung/nghiep-vu/finance";

export function useCategories(status?: "all" | "archived") {
  return useQuery({
    queryKey: status ? ["categories", status] : ["categories"],
    queryFn: async () => (await api.get<Category[]>("/categories", {
      params: status ? { status } : undefined,
    })).data,
  });
}

export type CategoryQuota = {
  plan: "FREE" | "PREMIUM";
  used: number;
  limit: number;
  remaining: number;
  can_create: boolean;
};

export function useCategoryQuota() {
  return useQuery({
    queryKey: ["category-limits"],
    queryFn: async () => (await api.get<CategoryQuota>("/categories/limits")).data,
  });
}

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
