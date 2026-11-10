import api from "@/dung-chung/connect-api/api";

export type BillItem = { name: string; quantity: number; unit_price: string };
export type BillInfo = {
  merchant_name: string;
  bill_reference: string;
  amount: string;
  currency: "VND";
  items: BillItem[];
  note: string;
  demo: true;
  qr_version: 2;
  qr_payload: string;
};
export type BillQR = BillInfo & { qr_image_data_url: string };
export type PaidBill = { status: "SUCCEEDED"; paid_amount: string; paid_at: string };

export async function resolveBillQR(qr_payload: string, signal?: AbortSignal): Promise<BillInfo> {
  return (await api.post<BillInfo>("/wallets/bills/resolve", { qr_payload }, { timeout: 15000, signal })).data;
}

export async function billPaymentStatus(qr_payload: string, signal?: AbortSignal) {
  return (await api.post<PaidBill | { status: "UNCONFIRMED" }>(
    "/wallets/bills/payment-status", { qr_payload }, { timeout: 8000, signal },
  )).data;
}

/** Sum decimal prices in cents so the preview matches the API's Decimal arithmetic. */
export function billTotal(items: BillItem[]): string | null {
  let cents = BigInt(0);
  for (const item of items) {
    if (!/^\d{1,17}(?:\.\d{1,2})?$/.test(item.unit_price) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) return null;
    const [whole, fraction = ""] = item.unit_price.split(".");
    cents += (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))) * BigInt(item.quantity);
  }
  return `${cents / BigInt(100)}.${(cents % BigInt(100)).toString().padStart(2, "0")}`;
}
