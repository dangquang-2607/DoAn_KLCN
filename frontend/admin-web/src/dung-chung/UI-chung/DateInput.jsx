import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { dateInputError, formatDateForDisplay, formatDateForTyping, parseDateForApi } from "../tien-ich/format";

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
  const [rejected, setRejected] = useState("");
  const errorId = useId();

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
    setRejected("");
    setDisplay(formatDateForDisplay(value));
  }, [value]);

  const isoDate = parseDateForApi(display);
  const invalid = rejected || (display && !isoDate
    ? "Nhập ngày hợp lệ theo định dạng dd/mm/yyyy."
    : isoDate && min && isoDate < min
    ? `Ngày phải từ ${formatDateForDisplay(min)} trở đi.`
    : isoDate && max && isoDate > max
    ? `Ngày phải trước hoặc bằng ${formatDateForDisplay(max)}.`
    : "");
  const showInvalid = Boolean(invalid && (rejected || blurred || display.length === 10));

  useEffect(() => {
    textRef.current?.setCustomValidity(invalid || "");
  }, [invalid]);

  const emit = (next) => {
    lastEmitted.current = next;
    onChange(next);
  };

  const updateDisplay = (raw, caret) => {
    if (disabled || readOnly) return;
    const next = formatDateForTyping(raw);
    const error = dateInputError(next);
    if (error) {
      setRejected(error);
      // A rejected edit must not replace the last accepted date or API value.
      if (textRef.current) {
        textRef.current.value = display;
        textRef.current.setSelectionRange(Math.min(caret, display.length), Math.min(caret, display.length));
      }
      return;
    }
    const digitCount = raw.slice(0, caret).replace(/\D/g, "").length;
    pendingCaret.current = caretAfterDigits(next, digitCount);
    setRejected("");
    setBlurred(false);
    setDisplay(next);
    const parsed = parseDateForApi(next);
    const accepted = parsed && (!min || parsed >= min) && (!max || parsed <= max) ? parsed : "";
    if (accepted && accepted !== value) emit(accepted);
    else if (!accepted && value) emit("");
  };

  return (
    <div className={`cf-date-input ${className || ""}`}>
      <input
        ref={textRef}
        id={id}
        aria-label={ariaLabel}
        aria-describedby={[describedBy, showInvalid ? errorId : null].filter(Boolean).join(" ") || undefined}
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
        onBlur={() => { setBlurred(true); setRejected(""); }}
        onKeyDown={(event) => {
          if (
            event.key.length === 1 &&
            !/[\d/]/.test(event.key) &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
          }
        }}
        onChange={(event) => {
          const raw = event.target.value;
          updateDisplay(raw, event.target.selectionStart ?? raw.length);
        }}
        onPaste={(event) => {
          event.preventDefault();
          const input = event.currentTarget;
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? display.length;
          const pasted = event.clipboardData.getData("text");
          updateDisplay(display.slice(0, start) + pasted + display.slice(end), start + pasted.length);
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
          if (event.target.validity.valid) updateDisplay(event.target.value, event.target.value.length);
        }}
      />
      {showInvalid && <span id={errorId} className="cf-date-input-error" role="alert">{invalid}</span>}
    </div>
  );
}
