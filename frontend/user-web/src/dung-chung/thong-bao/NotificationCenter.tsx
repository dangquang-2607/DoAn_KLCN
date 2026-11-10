/** Trung tâm thông báo chung với bộ lọc và các thao tác quản lý. */
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/dung-chung/connect-api/api";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import { notificationText } from "@/dung-chung/thong-bao/notificationText";
import { type Notification, type NotificationPage } from "@/dung-chung/nghiep-vu/finance";
import styles from "./CSS/NotificationCenter.module.css";
import { notificationPage } from "./notificationRequests";

const PAGE_SIZE = 30;

/**
 * Trung tâm quản lý và hiển thị thông báo thời gian thực của người dùng.
 */
export default function NotificationCenter({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const updating = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cache = useQueryClient();
  const noticeKey = ["notifications", userId] as const;
  const query = useInfiniteQuery({
    queryKey: [...noticeKey, unreadOnly],
    queryFn: ({ pageParam, signal }) => notificationPage(pageParam, PAGE_SIZE, unreadOnly, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => last.page * last.page_size < last.total ? last.page + 1 : undefined,
    refetchInterval: 60000,
  });

  const notices = query.data?.pages.flatMap((page) => page.items) || [];
  const firstPage = query.data?.pages[0];
  const previousFilter = cache.getQueryData<InfiniteData<NotificationPage>>([...noticeKey, !unreadOnly]);
  const unreadCount = firstPage?.unread_count ?? previousFilter?.pages[0]?.unread_count ?? 0;
  const hasRead = !unreadOnly && !!firstPage && firstPage.total > firstPage.unread_count;
  const firstThreeIds = notices.slice(0, 3).map((notice) => notice.id).join(",");
  const closePanel = useCallback(() => {
    setOpen(false);
    setConfirmClear(false);
  }, []);

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const list = listRef.current;
    const firstThree = Array.from(list.querySelectorAll<HTMLElement>("[data-notification-item]")).slice(0, 3);
    if (firstThree.length === 0) {
      list.style.removeProperty("--three-items-height");
      return;
    }

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
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closePanel();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, closePanel]);

  const chooseFilter = (next: boolean) => {
    if (next === unreadOnly || updating.current) return;
    if (listRef.current) listRef.current.scrollTop = 0;
    setError("");
    setConfirmClear(false);
    setUnreadOnly(next);
  };

  const openDestination = (notice: Notification) => {
    const destination = notice.action_url;
    // Only navigate to application paths, never externally supplied origins.
    if (!destination || !destination.startsWith("/") || /^\/[\\/]|[\u0000-\u0020\\]/.test(destination)) return;
    closePanel();
    router.push(destination);
  };

  const changeNotifications = async (write: () => Promise<unknown>) => {
    if (updating.current) return;
    updating.current = true;
    setError("");
    setBusy(true);
    try {
      await write();
      // Refresh from the server after writes because page offsets and the unread count can change.
      cache.removeQueries({ queryKey: [...noticeKey, !unreadOnly], exact: true });
      await cache.invalidateQueries({ queryKey: noticeKey });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      updating.current = false;
      setBusy(false);
    }
  };

  const openNotice = (notice: Notification) => {
    if (notice.read_at) {
      openDestination(notice);
      return;
    }
    void changeNotifications(async () => {
      const updated = (await api.post<Notification>(`/notifications/${notice.id}/read`)).data;
      openDestination(updated);
    });
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button ref={triggerRef} type="button" className={styles.trigger} aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
        aria-expanded={open} aria-haspopup="dialog" onClick={() => open ? closePanel() : setOpen(true)}>
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && <section className={styles.panel} role="dialog" aria-label="Trung tâm thông báo">
        <header className={styles.header}>
          <div><strong>Thông báo</strong><small>{unreadCount ? `${unreadCount} thông báo chưa đọc` : "Bạn đã đọc tất cả thông báo"}</small></div>
        </header>
        <div className={styles.toolbar}>
          <div className={styles.filters} role="group" aria-label="Lọc thông báo">
            <button type="button" className="cf-btn cf-btn-sm" aria-pressed={!unreadOnly}
              disabled={busy} onClick={() => chooseFilter(false)}>Tất cả</button>
            <button type="button" className="cf-btn cf-btn-sm" aria-pressed={unreadOnly}
              disabled={busy} onClick={() => chooseFilter(true)}>Chưa đọc</button>
          </div>
          <div className={styles.actions}>
            <button type="button" className={`cf-icon-btn ${styles.actionButton}`} disabled={busy || !unreadCount}
              aria-label="Đánh dấu tất cả đã đọc" title="Đọc tất cả"
              onClick={() => void changeNotifications(() => api.post("/notifications/read-all"))}>
              <CheckCheck size={18} aria-hidden="true" />
            </button>
            <button type="button" className={`cf-icon-btn ${styles.actionButton}`} disabled={busy || !hasRead || confirmClear}
              aria-label="Xóa thông báo đã đọc" title="Xóa đã đọc"
              onClick={() => setConfirmClear(true)}>
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
        {confirmClear && <div className={styles.confirm} role="group" aria-label="Xác nhận xóa thông báo đã đọc">
          <p>Xóa tất cả thông báo đã đọc?</p>
          <div className={styles.actions}>
            <button type="button" className="cf-btn cf-btn-sm" disabled={busy}
              onClick={() => setConfirmClear(false)}>Hủy</button>
            <button type="button" className="cf-btn cf-btn-sm cf-btn-danger" disabled={busy}
              onClick={() => void changeNotifications(async () => {
                await api.delete("/notifications", { params: { only_read: true } });
                setConfirmClear(false);
              })}>Xác nhận xóa</button>
          </div>
        </div>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.list} ref={listRef} aria-busy={busy || query.isFetching}>
          {query.isPending ? <p className={styles.empty}>Đang tải thông báo…</p>
            : query.isError && !query.data ? <button type="button" className={styles.retry} onClick={() => query.refetch()}>Không tải được thông báo. Thử lại</button>
              : notices.length === 0 ? <p className={styles.empty}>{unreadOnly ? "Không có thông báo chưa đọc." : "Bạn chưa có thông báo nào."}</p>
                : <>
                  {notices.map((notice) => <div key={notice.id} data-notification-item
                    className={`${styles.row} ${notice.read_at ? styles.read : styles.unread}`}>
                    <button type="button" className={styles.item} disabled={busy} onClick={() => openNotice(notice)}>
                      <span className={styles.dot} aria-hidden="true" />
                      <span className={styles.body}>
                        <span className={styles.title}>{notificationText(notice.title)}</span>
                        <span className={styles.message}>{notificationText(notice.message)}</span>
                        <span className={styles.meta}><time dateTime={notice.created_at}>{new Date(`${notice.created_at}Z`).toLocaleString("en-GB", {
                          dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
                        })}</time></span>
                      </span>
                    </button>
                  </div>)}
                  {query.hasNextPage && <button type="button" className={styles.more} disabled={busy || query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Đang tải…" : query.isFetchNextPageError ? "Thử tải thêm thông báo" : "Xem thêm thông báo"}</button>}
                </>}
        </div>
      </section>}
    </div>
  );
}
