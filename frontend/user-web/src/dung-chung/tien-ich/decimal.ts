/** Compare decimal form values without rounding through JavaScript Number. */
export function canonicalDecimal(value: string | number): string {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return text;
  const integer = match[2].replace(/^0+(?=\d)/, "");
  const fraction = (match[3] || "").replace(/0+$/, "");
  const sign = integer === "0" && !fraction ? "" : match[1];
  return sign + integer + (fraction ? `.${fraction}` : "");
}
