import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, Empty, ErrorState, Loading, Modal } from "@/dung-chung/UI-chung/ui";
import { errorMessage } from "@/dung-chung/tien-ich/finance";
import styles from "../CSS/WalletDialog.module.css";

export type BankLink = {
  id: string;
  provider: string;
  account_number_masked: string;
  status: string;
};

const statuses: Record<string, { label: string; tone: string }> = {
  CONNECTED: { label: "Đã liên kết", tone: "success" },
  EXPIRED: { label: "Hết hạn", tone: "warning" },
  DISCONNECTED: { label: "Đã ngắt liên kết", tone: "" },
};

export default function BankLinksDialog({
  banks,
  loading,
  failed,
  onRetry,
  onLink,
  onClose,
  onChanged,
}: {
  banks: BankLink[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onLink: () => void;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [target, setTarget] = useState<BankLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const linkButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<string | null>(null);

  useEffect(() => {
    if (target) {
      cancelButton.current?.focus();
    } else if (restoreFocus.current) {
      const button = list.current?.querySelector<HTMLButtonElement>(
        `button[data-bank-id="${CSS.escape(restoreFocus.current)}"]`,
      );
      (button ?? linkButton.current)?.focus();
      restoreFocus.current = null;
    }
  }, [target]);

  const cancel = () => {
    restoreFocus.current = target?.id ?? null;
    setError("");
    setTarget(null);
  };

  const unlink = async () => {
    if (!target || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/wallets/banks/${target.id}`);
      await onChanged();
      restoreFocus.current = target.id;
      setTarget(null);
      setNotice(`Đã ngắt liên kết ${target.provider}.`);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={target ? `Ngắt liên kết ${target.provider}?` : "Quản lý ngân hàng liên kết"}
      className={styles.dialog}
      busy={busy}
      onClose={target ? cancel : onClose}
    >
      <div className={styles.fields} aria-busy={busy}>
        {error && <Alert persistent onDismiss={() => setError("")}>{error}</Alert>}
        {target ? (
          <p>Tài khoản {target.account_number_masked} sẽ không còn dùng được để nạp hoặc rút tiền ở tất cả ví.</p>
        ) : (
          <>
            {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
            <p>Liên kết ngân hàng dùng chung cho tất cả ví của bạn.</p>
            {loading ? <Loading /> : failed ? <ErrorState retry={onRetry} /> : !banks?.length ? (
              <Empty title="Chưa liên kết ngân hàng" description="Thêm ngân hàng để nạp và rút tiền cho ví." />
            ) : (
              <ul ref={list} className={styles.bankLinks} aria-label="Danh sách ngân hàng liên kết">
                {banks.map((bank) => {
                  const status = statuses[bank.status] ?? { label: "Chưa xác định", tone: "" };
                  return (
                    <li key={bank.id}>
                      <div className={styles.bankLinkIdentity}>
                        <strong>{bank.provider}</strong>
                        <small>{bank.account_number_masked}</small>
                      </div>
                      <span className={`cf-badge ${status.tone}`}>{status.label}</span>
                      {bank.status === "CONNECTED" && (
                        <button
                          type="button"
                          className="cf-btn cf-btn-sm"
                          data-bank-id={bank.id}
                          aria-label={`Ngắt liên kết ${bank.provider} ${bank.account_number_masked}`}
                          onClick={() => {
                            setNotice("");
                            setTarget(bank);
                          }}
                        >
                          Ngắt liên kết
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
      <div className={styles.actions}>
        {target ? (
          <>
            <button ref={cancelButton} type="button" className="cf-btn" disabled={busy} onClick={cancel}>Hủy</button>
            <button type="button" className="cf-btn cf-btn-danger" disabled={busy} onClick={() => void unlink()}>
              {busy ? "Đang ngắt liên kết…" : "Ngắt liên kết"}
            </button>
          </>
        ) : (
          <button ref={linkButton} type="button" className="cf-btn cf-btn-primary" onClick={onLink}>
            <Plus size={16} aria-hidden="true" /> Liên kết ngân hàng
          </button>
        )}
      </div>
    </Modal>
  );
}
