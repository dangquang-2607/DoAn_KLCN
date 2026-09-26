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
 *   Bảo toàn số dư và lịch sử; không cho ngừng tài khoản khi số dư khác 0.
 * ============================================================================
 */
"use client";

/**
 * Điều phối nghiệp vụ ví: tải dữ liệu, gọi API tạo/sửa/ngừng dùng và làm mới
 * các màn có số dư liên quan. Phần trình bày được tách vào `_components`.
 */
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import api from "@/lib/api";
import { Alert, Empty, ErrorState, Loading, PageHead, Panel } from "@/components/ui/ui";
import { errorMessage, type Account } from "@/lib/finance";
import AccountCard from "./_components/AccountCard";
import AccountDeleteModal from "./_components/AccountDeleteModal";
import AccountModal, { type AccountForm } from "./_components/AccountModal";

const emptyForm: AccountForm = {
  name: "",
  account_type: "CASH",
  institution_name: "",
  balance: "0",
  currency: "VND",
};

export default function Accounts() {
  const cache = useQueryClient();
  const query = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const [editing, setEditing] = useState<Account | null>(null);
  const [show, setShow] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<AccountForm>(emptyForm);

  // Chuẩn bị đúng dữ liệu mặc định hoặc dữ liệu hiện có trước khi mở modal.
  const open = (account?: Account) => {
    setEditing(account || null);
    setForm(account ? {
      name: account.name,
      account_type: account.account_type,
      institution_name: account.institution_name || "",
      balance: String(account.balance),
      currency: account.currency,
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
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        institution_name: form.institution_name.trim() || null,
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

  // Ngừng sử dụng tài khoản; backend và modal cùng bảo vệ điều kiện số dư phải bằng 0.
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api.delete("/accounts/" + deleting.id);
      await refresh();
      setDeleting(null);
      setNotice("Đã ngừng sử dụng ví. Lịch sử giao dịch vẫn được lưu.");
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
      {query.isPending ? <Loading /> : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <Panel><Empty title="Một nơi cho mọi tài khoản"
          description="Thêm tài khoản và nhập số dư ban đầu. Bạn sẽ tự ghi nhận giao dịch để cập nhật số dư."
          action={<button className="cf-btn cf-btn-primary" onClick={() => open()}><Plus />Tạo tài khoản đầu tiên</button>} /></Panel>
      ) : (
        <div className="cf-grid">
          {query.data.map((account) => <AccountCard key={account.id} account={account} onEdit={open}
            onDelete={(selected) => { setDeleting(selected); setError(""); }} />)}
        </div>
      )}
      {show && <AccountModal editing={editing} form={form} setForm={setForm} error={error} busy={busy}
        onSubmit={save} onClose={() => setShow(false)} onClearError={() => setError("")} />}
      {deleting && <AccountDeleteModal account={deleting} error={error} busy={busy} onConfirm={remove}
        onClose={() => setDeleting(null)} onClearError={() => setError("")} />}
    </div>
  );
}
