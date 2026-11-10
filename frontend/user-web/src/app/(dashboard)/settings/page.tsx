import { redirect } from "next/navigation";
import Settings from "@/chuc-nang/cai-dat-bao-mat/page";
import { checkoutPath, validPaymentId } from "@/chuc-nang/cai-dat-bao-mat/xu-ly/subscription";

// Các đơn payOS đã tạo trước khi tách menu vẫn quay lại đường dẫn cũ.
export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ payment_order?: string | string[] }>;
}) {
  const { payment_order: order } = await searchParams;
  const id = validPaymentId(order);
  if (id) redirect(checkoutPath(id));
  return <Settings />;
}
