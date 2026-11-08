"use client";

import { Suspense } from "react";
import density from "@/dung-chung/CSS/workspace-density.module.css";
import { Loading } from "@/dung-chung/UI-chung/ui";
import SubscriptionSettings from "./thanh-phan/SubscriptionSettings";

export default function SubscriptionPage() {
  return <div className={`cf-stack cf-user-settings ${density.workspace}`}>
    <div className={density.content}>
      <Suspense fallback={<Loading />}><SubscriptionSettings asPage /></Suspense>
    </div>
  </div>;
}
