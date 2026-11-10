"use client";
import density from "@/dung-chung/CSS/workspace-density.module.css";
import styles from "./CSS/support.module.css";
import { PageHead } from "@/dung-chung/UI-chung/ui";
import FaqAccordion from "./thanh-phan/FaqAccordion";
import ContactSupportCard from "./thanh-phan/ContactSupportCard";
import SupportRequestForm from "./thanh-phan/SupportRequestForm";

/** Điều phối form hỗ trợ và nội dung tự trợ giúp. */
export default function Support() {
  return (
    <div className={`cf-stack ${density.workspace}`}>
      <PageHead
        eyebrow="TRỢ GIÚP"
        title="Trung tâm hỗ trợ"
        description="Gửi yêu cầu cho đội hỗ trợ CapitalFlow. Phản hồi sẽ được gửi đến email tài khoản của bạn."
      />
      <div className={`${density.content} ${styles.content}`}>
        <div className={styles.supportGrid}>
          <SupportRequestForm />
          <ContactSupportCard />
        </div>
        <FaqAccordion />
      </div>
    </div>
  );
}
