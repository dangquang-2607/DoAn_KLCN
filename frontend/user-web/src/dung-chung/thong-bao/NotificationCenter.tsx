/** Trung tâm thông báo chung: tải phân trang và xác nhận riêng từng mục. */
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import { notificationText } from "@/dung-chung/thong-bao/notificationText";
import { type Notification, type NotificationPage } from "@/dung-chung/nghiep-vu/finance";
import styles from "./NotificationCenter.module.css";

const PAGE_SIZE = 30;

export default function NotificationCenter({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [readingId, setReadingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cache = useQueryClient();
  const query = useInfiniteQuery<NotificationPage>({
    queryKey: ["notifications", userId],
    queryFn: async ({ pageParam }) => (await api.get<NotificationPage>(
      `/notifications?page=${pageParam}&page_size=${PAGE_SIZE}`,
    )).data,
    initialPageParam: 1,
    getNextPageParam: (last) => last.page * last.page_size < last.total ? last.page + 1 : undefined,
    refetchInterval: 60000,
  });

  const notices = query.data?.pages.flatMap((page) => page.items) || [];
  const unreadCount = query.data?.pages[0]?.unread_count || 0;
  const firstThreeIds = notices.slice(0, 3).map((notice) => notice.id).join(",");

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const list = listRef.current;
    const firstThree = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-notification-item]")).slice(0, 3);
    if (firstThree.length === 0) return;

    const measure = () => {
      const height = Math.ceil(firstThree.reduce((total, item) => total + item.getBoundingClientRect().height, 0));
      list.style.setProperty("--three-items-height", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    firstThree.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [open, firstThreeIds]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const markRead = async (notice: Notification) => {
    if (notice.read_at || readingId === notice.id) return;
    setError("");
    setReadingId(notice.id);
    try {
      const updated = (await api.post<Notification>(`/notifications/${notice.id}/read`)).data;
      cache.setQueryData<InfiniteData<NotificationPage>>(["notifications", userId], (current) => current && ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          unread_count: Math.max(0, page.unread_count - 1),
          items: page.items.map((item) => item.id === notice.id ? updated : item),
        })),
      }));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setReadingId(null);
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
        aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && <section className={styles.panel} role="dialog" aria-label="Trung tâm thông báo">
        <header className={styles.header}>
          <div><strong>Thông báo</strong><small>{unreadCount ? `${unreadCount} thông báo chưa đọc` : "Bạn đã đọc tất cả thông báo"}</small></div>
        </header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.list} ref={listRef}>
          {query.isPending ? <p className={styles.empty}>Đang tải thông báo…</p>
            : query.isError ? <button type="button" className={styles.retry} onClick={() => query.refetch()}>Không tải được thông báo. Thử lại</button>
              : notices.length === 0 ? <p className={styles.empty}>Bạn chưa có thông báo nào.</p>
                : <>
                  {notices.map((notice) => <button type="button" key={notice.id} data-notification-item
                    disabled={readingId === notice.id}
                    className={`${styles.item} ${notice.read_at ? styles.read : styles.unread}`}
                    onClick={() => void markRead(notice)}>
                    <span className={styles.dot} aria-hidden="true" />
                    <span className={styles.body}>
                      <span className={styles.title}>{notice.title}</span>
                      <span className={styles.message}>{notificationText(notice.message)}</span>
                      <span className={styles.meta}><time dateTime={notice.created_at}>{new Date(`${notice.created_at}Z`).toLocaleString("en-GB", {
                        dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
                      })}</time></span>
                    </span>
                  </button>)}
                  {query.hasNextPage && <button type="button" className={styles.more} disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Đang tải…" : "Xem thêm thông báo"}</button>}
                </>}
        </div>
      </section>}
    </div>
  );
}
