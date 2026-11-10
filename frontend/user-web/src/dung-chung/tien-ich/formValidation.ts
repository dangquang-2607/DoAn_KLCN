import type { FormEvent } from "react";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function control(event: FormEvent<HTMLFormElement>): Control | null {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target : null;
}

export function localizeInvalidField(event: FormEvent<HTMLFormElement>) {
  const input = control(event);
  if (!input || input.validity.customError) return;
  const state = input.validity;
  const message = state.valueMissing ? (input instanceof HTMLSelectElement ? "Vui lòng chọn thông tin này." : "Vui lòng nhập thông tin này.")
    : state.typeMismatch ? "Vui lòng nhập đúng định dạng."
    : state.tooShort ? "Thông tin chưa đủ độ dài yêu cầu."
    : state.tooLong ? "Thông tin vượt độ dài cho phép."
    : state.rangeUnderflow || state.rangeOverflow ? "Giá trị nằm ngoài giới hạn cho phép."
    : "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.";
  input.dataset.localizedValidation = "1";
  input.setCustomValidity(message);
}

export function clearLocalizedValidation(event: FormEvent<HTMLFormElement>) {
  const input = control(event);
  if (input?.dataset.localizedValidation) {
    input.setCustomValidity("");
    delete input.dataset.localizedValidation;
  }
}

// Chỉ bỏ ký tự phân cách; giữ số 0 ở đầu và từ chối chữ qua kiểm tra nghiệp vụ.
export function normalizeDemoAccountNumber(value: string): string {
  return value.replace(/[\s\u200b-\u200d\ufeff]/g, "");
}
