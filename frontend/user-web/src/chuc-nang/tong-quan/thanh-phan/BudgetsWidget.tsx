/** Widget ba ngân sách đang hoạt động; phần trăm được chặn trong 0–100 để bảo vệ layout. */
import CardAction from "./CardAction";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState, Loading } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Budget } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/overview.module.css";

function prioritizedBudgets(budgets: Budget[] = []) {
  const rank = (budget: Budget) =>
    budget.progress_status === "EXCEEDED"
      ? 2
      : budget.progress_status === "WARNING"
        ? 1
        : 0;
  return budgets
    .filter((budget) => budget.period_state === "CURRENT")
    .sort(
      (a, b) =>
        rank(b) - rank(a) || Number(b.usage_percent) - Number(a.usage_percent),
    );
}

export default function BudgetsWidget({
  query,
}: {
  query: UseQueryResult<Budget[]>;
}) {
  const currentBudgets = prioritizedBudgets(query.data);
  const budgets = currentBudgets.slice(0, 3);
  return (
    <section
      className={`${styles.panel} ${styles.overviewCard} ${styles.budgetPanel}`}
    >
      <header className={styles.overviewCardHead}>
        <div>
          <h2>Ngân sách của bạn</h2>
          <p>
            Đã dùng / Hạn mức
            {currentBudgets.length > 3
              ? ` · Hiển thị 3/${currentBudgets.length}`
              : ""}
          </p>
        </div>
        <CardAction href="/budgets">Xem tất cả</CardAction>
      </header>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !budgets.length ? (
        <div className={styles.overviewEmpty}>
          Chưa có ngân sách đang áp dụng.{" "}
          <CardAction href="/budgets">Thiết lập ngân sách</CardAction>
        </div>
      ) : (
        <div className={styles.budgetGrid}>
          {budgets.map((budget) => {
            const rawPercent = Number(budget.usage_percent);
            const percent = Number.isFinite(rawPercent)
              ? Math.max(0, rawPercent)
              : 0;
            const shownPercent = Math.round(percent);
            const level =
              budget.progress_status === "EXCEEDED"
                ? "exceeded"
                : budget.progress_status === "WARNING"
                  ? "warning"
                  : "safe";
            return (
              <div className={styles.budgetItem} key={budget.budget_id}>
                <div className={styles.budgetTop}>
                  <strong>{budget.budget_name}</strong>
                  <span
                    className={
                      level === "exceeded"
                        ? styles.budgetExceeded
                        : level === "warning"
                          ? styles.budgetWarning
                          : ""
                    }
                  >
                    {level === "exceeded"
                      ? "Vượt hạn mức · "
                      : level === "warning"
                        ? "Cảnh báo · "
                        : ""}
                    {shownPercent}%
                  </span>
                </div>
                <div className={styles.budgetValues}>
                  <span className={styles.srOnly}>Đã dùng </span>
                  <b>{money(budget.spent_amount, budget.currency)}</b>
                  <span aria-hidden="true">/</span>
                  <span className={styles.srOnly}> trên hạn mức </span>
                  <span>{money(budget.amount_limit, budget.currency)}</span>
                </div>
                <div
                  className={styles.budgetTrack}
                  role="progressbar"
                  aria-label={budget.budget_name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, percent)}
                  aria-valuetext={`${shownPercent}% đã dùng, ${money(budget.spent_amount, budget.currency)} trên ${money(budget.amount_limit, budget.currency)}`}
                >
                  <span
                    className={
                      level === "exceeded"
                        ? styles.budgetBarExceeded
                        : level === "warning"
                          ? styles.budgetBarWarning
                          : ""
                    }
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
