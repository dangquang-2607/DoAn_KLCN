"use client";

import { useLayoutEffect, useRef, useState, type InputHTMLAttributes, type Ref } from "react";
import { formatMoneyInput, moneyCaretPosition, parseMoneyInput } from "../tien-ich/moneyInput";
import styles from "./CSS/MoneyInput.module.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step"> & {
  value: string;
  onValueChange: (value: string) => void;
  currency?: string;
  fractionDigits?: 0 | 2;
  min?: number;
  max?: number;
  /** Existing wallet/invoice layouts provide their own currency suffix. */
  bare?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/** Display grouping never enters form state or API payloads. */
export default function MoneyInput({ value, onValueChange, currency = "VND", fractionDigits = 2,
  min = 0, max, bare = false, ref, className = "cf-input", onKeyDown, onPaste, onBlur, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const display = formatMoneyInput(value, isTyping);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const valid = !value || (/^\d+(?:\.\d*)?$/.test(value) && Number(value) >= min && (max === undefined || Number(value) <= max));
    input.setCustomValidity(valid ? "" : "Số tiền ngoài giới hạn cho phép.");
    if (caret.current !== null && document.activeElement === input) {
      input.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });

  const input = <input {...props} type="text" inputMode={fractionDigits ? "decimal" : "numeric"}
    placeholder={props.placeholder ?? "0"} className={`${className}${bare ? "" : ` ${styles.input}`}`}
    ref={(element) => {
      inputRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    }} value={display}
    onPaste={(event) => {
      onPaste?.(event);
      if (event.defaultPrevented || props.readOnly || props.disabled) return;
      // A pasted API decimal such as 5000.00 must never become 500000.
      const pasted = parseMoneyInput(event.clipboardData.getData("text"), fractionDigits);
      if (pasted === null) { event.preventDefault(); return; }
      event.preventDefault();
      const input = event.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? start;
      const insertion = formatMoneyInput(pasted, true);
      const text = input.value.slice(0, start) + insertion + input.value.slice(end);
      const next = parseMoneyInput(text, fractionDigits, true);
      if (next === null) return;
      const significant = (input.value.slice(0, start) + insertion).replace(/[^\d,]/g, "").length;
      caret.current = moneyCaretPosition(formatMoneyInput(next, true), significant);
      setIsTyping(true);
      onValueChange(next);
    }}
    onKeyDown={(event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const input = event.currentTarget;
      const start = input.selectionStart ?? 0;
      if (start !== input.selectionEnd) return;
      // Delete the adjacent digit as well when crossing an automatic separator.
      if (event.key === "Backspace" && input.value[start - 1] === ".") input.setSelectionRange(start - 2, start);
      if (event.key === "Delete" && input.value[start] === ".") input.setSelectionRange(start, start + 2);
    }}
    onChange={(event) => {
      const raw = event.target.value;
      const next = parseMoneyInput(raw, fractionDigits, true);
      if (next === null) return;
      const significant = raw.slice(0, event.target.selectionStart ?? raw.length).replace(/[^\d,]/g, "").length;
      caret.current = moneyCaretPosition(formatMoneyInput(next, true), significant);
      setIsTyping(true);
      onValueChange(next);
    }}
    onBlur={(event) => {
      setIsTyping(false);
      onBlur?.(event);
    }} />;

  return bare ? input : <span className={styles.wrapper}>{input}<span className={styles.currency} aria-hidden="true">{currency === "VND" ? "đ" : currency}</span></span>;
}
