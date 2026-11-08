import density from "../CSS/budget-density.module.css";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/dung-chung/UI-chung/CategoryIcon";
import { Panel } from "@/dung-chung/UI-chung/ui";
import { dateLabel, money, percent } from "@/dung-chung/tien-ich/finance";
import { type Budget, type Category } from "@/dung-chung/nghiep-vu/finance";

/** Thẻ tiến độ ngân sách và cảnh báo theo ngưỡng backend đã tính. */
export default function BudgetCard({ budget, category, onEdit, onDelete, onReuse, history = false, embedded = false }: { budget: Budget; category?: Category; onEdit?: () => void; onDelete?: () => void; onReuse?: () => void; history?: boolean; embedded?: boolean }) {
  const status = budget.progress_status;
  const exceeded = Number(budget.remaining_amount) < 0;
  const allowanceHint = budget.period_state === "UPCOMING" ? "Hiển thị khi kỳ ngân sách bắt đầu."
    : budget.period_state === "PAUSED" ? "Ngân sách đang tạm dừng."
    : budget.period_state === "COMPLETED" ? "Kỳ ngân sách đã kết thúc."
    : exceeded ? "Đã vượt hạn mức; ngân sách không còn dư để chi."
    : "Số tiền còn lại chia cho số ngày còn lại, gồm hôm nay.";
  const content = (
    <div
      className={`${embedded ? "cf-stack" : "cf-panel-body cf-stack"} ${density.card}`}
    >
      <div className={density.cardMeta}>
        {!embedded && <h2>{budget.budget_name}</h2>}
        <span
          className={`cf-badge ${budget.period_state === "PAUSED" ? "warning" : status === "EXCEEDED" ? "danger" : status === "WARNING" ? "warning" : "success"}`}
        >
          {budget.period_state === "UPCOMING"
            ? "Sắp bắt đầu"
            : budget.period_state === "PAUSED" && !history
              ? "Tạm dừng"
              : status === "EXCEEDED"
                ? "Vượt hạn mức"
                : status === "WARNING"
                  ? "Đạt ngưỡng cảnh báo"
                  : "Trong hạn mức"}
        </span>
        {category && !embedded && <CategoryIcon icon={category.icon} color={category.color} size={24} />}
        <p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>
          {category?.name || "Tất cả danh mục"} · {dateLabel(budget.start_date)}{" "}
          – {dateLabel(budget.end_date)}
        </p>
      </div>
      <div className="cf-row cf-between">
        <strong className="cf-number" style={{ fontSize: 24 }}> {money(budget.spent_amount, budget.currency)} </strong>
        <span className="cf-muted" style={{ fontSize: 14 }}> / {money(budget.amount_limit, budget.currency)} </span>
      </div>
      <div className="cf-progress">
        <span
          style={{
            width: `${Math.max(0, Math.min(100, Number(budget.usage_percent)))}%`,
            background: status === "EXCEEDED" ? "var(--cf-danger)" : status === "WARNING" ? "#b48215" : undefined,
          }}
        />
      </div>
      <div className="cf-row cf-between" style={{ fontSize: 13 }}>
        <span className="cf-muted"> Đã dùng {percent(budget.usage_percent, 0)}% </span>
        <span className={exceeded ? density.exceeded : undefined}>
          {exceeded ? "Vượt hạn mức " : "Còn lại "}
          {money(Math.abs(Number(budget.remaining_amount)), budget.currency)}
        </span>
      </div>
      {budget.period_days != null && <>
        <dl className={density.metricsGrid}>
          <div><dt>Đã qua</dt><dd>{budget.elapsed_days} / {budget.period_days} ngày</dd></div>
          <div><dt>Còn lại (gồm hôm nay)</dt><dd>{budget.remaining_days} ngày</dd></div>
          <div>
            <dt>Có thể chi/ngày</dt>
            <dd>{budget.daily_allowance == null ? "—" : money(budget.daily_allowance, budget.currency)}</dd>
          </div>
          <div>
            <dt>Chi trung bình/ngày</dt>
            <dd>{budget.average_daily_spent == null ? "—" : money(budget.average_daily_spent, budget.currency)}</dd>
          </div>
        </dl>
        <details className={density.metricHelp}>
          <summary>Cách tính</summary>
          <p>{allowanceHint}</p>
          <p>{budget.active_elapsed_days > 0
                ? `Tổng đã chi chia cho ${budget.active_elapsed_days} ngày${budget.active_elapsed_days !== budget.elapsed_days ? " hoạt động, bỏ qua ngày tạm dừng" : ", gồm cả ngày không phát sinh chi"}.`
                : "Chưa có ngày hoạt động để tính trung bình."}</p>
          <p>Số ngày đã qua tính đến hôm nay.</p>
        </details>
      </>}
      {!history && budget.next_effective_date && (
        <p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>
          Từ {dateLabel(budget.next_effective_date)}: hạn mức{" "}
          {money(budget.configured_amount_limit, budget.currency)}
          {" · Cảnh báo tại "}{percent(budget.configured_warning_percent, 2)}%
        </p>
      )}
      {!history && budget.next_state_date && (
        <p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>
          {budget.configured_is_active ? "Tiếp tục" : "Tạm dừng"} từ{" "}
          {dateLabel(budget.next_state_date)}
        </p>
      )}
      {!history && budget.recurrence_end_date && <p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>
        Kết thúc sau ngày {dateLabel(budget.recurrence_end_date)}
      </p>}
      <div className={density.cardFooter}>
        <span className="cf-muted" style={{ fontSize: 13 }}>
          {history
            ? "Kỳ đã kết thúc"
            : budget.is_recurring
              ? "Tự chuyển kỳ"
              : "Một lần"}{" "}
          · Cảnh báo tại {percent(budget.warning_percent, 2)}%
        </span>
        <div className="cf-row">
          {onReuse && ( <button className="cf-btn cf-btn-sm" onClick={onReuse}> <Copy /> Dùng lại </button> )}
          {!history && onEdit && <button type="button" className="cf-btn cf-btn-sm" onClick={onEdit}><Pencil size={16} aria-hidden="true" />Chỉnh sửa</button>}
          {!history && onDelete && <button type="button" className="cf-btn cf-btn-danger cf-btn-sm" onClick={onDelete}><Trash2 size={16} aria-hidden="true" />Xóa ngân sách</button>}
        </div>
      </div>
    </div>
  );
  return embedded ? content : <Panel>{content}</Panel>;
}
