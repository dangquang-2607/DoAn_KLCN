"use client";
/** Điều phối consent, xác thực demo, chọn tài khoản và đồng bộ. Không dùng credential thật. */
import { useEffect, useState, useRef } from "react";
import api from "@/dung-chung/connect-api/api";
import { errorMessage, money } from "@/dung-chung/tien-ich/finance";
import { type Account } from "@/dung-chung/nghiep-vu/finance";
import { Modal, Field, Alert } from "@/dung-chung/UI-chung/ui";

type Event = { id: string; amount: string; description: string; status: string };
type State = {
  stage?: string; linked?: boolean; error?: string; demo_otp?: string;
  consent_expires?: string; otp_expires?: string; resend_at?: string;
  last_sync?: string; last_imported?: number; source_balance?: string;
  external_account?: string; outage?: boolean; events?: Event[];
  provider_balance?: string; available_balance?: string;
};
const labels: Record<string, string> = {
  LOGIN: "Đăng nhập ngân hàng demo", OTP: "Xác nhận OTP", SELECT: "Chọn tài khoản",
  CONNECTED: "Đã liên kết · Demo", EXPIRED: "Quyền truy cập đã hết hạn", DISCONNECTED: "Đã ngắt liên kết",
};

export default function BankConnection({ account, onClose, refresh }: {
  account: Account; onClose: () => void; refresh: () => Promise<unknown>;
}) {
  const [state, setState] = useState<State>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("Demo@123");
  const [otp, setOtp] = useState("");
  const [selected, setSelected] = useState("5678");
  const [clock, setClock] = useState(Date.now());
  const retry = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    api.get("/accounts/" + account.id + "/bank")
      .then(r => { if (active) { setState(r.data); setSelected(r.data.external_account || "5678"); } })
      .catch(e => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setBusy(false); });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => { active = false; clearInterval(timer); };
  }, [account.id]);
  const act = async (action: string) => {
    setBusy(true); setError("");
    try {
      const payload = { action, ...(action === "consent" ? { consent } : {}),
        ...(action === "login" ? { username, password } : {}),
        ...(action === "otp" ? { otp } : {}),
        ...(action === "select" ? { account: selected } : {}) };
      const body = JSON.stringify(payload);
      if (retry.current?.body !== body) retry.current = { body, key: crypto.randomUUID() };
      const { data } = await api.post("/accounts/" + account.id + "/bank",
        payload, { headers: { "Idempotency-Key": retry.current!.key } });
      retry.current = null;
      setState(data);
      if (data.error) setError(data.error);
      await refresh();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const remaining = (value?: string) => value ? Math.max(0, Math.ceil((new Date(value + "Z").getTime() - clock) / 1000)) : 0;
  const stage = state.stage;
  const button = (action: string, label: string, disabled = false) =>
    <button key={action} type="button" className="cf-btn" disabled={busy || disabled} onClick={() => act(action)}>{label}</button>;
  return <Modal title={"Ngân hàng mô phỏng · " + account.name} onClose={onClose} busy={busy}>
    <div className="cf-form">
      <Alert kind="info">MÔ PHỎNG — không kết nối ngân hàng thật. Chỉ dùng tài khoản demo; không nhập mật khẩu hoặc OTP thật.</Alert>
      <p className="cf-muted">1. Cấp quyền → 2. Đăng nhập → 3. OTP → 4. Chọn tài khoản → 5. Đồng bộ</p>
      <h3>{stage ? labels[stage] || stage : "Cấp quyền truy cập"}</h3>
      {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      {(!stage || ["DISCONNECTED", "EXPIRED"].includes(stage)) && <>
        <p>Ngân hàng: {account.institution_name}. Phạm vi: thông tin tài khoản, số dư và lịch sử giao dịch. Quyền có hiệu lực 90 ngày; có thể thu hồi bất kỳ lúc nào.</p>
        <label className="cf-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Tôi đồng ý cấp quyền đọc dữ liệu mô phỏng.</label>
        {button("consent", "Đồng ý và đến ngân hàng demo", !consent)}
      </>}
      {stage === "LOGIN" && <form className="cf-form" onSubmit={e => { e.preventDefault(); act("login"); }}>
        <p>Tài khoản thử nghiệm: <strong>demo / Demo@123</strong>. Nhập sai 5 lần sẽ tạm khóa 60 giây.</p>
        <Field label="Tên đăng nhập demo"><input className="cf-input" required autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /></Field>
        <Field label="Mật khẩu demo"><input className="cf-input" type="password" required autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <button className="cf-btn cf-btn-primary" disabled={busy}>Đăng nhập demo</button>
      </form>}
      {stage === "OTP" && <form className="cf-form" onSubmit={e => { e.preventDefault(); act("otp"); }}>
        <p>Mã trong hộp thư demo: <strong>{state.demo_otp}</strong> · còn {remaining(state.otp_expires)} giây.</p>
        <Field label="OTP 6 chữ số"><input className="cf-input" required pattern="[0-9]{6}" inputMode="numeric" maxLength={6} autoComplete="off" value={otp} onChange={e => setOtp(e.target.value)} /></Field>
        <button className="cf-btn cf-btn-primary" disabled={busy}>Xác nhận OTP</button>
        {button("resend", "Gửi lại OTP (" + remaining(state.resend_at) + "s)", remaining(state.resend_at) > 0)}
        {button("expire_otp", "Demo: làm OTP hết hạn")}
      </form>}
      {stage === "SELECT" && <>
        <p>Chủ tài khoản: NGUYEN VAN DEMO. Tiền tệ VND. Số dư đầu kỳ {selected === "9012" ? "3.000.000đ" : "10.000.000đ"}; sau nhập hai giao dịch đã hoàn tất: {selected === "9012" ? "2.925.000đ" : "14.750.000đ"}.</p>
        <Field label="Chọn tài khoản để liên kết"><select className="cf-input" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="5678">Thanh toán · ****5678</option>
          <option value="9012">Tài khoản phụ · ****9012</option>
        </select></Field>
        <p className="cf-muted">Lần đầu liên kết sẽ ghi điều chỉnh từ số dư thủ công sang số dư đầu kỳ demo, rồi nhập giao dịch. Lịch sử cũ được giữ nguyên.</p>
        {button("select", "Xác nhận liên kết và đồng bộ lần đầu")}
      </>}
      {state.linked && <>
        <p>Tài khoản: ****{state.external_account} · Số dư đã đồng bộ: {money(state.source_balance || 0)}</p>
        <p>Tại ngân hàng demo: {money(state.provider_balance || 0)} · Khả dụng sau khoản đang chờ: {money(state.available_balance || 0)}</p>
        <p>Đồng bộ gần nhất: {state.last_sync ? new Date(state.last_sync + "Z").toLocaleString("en-GB") : "Chưa có"} · {state.last_imported ?? 0} giao dịch mới.</p>
        <p>Quyền truy cập đến: {state.consent_expires ? new Date(state.consent_expires + "Z").toLocaleString("en-GB") : "—"}</p>
        {button("sync", "Đồng bộ giao dịch")}
        <details><summary>Điều khiển kịch bản demo</summary><div className="cf-form">
          {button("new_transaction", "Tạo giao dịch mới −50.000đ")}
          {button("settle_pending", "Hoàn tất giao dịch đang chờ")}
          {button(state.outage ? "restore" : "outage", state.outage ? "Khôi phục ngân hàng" : "Giả lập ngân hàng gián đoạn")}
          {button("expire", "Làm quyền truy cập hết hạn")}
        </div></details>
        <details><summary>Giao dịch tại nguồn ngân hàng demo</summary>
          {state.events?.map(event => <p key={event.id}>{event.description} · {money(event.amount)} · {event.status === "PENDING" ? "Đang chờ (chưa ghi sổ)" : "Đã hoàn tất"}</p>)}
        </details>
      </>}
      {stage && <>
        {button("disconnect", "Ngắt / hủy liên kết (giữ lịch sử)")}
        {!["CONNECTED", "EXPIRED", "DISCONNECTED"].includes(stage) && <>
          <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Đồng ý bắt đầu lại phiên cấp quyền</label>
          {button("consent", "Bắt đầu lại", !consent)}
        </>}
      </>}
      {busy && <p role="status">Đang xử lý…</p>}
    </div>
  </Modal>;
}
