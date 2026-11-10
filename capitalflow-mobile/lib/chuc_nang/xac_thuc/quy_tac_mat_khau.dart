/// Matches the API's Unicode non-whitespace and maximum code-point lengths.
final _passwordWhitespace =
    RegExp(r'[\p{White_Space}\u001c-\u001f]', unicode: true);

const passwordHelper = 'Ít nhất 6 ký tự không trắng, tối đa 128 ký tự.';

String? newPasswordError(String value) {
  if (value.replaceAll(_passwordWhitespace, '').runes.length < 6) {
    return 'Mật khẩu phải có ít nhất 6 ký tự không phải khoảng trắng.';
  }
  if (value.runes.length > 128) {
    return 'Mật khẩu không được vượt quá 128 ký tự.';
  }
  return null;
}
