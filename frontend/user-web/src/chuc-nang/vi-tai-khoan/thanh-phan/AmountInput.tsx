"use client";

import { useRef, type ChangeEvent } from "react";
import { X, AlertCircle } from "lucide-react";
import { money } from "@/dung-chung/tien-ich/finance";
import styles from "./TopupWithdrawModal.module.css";

export const DEFAULT_AMOUNT_CHIPS = [
  { label: "50.000đ", value: "50000" },
  { label: "100.000đ", value: "100000" },
  { label: "200.000đ", value: "200000" },
  { label: "500.000đ", value: "500000" },
];

export interface AmountInputProps {
  label?: string;
  ariaLabel?: string;
  amount: string;
  onAmountChange: (val: string) => void;
  maxBalance?: number;
  showAllBalanceChip?: boolean;
  chips?: Array<{ label: string; value: string }>;
  disabled?: boolean;
  required?: boolean;
  errorText?: string;
  placeholder?: string;
}

export function formatDisplayAmount(val: string): string {
  if (!val) return "";
  const cleanNum = val.replace(/\D/g, "");
  if (!cleanNum) return "";
  return new Intl.NumberFormat("vi-VN").format(Number(cleanNum));
}

export default function AmountInput({
  label = "Số tiền",
  ariaLabel = "Số tiền",
  amount,
  onAmountChange,
  maxBalance,
  showAllBalanceChip = false,
  chips = DEFAULT_AMOUNT_CHIPS,
  disabled = false,
  required = true,
  errorText = "Số dư ví không đủ hoặc vượt giới hạn",
  placeholder = "0",
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    onAmountChange(raw);
  };

  const enteredNum = Number(amount || 0);
  const isInsufficient = maxBalance !== undefined && enteredNum > maxBalance;

  return (
    <div className={styles.amountContainer}>
      {label && (
        <div className={styles.sectionHeader}>
          <label className={styles.inputLabel}>{label}</label>
          {maxBalance !== undefined && (
            <span className={styles.sectionSubtitle}>
              Khả dụng: <strong>{money(maxBalance)}</strong>
            </span>
          )}
        </div>
      )}

      <div className={styles.amountInputWrapper}>
        <input
          ref={inputRef}
          className={styles.amountInput}
          aria-label={ariaLabel}
          inputMode="numeric"
          placeholder={placeholder}
          value={formatDisplayAmount(amount)}
          onChange={handleInputChange}
          disabled={disabled}
          required={required}
        />
        <span className={styles.currencySuffix}>đ</span>
        {amount && !disabled && (
          <button
            type="button"
            className={styles.clearAmountBtn}
            aria-label="Xóa số tiền"
            onClick={() => {
              onAmountChange("");
              inputRef.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isInsufficient && (
        <div className={styles.amountError}>
          <AlertCircle size={14} />
          <span>{errorText}</span>
        </div>
      )}

      {/* Dãy chip chọn nhanh */}
      {!disabled && chips.length > 0 && (
        <div className={styles.chipsRow}>
          {chips.map((chip) => {
            const isChipActive = amount === chip.value;
            return (
              <button
                type="button"
                key={chip.value}
                className={`${styles.chip} ${
                  isChipActive ? styles.chipActive : ""
                }`}
                onClick={() => onAmountChange(chip.value)}
              >
                {chip.label}
              </button>
            );
          })}
          {showAllBalanceChip && maxBalance !== undefined && maxBalance > 0 && (
            <button
              type="button"
              className={`${styles.chip} ${styles.chipSpecial} ${
                amount === String(Math.floor(maxBalance))
                  ? styles.chipActive
                  : ""
              }`}
              onClick={() => onAmountChange(String(Math.floor(maxBalance)))}
            >
              Tất cả số dư
            </button>
          )}
        </div>
      )}
    </div>
  );
}
