import { CircleCheck, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { money } from "@/dung-chung/tien-ich/finance";
import { billTotal, type BillInfo } from "../xu-ly/billQr";
import styles from "../CSS/BillReceipt.module.css";

/** Shared receipt for QR creation, checkout confirmation and completed payment. */
export default function BillReceipt({
  bill,
  displayedAt,
  status = "pending",
  children,
}: {
  bill: BillInfo;
  displayedAt: string;
  status?: "awaiting-scan" | "pending" | "paid";
  children?: ReactNode;
}) {
  const paid = status === "paid";
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(displayedAt));

  return (
    <article
      className={styles.paper}
      aria-label={
        paid ? "Hóa đơn đã thanh toán" : status === "awaiting-scan" ? "Phiếu hóa đơn thanh toán thực tế" : "Thông tin hóa đơn thanh toán"
      }
    >
      <header className={styles.header}>
        <h3>{bill.merchant_name}</h3>
        <p className={styles.title}>Hóa đơn bán hàng</p>
        <p className={styles.subtitle}>Hệ thống CapitalFlow POS Pay</p>
      </header>

      <dl className={styles.meta}>
        <div>
          <dt>Mã hóa đơn:</dt>
          <dd className={styles.reference}>{bill.bill_reference}</dd>
        </div>
        <div>
          <dt>Thời gian:</dt>
          <dd>
            <time dateTime={displayedAt}>{time}</time>
          </dd>
        </div>
        <div>
          <dt>Nội dung:</dt>
          <dd>
            {bill.note.trim() ||
              `Thanh toán ${bill.merchant_name} - ${bill.items.map((item) => item.name).join(", ")}`}
          </dd>
        </div>
        <div>
          <dt>Phương thức:</dt>
          <dd>Quét mã QR Ví điện tử</dd>
        </div>
      </dl>

      <table className={styles.items} aria-label="Chi tiết mặt hàng hóa đơn">
        <colgroup>
          <col className={styles.nameColumn} />
          <col className={styles.quantityColumn} />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Mặt hàng</th>
            <th scope="col">SL</th>
            <th scope="col">Đơn giá</th>
            <th scope="col">T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{money(item.unit_price)}</td>
              <td>{money(billTotal([item]) ?? "0")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className={styles.totals}>
        <div>
          <dt>Tạm tính:</dt>
          <dd>{money(bill.amount)}</dd>
        </div>
        <div>
          <dt>Thuế GTGT (VAT):</dt>
          <dd>Đã bao gồm</dd>
        </div>
        <div className={styles.grandTotal}>
          <dt>Tổng thanh toán:</dt>
          <dd>{money(bill.amount)}</dd>
        </div>
      </dl>

      <div className={styles.status} role="status">
        <span
          className={`${styles.statusLabel} ${paid ? styles.paid : styles.pending}`}
        >
          {paid ? (
            <CircleCheck size={15} aria-hidden="true" />
          ) : (
            <Clock3 size={15} aria-hidden="true" />
          )}
          {paid ? "Thanh toán thành công" : status === "awaiting-scan" ? "Chờ quét mã thanh toán" : "Chờ thanh toán"}
        </span>
      </div>
      {children && <div className={styles.extra}>{children}</div>}
    </article>
  );
}
