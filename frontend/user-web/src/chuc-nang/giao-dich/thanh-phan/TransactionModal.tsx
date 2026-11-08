import PaymentRecordReview from "@/dung-chung/nghiep-vu/PaymentRecordReview";
import { localizeInvalidField, clearLocalizedValidation } from "@/dung-chung/tien-ich/formValidation";
import MoneyInput from "@/dung-chung/UI-chung/MoneyInput";
import { useId, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Alert, Field, Modal } from "@/dung-chung/UI-chung/ui";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Account, type Category, type Transaction } from "@/dung-chung/nghiep-vu/finance";
import WalletTransactionDetails from "./WalletTransactionDetails";
import styles from "../CSS/Transactions.module.css";

export type TransactionForm = { account_id: string; category_id: string; type: string; amount: string; transaction_date: string; description: string; note: string; to_account_id: string; include_in_reports?: boolean; wallet_entry_id?: string; accept_separate_record?: boolean; auto_categorize?: boolean };
export type CategorySuggestion = { category_id: string | null; category_name: string | null; confidence: number; source: string; auto_apply: boolean; reason: string };

/** Form tạo/sửa giao dịch thu chi, gồm gợi ý danh mục từ backend. */
export default function TransactionModal({ independent = false, editing, accounts, categories, form, setForm, suggestion, setSuggestion, setCategoryTouched, error, busy, dependencyError, onSubmit, onClose, onClearError }: { independent?: boolean; editing: Transaction | null; accounts: Account[]; categories: Category[]; form: TransactionForm; setForm: Dispatch<SetStateAction<TransactionForm>>; suggestion: CategorySuggestion | null; setSuggestion: (value: CategorySuggestion | null) => void; setCategoryTouched: (value: boolean) => void; error: string; busy: boolean; dependencyError: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void }) {
  const categoryId = useId();
  const bankManaged = !independent && !!editing?.bank_reference;
  const account = accounts.find((item) => item.id === form.account_id);
  if (independent && editing?.wallet_entry_id) {
    return <WalletTransactionDetails transaction={editing} categories={categories} form={form} setForm={setForm}
      error={error} busy={busy} dependencyError={dependencyError} onSubmit={onSubmit} onClose={onClose} onClearError={onClearError} />;
  }
  return (
    <Modal
      className={styles.dialog}
      title={editing ? "Xem chi tiết giao dịch" : "Thêm giao dịch"}
      onClose={onClose}
      busy={busy}
    >
      <form className={styles.form} onSubmit={onSubmit} onInvalidCapture={localizeInvalidField} onInputCapture={clearLocalizedValidation} onChangeCapture={clearLocalizedValidation}>
        <div className={styles.fields}>
          {error && <Alert persistent onDismiss={onClearError}>{error}</Alert>}
          {dependencyError ? (
            <Alert persistent> Không thể tải tài khoản hoặc danh mục. Đóng biểu mẫu và thử lại. </Alert>
          ) : !independent && !accounts.length ? (
            <Alert kind="info"> Bạn cần tạo tài khoản ở mục Ví & tài khoản trước khi ghi nhận giao dịch. </Alert>
          ) : null}
          {bankManaged && (
            <Alert kind="info"> Giao dịch ngân hàng: chỉ sửa danh mục và ghi chú. </Alert>
          )}
          <Field label="Loại giao dịch">
            <select
              disabled={ bankManaged || !!editing?.wallet_entry_id || !!form.wallet_entry_id }
              className="cf-input"
              value={form.type}
              onChange={(event) => {
                setForm({ ...form, type: event.target.value, wallet_entry_id: undefined, accept_separate_record: false, category_id: "", auto_categorize: true, });
                setCategoryTouched(false);
              }}
            >
              <option value="EXPENSE">Chi tiêu</option>
              <option value="INCOME">Thu nhập</option>
            </select>
          </Field>
          {independent && !editing && form.type === "EXPENSE" && (error.includes("Có khoản thanh toán") || !!form.wallet_entry_id || !!form.accept_separate_record) && <PaymentRecordReview
            amount={form.amount} paidOn={form.transaction_date} selected={form.wallet_entry_id || ""} separate={!!form.accept_separate_record} busy={busy}
            onSelect={wallet_entry_id => setForm(current => ({ ...current, wallet_entry_id }))}
            onSeparate={accept_separate_record => setForm(current => ({ ...current, accept_separate_record }))} />}
          {!independent && (
            <Field label="Tài khoản">
              <select
                disabled={bankManaged}
                required
                className="cf-input"
                value={form.account_id}
                onChange={(event) => setForm({ ...form, account_id: event.target.value }) }
              >
                <option value="">Chọn tài khoản</option>
                {accounts
                  .filter( (item) => !item.bank_read_only || item.id === editing?.account_id, )
                  .map((item) => ( <option value={item.id} key={item.id}> {item.name} · {money(item.balance, item.currency)} </option> ))}
              </select>
            </Field>
          )}
          <div className="cf-field">
            <label htmlFor={categoryId}>Danh mục</label>
            <select
              id={categoryId}
              aria-describedby={suggestion ? `${categoryId}-suggestion` : undefined}
              className="cf-input"
              value={form.category_id || (!editing && form.auto_categorize !== false ? "__AUTO__" : "")}
              onChange={(event) => {
                setForm({ ...form, category_id: event.target.value === "__AUTO__" ? "" : event.target.value, auto_categorize: event.target.value === "__AUTO__" });
                setCategoryTouched(event.target.value !== "__AUTO__");
                setSuggestion(null);
              }}
            >
              {!editing && <option value="__AUTO__">Tự động phân loại</option>}
              <option value="">Chưa phân loại</option>
              {categories
                .filter(
                  (item) =>
                    item.type === form.type &&
                    (item.is_active || item.id === editing?.category_id),
                )
                .map((item) => (
                  <option
                    value={item.id}
                    key={item.id}
                    disabled={!item.is_active}
                  >
                    {item.name}
                    {!item.is_active ? " (đã ẩn)" : ""}
                  </option>
                ))}
            </select>
            {suggestion && (
              <div id={`${categoryId}-suggestion`} className="cf-category-suggestion" role="status">
                <div>
                  <strong>Gợi ý: {suggestion.category_name}</strong>
                  <span> {Math.round(suggestion.confidence * 100)}% ·{" "} {suggestion.reason} </span>
                </div>
                <button
                  type="button" className="cf-btn cf-btn-sm"
                  onClick={() => { setForm({ ...form, category_id: suggestion.category_id || "", }); setCategoryTouched(true); setSuggestion(null); }} > Chọn danh mục
                </button>
              </div>
            )}
          </div>
          <div className="cf-form-grid">
            <Field label="Số tiền">
              <MoneyInput
                className={`cf-input ${styles.moneyInput}`}
                readOnly={bankManaged}
                required
                min={0.01}
                currency={account?.currency || "VND"}
                value={form.amount}
                onValueChange={(amount) => setForm({ ...form, amount, wallet_entry_id: undefined, accept_separate_record: false })}
              />
            </Field>
            <Field label="Ngày giao dịch">
              <DateInput
                readOnly={bankManaged}
                required
                value={form.transaction_date}
                onChange={(value) => setForm({ ...form, transaction_date: value, wallet_entry_id: undefined, accept_separate_record: false }) }
              />
            </Field>
          </div>
          <Field label="Mô tả">
            <input
              readOnly={bankManaged}
              className="cf-input"
              required
              maxLength={255}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value }) }
            />
          </Field>
          <Field label="Ghi chú (tùy chọn)">
            <textarea
              className="cf-input"
              rows={2}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </Field>
        </div>
        <div className={styles.actions}>
          <button type="button" disabled={busy} className="cf-btn" onClick={onClose} > Hủy </button>
          <button
            className="cf-btn cf-btn-primary"
            disabled={ busy || (!independent && !accounts.length) || dependencyError } >
            {busy ? "Đang xử lý…" : "Lưu giao dịch"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
