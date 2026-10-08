"use client";

/** Chi tiết chỉ đọc của ví; giữ thao tác giao dịch và quản lý liên kết demo. */
import { useSyncExternalStore } from "react";
import { Modal } from "@/dung-chung/UI-chung/ui";
import { accountTypes, type Account } from "@/dung-chung/nghiep-vu/finance";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import styles from "./AccountCard.module.css";

function subscribeClock(update: () => void) {
  const timer = setInterval(update, 60000);
  return () => clearInterval(timer);
}
const clockSnapshot = () => Math.floor(Date.now() / 60000) * 60000;
const serverClock = () => 0;

const bankStatusLabels: Record<string, string> = {
  NOT_CONNECTED: "Chưa kết nối", CONNECTED: "Đã liên kết · Demo",
  DISCONNECTED: "Đã ngắt liên kết", EXPIRED: "Cần cấp quyền lại",
  LOGIN: "Chờ đăng nhập", OTP: "Chờ OTP", SELECT: "Chờ chọn tài khoản",
};

export default function AccountDetailsModal({ account, onClose, onBank }: {
  account: Account;
  onClose: () => void;
  onBank: (account: Account) => void;
}) {
  const currentTime = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const isSavings = account.account_type === "SAVINGS" && Number(account.target_amount) > 0;
  const isLinked = ["LINKED", "BANK", "E_WALLET"].includes(account.account_type);
  const target = Number(account.target_amount || 0);
  const saved = Number(account.balance);
  const remaining = Math.max(0, target - saved);
  const progress = isSavings ? Math.min(100, Math.max(0, (saved / target) * 100)) : 0;
  const deadline = account.target_date ? dateLabel(account.target_date) : "Chưa đặt hạn";
  const daysUntilTarget = account.target_date && currentTime
    ? Math.ceil((new Date(`${account.target_date}T23:59:59+07:00`).getTime() - currentTime) / 86400000)
    : null;
  const goalStatus = saved >= target ? "Đã đạt mục tiêu"
    : daysUntilTarget === null ? "Đang theo dõi mục tiêu"
      : daysUntilTarget >= 0 ? `Còn ${daysUntilTarget} ngày` : `Quá hạn ${Math.abs(daysUntilTarget)} ngày`;

  return <Modal title={`Chi tiết ví · ${account.name}`} onClose={onClose}>
    <div className={styles.details}>
      <section className={styles.detailHero} aria-label="Số dư ví">
        <span className="cf-badge">{accountTypes[account.account_type] || account.account_type}</span>
        <span className={styles.label}>{isSavings ? "Đã tiết kiệm" : "Số dư hiện tại"}</span>
        <strong className={styles.detailBalance}>{money(account.balance, account.currency)}</strong>
      </section>

      <div className={styles.infoGrid}>
        <div><span className={styles.label}>Tên tài khoản</span><strong>{account.name}</strong></div>
        <div><span className={styles.label}>Tiền tệ</span><strong>{account.currency}</strong></div>
        {isLinked && account.institution_name && <div><span className={styles.label}>Ngân hàng / Ví điện tử</span><strong>{account.institution_name}</strong></div>}
        {account.account_number_masked && <div><span className={styles.label}>Số tài khoản / Thẻ</span><strong>{account.account_number_masked}</strong></div>}
        <div><span className={styles.label}>Tính vào tổng tài sản</span><strong>{account.exclude_from_total ? "Không" : "Có"}</strong></div>
        <div><span className={styles.label}>Thông báo biến động</span><strong>{account.is_notification_enabled === false ? "Đã tắt" : "Đang bật"}</strong></div>
      </div>

      {isSavings && <section className={styles.savings} aria-label={`Tiến độ tiết kiệm của ${account.name}`}>
        <div className={styles.goal}>
          <span className={styles.label}>Mục tiêu</span>
          <strong className={styles.goalValue}>{money(target, account.currency)}</strong>
        </div>
        <div className={styles.deadline}>
          <span className={styles.label}>Ngày kết thúc</span>
          <div className={styles.deadlineValue}>
            {account.target_date ? <time dateTime={account.target_date}>{deadline}</time> : <span>{deadline}</span>}
            <span className={saved >= target ? styles.achieved : styles.days}>{goalStatus}</span>
          </div>
        </div>
        <div className={styles.progressHeader}>
          <strong>Tiến triển</strong><span>{Math.round(progress)}%</span>
        </div>
        <div className={styles.amounts}>
          <div><span className={styles.label}>Đã tiết kiệm</span><strong className={styles.saved}>{money(saved, account.currency)}</strong></div>
          <div><span className={styles.label}>Cần thêm</span><strong className={styles.needed}>{money(remaining, account.currency)}</strong></div>
        </div>
        <progress className={styles.progress} aria-label={`Đã tiết kiệm ${Math.round(progress)}% mục tiêu`} max={100} value={progress} />
      </section>}

      {isLinked && <section className={styles.bankDetails} aria-label="Chi tiết liên kết ngân hàng">
        <h3>Liên kết ngân hàng mô phỏng</h3>
        <div className={styles.infoGrid}>
          <div><span className={styles.label}>Trạng thái</span><strong>{bankStatusLabels[account.bank_status || "NOT_CONNECTED"] || account.bank_status}</strong></div>
          <div><span className={styles.label}>Đồng bộ gần nhất</span><strong>{account.bank_last_sync ? new Date(account.bank_last_sync + "Z").toLocaleString("en-GB") : "Chưa đồng bộ"}</strong></div>
        </div>
        <button type="button" className="cf-btn" onClick={() => { onClose(); onBank(account); }}>
          {account.bank_managed ? "Quản lý kết nối demo" : "Kết nối ngân hàng demo"}
        </button>
      </section>}

      <div className={styles.detailActions}>
        <button type="button" className="cf-btn" onClick={onClose}>Đóng</button>
      </div>
    </div>
  </Modal>;
}
