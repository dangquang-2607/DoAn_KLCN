/** Matches the API policy while preserving the password exactly as entered. */
export function passwordCharacterCount(value: string): number {
  return Array.from(value).filter((character) => !/[\p{White_Space}\u001c-\u001f]/u.test(character)).length;
}

export function newPasswordError(value: string): string {
  if (passwordCharacterCount(value) < 6) return "Mật khẩu phải có ít nhất 6 ký tự không phải khoảng trắng.";
  if (Array.from(value).length > 128) return "Mật khẩu không được vượt quá 128 ký tự.";
  return "";
}
