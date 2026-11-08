/** Same codepoint/whitespace policy as the API; preserve the password verbatim. */
export function newPasswordError(value) {
  const characters = Array.from(value);
  if (characters.filter((character) => !/\p{White_Space}/u.test(character) && !(character >= "\u001c" && character <= "\u001f")).length < 6) {
    return "Mật khẩu phải có ít nhất 6 ký tự không phải khoảng trắng.";
  }
  if (characters.length > 128) return "Mật khẩu không được vượt quá 128 ký tự.";
  return "";
}
