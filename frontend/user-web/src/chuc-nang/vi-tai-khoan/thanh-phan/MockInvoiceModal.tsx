"use client";
import { useState, type FormEvent } from "react";
import {
  Plus,
  Trash2,
  QrCode,
  ArrowLeft,
  Download,
} from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, Field, Modal } from "@/dung-chung/UI-chung/ui";
import MoneyInput from "@/dung-chung/UI-chung/MoneyInput";
import { money, errorMessage } from "@/dung-chung/tien-ich/finance";
import { clearLocalizedValidation, localizeInvalidField } from "@/dung-chung/tien-ich/formValidation";
import { billTotal, type BillItem, type BillQR } from "../xu-ly/billQr";
import BillReceipt from "../thanh-toan/BillReceipt";
import styles from "../CSS/MockInvoiceModal.module.css";

interface MockInvoiceModalProps {
  onClose: () => void;
  onPayWithWallet?: (qrPayload: string) => void;
}

export default function MockInvoiceModal({ onClose }: MockInvoiceModalProps) {
  const [step, setStep] = useState<"form" | "invoice">("form");
  const [merchant, setMerchant] = useState("");
  const [items, setItems] = useState<BillItem[]>([{ name: "", quantity: 1, unit_price: "" }]);
  const [bill, setBill] = useState<BillQR | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  const total = billTotal(items);

  const edit = (index: number, field: keyof BillItem, value: string | number) => {
    setItems((current) => current.map((item, at) => (at === index ? { ...item, [field]: value } : item)));
    setBill(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!total || Number(total) <= 0) throw new Error("Nhập số lượng và đơn giá hợp lệ cho từng mặt hàng.");
      const { data } = await api.post<BillQR>("/wallets/bills/qr", {
        merchant_name: merchant.trim(),
        currency: "VND",
        items,
      });
      setBill(data);
      setCreatedAt(new Date().toISOString());
      setStep("invoice");
    } catch (failure) {
      setError(failure instanceof Error && !("response" in failure) ? failure.message : errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={step === "form" ? "Tạo hóa đơn mô phỏng" : "Hóa đơn thanh toán thực tế"}
      className={step === "form" ? styles.modalCard : `${styles.modalCard} ${styles.modalReceiptCard}`}
      onClose={onClose}
      busy={busy}
    >
      {/* CỬA SỔ 1: FORM NHẬP THÔNG TIN (Giống form bên trái hình 5) */}
      {step === "form" && (
        <form
          className={styles.form}
          onSubmit={submit}
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearLocalizedValidation}
        >
          <div className={styles.body}>
            {error && <Alert persistent onDismiss={() => setError("")}>{error}</Alert>}

            <Field label="Tên cửa hàng">
              <input
                className="cf-input"
                aria-label="Tên cửa hàng"
                required
                maxLength={150}
                disabled={busy}
                placeholder="Ví dụ: Phúc Long, Highland, Circle K..."
                value={merchant}
                onChange={(event) => {
                  setMerchant(event.target.value);
                  setBill(null);
                }}
              />
            </Field>

            {items.map((item, index) => (
              <div className={styles.itemRow} key={index}>
                <Field label={`Mặt hàng ${index + 1}`}>
                  <input
                    className="cf-input"
                    aria-label={`Tên mặt hàng ${index + 1}`}
                    required
                    maxLength={100}
                    disabled={busy}
                    placeholder="Tên sản phẩm..."
                    value={item.name}
                    onChange={(event) => edit(index, "name", event.target.value)}
                  />
                </Field>
                <Field label="Số lượng">
                  <input
                    className="cf-input"
                    aria-label={`Số lượng ${index + 1}`}
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    required
                    disabled={busy}
                    value={item.quantity || ""}
                    onChange={(event) => edit(index, "quantity", Number(event.target.value))}
                  />
                </Field>
                <Field label="Đơn giá">
                  <MoneyInput
                    aria-label={`Đơn giá ${index + 1}`}
                    value={item.unit_price}
                    disabled={busy}
                    required
                    onValueChange={(value) => edit(index, "unit_price", value)}
                  />
                </Field>
                <button
                  type="button"
                  className="cf-btn"
                  aria-label={`Bỏ mặt hàng ${index + 1}`}
                  title="Xóa dòng mặt hàng này"
                  disabled={busy || items.length === 1}
                  onClick={() => {
                    setItems((current) => current.filter((_, at) => at !== index));
                    setBill(null);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <button
              type="button"
              className="cf-btn"
              disabled={busy || items.length >= 12}
              onClick={() => {
                setItems((current) => [...current, { name: "", quantity: 1, unit_price: "" }]);
                setBill(null);
              }}
            >
              <Plus size={16} />
              Thêm mặt hàng
            </button>

            <div className={styles.totalRow}>
              <span>Tổng tiền:</span>
              <strong>
                {total ? money(total) : (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">Chưa tính được</span>
                  </>
                )}
              </strong>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={`cf-btn cf-btn-primary ${styles.btnPrimary}`}
              disabled={busy}
            >
              <QrCode size={17} />
              {busy ? "Đang tạo QR…" : "Tạo QR hóa đơn"}
            </button>
            {bill && (
              <button
                type="button"
                className="cf-btn"
                onClick={() => setStep("invoice")}
              >
                Xem hóa đơn hiện tại →
              </button>
            )}
          </div>
        </form>
      )}

      {/* CỬA SỔ 2: HÓA ĐƠN THỰC TẾ KÈM MÃ QR THANH TOÁN */}
      {step === "invoice" && bill && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, overflow: "hidden" }}>
          <div className={styles.body}>
            <BillReceipt bill={bill} displayedAt={createdAt} status="awaiting-scan">
              <div className={styles.receiptQrSection}>
                <p className={styles.qrInstruction}>QUÉT MÃ QR ĐỂ THANH TOÁN</p>
                <div className={styles.qrFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bill.qr_image_data_url}
                    alt={`Mã QR thanh toán cho hóa đơn ${bill.bill_reference}`}
                    width={200}
                    height={200}
                    className={styles.qrImage}
                  />
                </div>
              </div>

              <footer className={styles.receiptFooter}>
                <p style={{ margin: "10px 0 0", fontWeight: 500, color: "#475569" }}>
                  Cảm ơn quý khách đã mua sắm!
                </p>
              </footer>
            </BillReceipt>

          </div>

          {/* Các nút hành động thao tác với hóa đơn: Chỉ còn Quay lại chỉnh sửa và Tải ảnh QR */}
          <div className={styles.actions}>
            <button
              type="button"
              className="cf-btn"
              style={{ flex: 1 }}
              onClick={() => setStep("form")}
            >
              <ArrowLeft size={16} />
              Quay lại chỉnh sửa
            </button>
            <a
              className="cf-btn cf-btn-primary"
              style={{ flex: 1 }}
              href={bill.qr_image_data_url}
              download={`capitalflow-bill-${bill.bill_reference.replace(/[^a-zA-Z0-9_-]/g, "_")}.svg`}
            >
              <Download size={16} />
              Tải ảnh QR
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
