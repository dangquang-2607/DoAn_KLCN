"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, ArrowUpRight, ReceiptText } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Empty, ErrorState, Loading, Modal, Pagination } from "@/dung-chung/UI-chung/ui";
import { billReferenceLabel, money } from "@/dung-chung/tien-ich/finance";
import type { Wallet } from "./WalletWorkspace";
import styles from "./CSS/WalletHistory.module.css";

type HistoryEntry = {
  id: string; kind: string; amount: string; balance_after: string; created_at: string;
  merchant_name: string | null; bill_reference: string | null; note: string | null;
};
type HistoryPage = { items: HistoryEntry[]; total: number };
const kinds = {
  TOPUP: { label: "Nạp từ ngân hàng", icon: ArrowDownToLine },
  WITHDRAW: { label: "Rút về ngân hàng", icon: ArrowUpFromLine },
  TRANSFER_IN: { label: "Nhận chuyển tiền", icon: ArrowDownLeft },
  TRANSFER_OUT: { label: "Chuyển tiền", icon: ArrowUpRight },
  PAYMENT: { label: "Thanh toán hóa đơn", icon: ReceiptText },
};
const utc = (value: string) => /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
const dayFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" });

/** Money movements remain accessible after a wallet is closed. */
export default function WalletHistoryDialog({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const history = useQuery<HistoryPage>({
    queryKey: ["wallet-history", wallet.id, page],
    queryFn: async ({ signal }) => (await api.get(`/wallets/${wallet.id}/history`, {
      params: { page, page_size: 10 }, signal,
    })).data,
  });
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of history.data?.items || []) {
    const date = new Date(utc(entry.created_at));
    const day = Number.isNaN(date.getTime()) ? "Không rõ ngày" : dayFormat.format(date);
    const entries = groups.get(day) || [];
    entries.push(entry); groups.set(day, entries);
  }
  return <Modal className={styles.dialog} title={`Lịch sử ${wallet.name}`} onClose={onClose}>
    <div className={styles.fields}>
      <div className={styles.summary}>
        <div className={styles.walletState}><span className={`cf-badge${wallet.is_active ? " success" : ""}`}>{wallet.is_active ? "Ví đang dùng" : "Ví đã đóng"}</span>
          {history.data && <span>{history.data.total.toLocaleString("vi-VN")} giao dịch</span>}</div>
        <div className={styles.balance}><span>Số dư hiện tại</span><strong>{money(wallet.balance, wallet.currency)}</strong></div>
      </div>
      {history.isPending ? <Loading /> : history.isError ? <ErrorState retry={() => history.refetch()} />
        : !history.data?.total ? <Empty title="Chưa có giao dịch trong ví" />
          : <>
            <div className={styles.groups}>
              {Array.from(groups, ([day, entries]) => <section className={styles.day} key={day} aria-label={`Giao dịch ngày ${day}`}>
                <h3 className={styles.dayTitle}>{day}</h3>
                <ol className={styles.entries}>
                  {entries.map(entry => {
                    const kind = kinds[entry.kind as keyof typeof kinds] || { label: "Giao dịch ví", icon: ArrowRightLeft };
                    const Icon = kind.icon;
                    const direction = Number(entry.amount) > 0 ? styles.incoming : Number(entry.amount) < 0 ? styles.outgoing : styles.neutral;
                    const date = new Date(utc(entry.created_at));
                    return <li className={styles.entry} key={entry.id}>
                      <span className={`${styles.icon} ${direction}`}><Icon size={18} aria-hidden="true" /></span>
                      <div className={styles.entryContent}>
                        <div className={styles.entryHeading}>
                          <div className={styles.identity}><h4>{kind.label}</h4><time dateTime={utc(entry.created_at)}>{Number.isNaN(date.getTime()) ? "—" : timeFormat.format(date)}</time></div>
                          <div className={styles.amount}><strong className={direction}>{Number(entry.amount) > 0 ? "+" : ""}{money(entry.amount, wallet.currency)}</strong><span>Số dư: {money(entry.balance_after, wallet.currency)}</span></div>
                        </div>
                        {(entry.merchant_name || entry.bill_reference) && <p className={styles.merchant}>{entry.merchant_name}
                          {entry.bill_reference && <span title={entry.bill_reference}>{billReferenceLabel(entry.bill_reference)}</span>}</p>}
                        {entry.note && <p className={styles.note}>{entry.note}</p>}
                      </div>
                    </li>;
                  })}
                </ol>
              </section>)}
            </div>
            <Pagination page={page} total={history.data.total} pageSize={10} onChange={setPage} />
          </>}
    </div>
    <div className={styles.actions}><button type="button" className="cf-btn" onClick={onClose}>Đóng lịch sử</button></div>
  </Modal>;
}
