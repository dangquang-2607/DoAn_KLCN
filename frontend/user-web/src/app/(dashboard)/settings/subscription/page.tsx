import { redirect } from "next/navigation";
import SubscriptionPage from "@/chuc-nang/cai-dat-bao-mat/subscription";
import { checkoutPath, validPaymentId } from "@/chuc-nang/cai-dat-bao-mat/xu-ly/subscription";

export default async function SubscriptionRoute({ searchParams }: {
  searchParams: Promise<{ payment_order?: string | string[] }>;
}) {
  const id = validPaymentId((await searchParams).payment_order);
  if (id) redirect(checkoutPath(id));
  return <SubscriptionPage />;
}
