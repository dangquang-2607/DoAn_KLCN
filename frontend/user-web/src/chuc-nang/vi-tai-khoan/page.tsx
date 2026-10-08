/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Ví & tài khoản
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Xóa ví vĩnh viễn cùng giao dịch và hóa đơn liên quan sau khi xác nhận.
 * ============================================================================
 */
"use client";

/**
 * Điều phối nghiệp vụ ví: tải dữ liệu, gọi API tạo/sửa/xóa và làm mới
 * các màn có số dư liên quan. Phần trình bày được tách vào `thanh-phan`.
 */
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, Empty, ErrorState, Loading, PageHead, Panel } from "@/dung-chung/UI-chung/ui";
import { errorMessage, formatDateForDisplay, parseDateForApi } from "@/dung-chung/tien-ich/finance";
import { type Account } from "@/dung-chung/nghiep-vu/finance";
import BankConnection from "./thanh-phan/BankConnection";
import AccountCard from "./thanh-phan/AccountCard";
import AccountDetailsModal from "./thanh-phan/AccountDetailsModal";
import AccountDeleteModal, { type AccountDeletionPreview } from "./thanh-phan/AccountDeleteModal";
import AccountModal, { type AccountForm } from "./thanh-phan/AccountModal";

const emptyForm: AccountForm = {
  name: "",
  account_type: "BASIC",
  institution_name: "",
  balance: "0",
  currency: "VND",
  account_number_masked: "", target_amount: "", target_date: "",
  exclude_from_total: false, is_notification_enabled: true,
};

const formType = (kind: string) => ["BASIC", "LINKED", "SAVINGS"].includes(kind)
  ? kind : ["BANK", "E_WALLET"].includes(kind) ? "LINKED" : "BASIC";

export default function Accounts() {
  const cache = useQueryClient();
  const query = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const [editing, setEditing] = useState<Account | null>(null);
  const [bank, setBank] = useState<Account | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const deletionPreview = useQuery<AccountDeletionPreview>({
    queryKey: ["account-deletion-preview", deleting?.id],
    queryFn: async () => (await api.get(`/accounts/${deleting?.id}/deletion-preview`)).data,
    enabled: Boolean(deleting),
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const detailAccount = query.data?.find((account) => account.id === detailId);

  // Chuẩn bị đúng dữ liệu mặc định hoặc dữ liệu hiện có trước khi mở modal.
  const open = (account?: Account) => {
    setEditing(account || null);
    setForm(account ? {
      name: account.name,
      account_type: formType(account.account_type),
      institution_name: ["LINKED", "BANK", "E_WALLET"].includes(account.account_type)
        ? account.institution_name || "" : "",
      balance: String(account.balance),
      currency: account.currency,
      account_number_masked: account.account_number_masked || "",
      target_amount: String(account.target_amount || ""), target_date: formatDateForDisplay(account.target_date),
      exclude_from_total: account.exclude_from_total || false,
      is_notification_enabled: account.is_notification_enabled ?? true,
    } : emptyForm);
    setError("");
    setShow(true);
  };

  // Số dư tài khoản xuất hiện ở cả dashboard và giao dịch nên phải vô hiệu cả ba cache.
  const refresh = () => Promise.all(
    ["accounts", "dashboard", "transactions"].map((key) =>
      cache.invalidateQueries({ queryKey: [key] }),
    ),
  );

  // Chuẩn hóa chuỗi, gọi API tạo/sửa và chỉ đóng modal sau khi cache liên quan đã làm mới.
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const targetDate = form.account_type === "SAVINGS" ? parseDateForApi(form.target_date) : null;
    if (form.account_type === "SAVINGS" && !targetDate) {
      setError("Hạn hoàn thành không hợp lệ. Vui lòng nhập đúng ngày/tháng/năm (dd/mm/yyyy).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        account_type: editing && form.account_type === formType(editing.account_type)
          ? editing.account_type : form.account_type,
        name: form.name.trim(),
        account_number_masked: form.account_type === "LINKED" ? form.account_number_masked || null : null,
        target_amount: form.account_type === "SAVINGS" ? form.target_amount : null,
        target_date: targetDate,
        institution_name: form.account_type === "LINKED" ? form.institution_name.trim() || null : null,
      };
      if (editing) await api.patch("/accounts/" + editing.id, payload);
      else await api.post("/accounts", payload);
      await refresh();
      setShow(false);
      setNotice(editing ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  // Xóa ví và dữ liệu liên quan; backend thực hiện tất cả thay đổi trong một transaction.
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api.delete("/accounts/" + deleting.id);
      await Promise.all([
        refresh(),
        ...["budgets", "analytics", "invoices", "notifications"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] })),
      ]);
      setDeleting(null);
      setNotice("Đã xóa vĩnh viễn ví và dữ liệu liên quan.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cf-stack">
      <PageHead eyebrow="TÀI KHOẢN" title="Ví & tài khoản"
        description="Theo dõi số dư tiền mặt, ngân hàng và các tài khoản của bạn."
        actions={<button className="cf-btn cf-btn-primary" onClick={() => open()}><Plus />Thêm tài khoản</button>} />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {error && !show && !deleting && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      {query.isPending ? <Loading /> : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <Panel><Empty title="Một nơi cho mọi tài khoản"
          description="Thêm tài khoản và nhập số dư ban đầu. Bạn sẽ tự ghi nhận giao dịch để cập nhật số dư."
          action={<button className="cf-btn cf-btn-primary" onClick={() => open()}><Plus />Tạo tài khoản đầu tiên</button>} /></Panel>
      ) : (
        <div className="cf-grid">
          {query.data.map((account) => <AccountCard key={account.id} account={account} onEdit={open} onDetails={(selected) => setDetailId(selected.id)}
            onDelete={(selected) => { setDeleting(selected); setError(""); }} />)}
        </div>
      )}
      {detailAccount && <AccountDetailsModal account={detailAccount} onClose={() => setDetailId(null)} onBank={setBank} />}
      {bank && <BankConnection account={bank} onClose={() => setBank(null)} refresh={refresh} />}
      {show && <AccountModal editing={editing} form={form} setForm={setForm} error={error} busy={busy}
        onSubmit={save} onClose={() => setShow(false)} onClearError={() => setError("")} />}
      {deleting && <AccountDeleteModal account={deleting} preview={deletionPreview.data}
        previewLoading={deletionPreview.isPending} previewError={deletionPreview.isError}
        error={error} busy={busy} onConfirm={remove}
        onClose={() => setDeleting(null)} onClearError={() => setError("")} />}
    </div>
  );
}
