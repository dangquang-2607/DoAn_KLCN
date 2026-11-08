type Limits = { wallets: number; budgets: number; ai: number };
export type Subscription = {
  plan: "FREE" | "PREMIUM"; premium_until: string | null; limits: Limits;
  plans: { FREE: Limits; PREMIUM: Limits };
  usage: Limits & { ai_pending: number }; usage_month: string;
  price: number; days: number; payment_available: boolean;
};
type PaymentCheckout = {
  qr_code: string; qr_image: string; bank_bin: string; bank_name: string;
  account_number: string; account_name: string; description: string; amount: number;
};
export type PaymentOrder = {
  id: string; order_code: string; amount: number; days: number; status: string;
  checkout_url: string | null; created_at: string; expires_at: string;
  premium_until: string | null; server_time?: string; checkout?: PaymentCheckout | null;
};

export function validPaymentId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
export const checkoutPath = (id: string) => `/settings/subscription/checkout?payment_order=${encodeURIComponent(id)}`;
export const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
