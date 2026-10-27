/**
 * ============================================================================
 * TÊN FILE: DateInput.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MỤC ĐÍCH CỤ THỂ:
 *   Ô nhập ngày luôn hiển thị định dạng dd/mm/yyyy trên toàn hệ thống.
 *   Tự động chèn dấu /, tích hợp mở lịch chọn ngày, trả về YYYY-MM-DD cho API.
 * ============================================================================
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatDateForDisplay, formatDateForTyping, parseDateForApi } from "../tien-ich/format";

function caretAfterDigits(value, count) {
  if (!count) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index++) {
    if (/\d/.test(value[index]) && ++seen === count) return index + 1;
  }
  return value.length;
}

export default function DateInput({
  value,
  onChange,
  id,
  required,
  readOnly,
  disabled,
  min,
  max,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}) {
  const [display, setDisplay] = useState(() => formatDateForDisplay(value));
  const textRef = useRef(null);
  const pickerRef = useRef(null);
  const lastEmitted = useRef(null);
  const pendingCaret = useRef(null);
  const [blurred, setBlurred] = useState(false);

  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      textRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [display]);

  useEffect(() => {
    if (lastEmitted.current === value) {
      lastEmitted.current = null;
      return;
    }
    pendingCaret.current = null;
    setDisplay(formatDateForDisplay(value));
  }, [value]);

  const isoDate = parseDateForApi(display);
  const invalid = display && !isoDate
    ? "Nhập ngày hợp lệ theo định dạng dd/mm/yyyy."
    : isoDate && min && isoDate < min
    ? `Ngày phải từ ${formatDateForDisplay(min)} trở đi.`
    : isoDate && max && isoDate > max
    ? `Ngày phải trước hoặc bằng ${formatDateForDisplay(max)}.`
    : "";
  const showInvalid = Boolean(invalid && (blurred || display.length === 10));

  useEffect(() => {
    textRef.current?.setCustomValidity(invalid || "");
  }, [invalid]);

  const emit = (next) => {
    lastEmitted.current = next;
    onChange(next);
  };

  return (
    <div className={`cf-date-input ${className || ""}`}>
      <input
        ref={textRef}
        id={id}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={showInvalid}
        data-invalid={showInvalid ? "true" : undefined}
        className="cf-input cf-date-input-field"
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        title={invalid || "Nhập ngày/tháng/năm (dd/mm/yyyy)"}
        maxLength={10}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        value={display}
        onBlur={() => setBlurred(true)}
        onKeyDown={(event) => {
          if (
            event.key.length === 1 &&
            !/\d/.test(event.key) &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
          }
        }}
        onChange={(event) => {
          const raw = event.target.value;
          const next = formatDateForTyping(raw);
          const digitCount = raw
            .slice(0, event.target.selectionStart ?? raw.length)
            .replace(/\D/g, "").length;
          pendingCaret.current = caretAfterDigits(next, digitCount);
          setBlurred(false);
          setDisplay(next);
          const parsed = parseDateForApi(next);
          const accepted =
            parsed && (!min || parsed >= min) && (!max || parsed <= max)
              ? parsed
              : "";
          if (accepted && accepted !== value) emit(accepted);
          else if (!accepted && value) emit("");
        }}
      />
      <button
        type="button"
        className="cf-date-input-calendar"
        aria-label="Chọn ngày từ lịch"
        disabled={disabled || readOnly}
        onClick={() => pickerRef.current?.showPicker?.()}
      >
        <CalendarDays size={17} aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        className="cf-date-input-native-picker"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        max={max}
        disabled={disabled || readOnly}
        value={isoDate || ""}
        onChange={(event) => {
          pendingCaret.current = null;
          setDisplay(formatDateForDisplay(event.target.value));
          setBlurred(false);
          emit(event.target.value);
        }}
      />
    </div>
  );
}
