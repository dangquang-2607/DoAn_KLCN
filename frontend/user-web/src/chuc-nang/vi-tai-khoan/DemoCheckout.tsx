"use client";
import { useRouter } from "next/navigation";
import MockInvoiceModal from "./thanh-phan/MockInvoiceModal";

export default function DemoCheckout() {
  const router = useRouter();
  return (
    <MockInvoiceModal
      onClose={() => router.push("/accounts")}
    />
  );
}
