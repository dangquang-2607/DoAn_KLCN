"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/dung-chung/connect-api/api";
import { Alert, ErrorState, Loading, Modal } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import type { Category, Transaction } from "@/dung-chung/nghiep-vu/finance";
import type { TransactionForm } from "./TransactionModal";
import styles from "../CSS/Transactions.module.css";

type Detail = { operation_id: string; wallet_name: string; merchant_name: string | null; bill_reference: string | null; amount: string; created_at: string; note: string; kind: string; type: string; counterparty: string | null; is_internal: boolean; label: string };

export default function WalletTransactionDetails({ transaction, categories, form, setForm, error, busy, dependencyError, onSubmit, onClose, onClearError }: {
  transaction: Transaction; categories: Category[]; form: TransactionForm;
  setForm: Dispatch<SetStateAction<TransactionForm>>; error: string; busy: boolean; dependencyError: boolean;
  onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void;
}) {
  const categoryId = useId();
  const reportsId = useId();
  const detail = useQuery<Detail>({
    queryKey: ["payment-detail", transaction.id],
    queryFn: async ({ signal }) => (await api.get(`/bookkeeping/${transaction.id}/payment-detail`, { signal })).data,
  });
  const data = detail.data;
  return <Modal className={styles.dialog} title="Xem chi tiết giao dịch" onClose={onClose} busy={busy}>
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.fields}>
        {error && <Alert persistent onDismiss={onClearError}>{error}</Alert>}
        {detail.isPending ? <Loading /> : detail.isError ? <ErrorState retry={() => detail.refetch()} /> : data && <>
          <div className={styles.summary}>
            <span className="cf-badge success">Thành công</span>
            <strong>{data.type === "INCOME" ? "+" : "−"}{money(data.amount)}</strong>
            <span>{data.label} · {data.wallet_name}</span>
          </div>
          <dl className={styles.facts}>
            {data.kind === "PAYMENT" ? <>
              <div><dt>Người nhận / nhà cung cấp</dt><dd>{data.merchant_name || "—"}</dd></div>
              <div><dt>Mã hóa đơn</dt><dd>{data.bill_reference || "—"}</dd></div>
            </> : <div><dt>{["TOPUP", "WITHDRAW"].includes(data.kind) ? "Ngân hàng" : data.is_internal ? "Ví đối ứng" : data.type === "INCOME" ? "Người gửi" : "Người nhận"}</dt><dd>{data.counterparty || "—"}</dd></div>}
            <div><dt>Thời gian</dt><dd>{new Date(`${data.created_at}Z`).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</dd></div>
            <div><dt>Mã giao dịch</dt><dd>{data.operation_id}</dd></div>
            <div><dt>Nội dung</dt><dd>{data.note || "Không có nội dung"}</dd></div>
            <div>
              <dt><label htmlFor={categoryId}>Danh mục</label></dt>
              <dd><select id={categoryId} className="cf-input" value={form.category_id} disabled={busy || dependencyError}
                onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}>
                <option value="">Chưa phân loại</option>
                {categories.filter((category) => category.type === transaction.type && (category.is_active || category.id === transaction.category_id))
                  .map((category) => <option key={category.id} value={category.id} disabled={!category.is_active}>{category.name}{!category.is_active ? " (đã ẩn)" : ""}</option>)}
              </select></dd>
            </div>
            <div>
              <dt><label htmlFor={reportsId}>Tính vào thu chi</label></dt>
              <dd className={styles.toggle}><input id={reportsId} className="cf-switch-input" type="checkbox" role="switch" disabled={busy}
                checked={form.include_in_reports !== false}
                onChange={(event) => setForm((current) => ({ ...current, include_in_reports: event.target.checked }))} /></dd>
            </div>
          </dl>
        </>}
        {dependencyError && <Alert persistent>Không tải được danh mục. Vui lòng đóng và thử lại.</Alert>}
      </div>
      <div className={styles.actions}>
        <button type="button" className="cf-btn" onClick={onClose} disabled={busy}>Đóng</button>
        <button className="cf-btn cf-btn-primary" disabled={busy || dependencyError || !data || detail.isError}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button>
      </div>
    </form>
  </Modal>;
}
