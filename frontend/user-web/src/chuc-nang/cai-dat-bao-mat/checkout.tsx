"use client";

import { Suspense } from "react";
import { Loading } from "@/dung-chung/UI-chung/ui";
import PremiumCheckout from "./thanh-phan/PremiumCheckout";

export default function CheckoutPage() {
  return <Suspense fallback={<Loading />}><PremiumCheckout /></Suspense>;
}
