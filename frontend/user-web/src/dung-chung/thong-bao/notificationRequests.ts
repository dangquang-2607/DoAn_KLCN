import api from "@/dung-chung/connect-api/api";
import type { NotificationPage } from "@/dung-chung/nghiep-vu/finance";

export async function notificationPage(page: number, pageSize: number, unreadOnly: boolean, signal?: AbortSignal) {
  return (await api.get<NotificationPage>("/notifications", {
    params: { page, page_size: pageSize, unread_only: unreadOnly || undefined }, signal,
  })).data;
}
