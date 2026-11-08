/** Canonical API decimal → Vietnamese editing text, without floating-point rounding. */
export function formatMoneyInput(value: string | number, preserveZeroFraction = false): string {
  const text = String(value);
  if (!text) return "";
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return text;
  const integer = match[1].replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = match[2];
  // Hide database padding such as .00, without rounding meaningful decimals.
  const hideFraction = fraction === undefined || (!preserveZeroFraction && /^0+$/.test(fraction));
  return grouped + (hideFraction ? "" : `,${fraction}`);
}

/** Dots group thousands; commas mark decimals. Reject ambiguous/invalid pasted text. */
export function parseMoneyInput(text: string, fractionDigits = 2, editing = false): string | null {
  const clean = text.trim().replace(/\s*(?:₫|đ|VND)$/i, "").trim();
  if (!clean) return "";
  if (!/^\d[\d.]*(?:,\d*)?$/.test(clean)) return null;
  const [grouped, fraction] = clean.split(",");
  if (!editing && grouped.includes(".") && !/^\d{1,3}(?:\.\d{3})+$/.test(grouped)) return null;
  if (fraction !== undefined && (fractionDigits === 0 || fraction.length > fractionDigits)) return null;
  const integer = grouped.replaceAll(".", "").replace(/^0+(?=\d)/, "");
  // Match the API's Decimal(19, 2) range without truncating large pasted values.
  if (integer.length > 17) return null;
  return integer + (fraction === undefined ? "" : `.${fraction}`);
}

/** Place the caret after the same number of digits/decimal marks after regrouping. */
export function moneyCaretPosition(formatted: string, significantCount: number): number {
  if (significantCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d,]/.test(formatted[i]) && ++count === significantCount) return i + 1;
  }
  return formatted.length;
}
