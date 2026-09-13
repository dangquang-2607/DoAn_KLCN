from html import escape
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
import uuid
import logging
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.core.secrets_store import unseal
from app.core.database import SessionLocal
from app.models.email_log import EmailLog
from app.models.user import User

logger = logging.getLogger("capitalflow.email")



def _smtp_login_password(host: str, password: str) -> str:
    """Accept Google's displayed four-group App Password without changing other secrets."""
    import re
    if host.strip().lower() == "smtp.gmail.com" and re.fullmatch(r"[a-z]{4}(?:\s+[a-z]{4}){3}", password.strip()):
        return "".join(password.split())
    return password


def _get_effective_smtp():
    """
    Lấy cấu hình SMTP hiệu dụng: ưu tiên từ DB (system_settings), fallback về settings (.env).
    Trả về dict với các key: smtp_host, smtp_port, smtp_user, smtp_password, smtp_tls, smtp_ssl,
    emails_from_email, emails_from_name.
    """
    try:
        from app.models.system_setting import SystemSetting
        from sqlalchemy import select as sa_select
        db = SessionLocal()
        try:
            keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password",
                     "smtp_tls", "smtp_ssl", "emails_from_email", "emails_from_name"]
            rows = db.scalars(sa_select(SystemSetting).where(SystemSetting.key.in_(keys))).all()
            if rows and len(rows) >= 3:
                result = {r.key: r.value for r in rows}
                return {
                    "smtp_host": result.get("smtp_host", settings.smtp_host),
                    "smtp_port": int(result["smtp_port"]) if result.get("smtp_port") else settings.smtp_port,
                    "smtp_user": result.get("smtp_user", settings.smtp_user),
                    "smtp_password": unseal(result["smtp_password"]) if result.get("smtp_password") else settings.smtp_password,
                    "smtp_tls": result.get("smtp_tls", "true").lower() in ("true", "1", "yes") if result.get("smtp_tls") else settings.smtp_tls,
                    "smtp_ssl": result.get("smtp_ssl", "false").lower() in ("true", "1", "yes") if result.get("smtp_ssl") else settings.smtp_ssl,
                    "emails_from_email": result.get("emails_from_email", settings.emails_from_email),
                    "emails_from_name": result.get("emails_from_name", settings.emails_from_name),
                }
        finally:
            db.close()
    except Exception as e:
        logger.warning("SMTP configuration lookup failed (%s)", type(e).__name__)

    # Fallback về settings (.env)
    return {
        "smtp_host": settings.smtp_host,
        "smtp_port": settings.smtp_port,
        "smtp_user": settings.smtp_user,
        "smtp_password": settings.smtp_password,
        "smtp_tls": settings.smtp_tls,
        "smtp_ssl": settings.smtp_ssl,
        "emails_from_email": settings.emails_from_email,
        "emails_from_name": settings.emails_from_name,
    }

def _get_base_html_template(title: str, preheader: str, body_content: str) -> str:
    """Trả về template HTML chuẩn Responsive với thương hiệu CapitalFlow"""
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }}
    .email-container {{
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }}
    .header {{
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 32px 30px;
      text-align: center;
      color: #ffffff;
    }}
    .header-logo {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.15);
      padding: 8px 16px;
      border-radius: 30px;
      backdrop-filter: blur(8px);
      margin-bottom: 12px;
    }}
    .header-logo span {{
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
    }}
    .header h1 {{
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }}
    .content {{
      padding: 36px 30px;
      line-height: 1.6;
      font-size: 15px;
    }}
    .otp-box {{
      background: #f1f5f9;
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }}
    .otp-code {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #4f46e5;
      margin: 8px 0;
    }}
    .alert-card {{
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }}
    .info-card {{
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 15px;
      margin-top: 16px;
    }}
    .footer {{
      background: #f8fafc;
      padding: 24px 30px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }}
    .footer a {{
      color: #6366f1;
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    {escape(preheader)}
  </div>
  <div class="email-container">
    <div class="header">
      <div class="header-logo">
        <span>⚡ CapitalFlow</span>
      </div>
      <h1>{title}</h1>
    </div>
    <div class="content">
      {body_content}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;">Đây là email tự động từ hệ thống Quản lý Tài chính <strong>CapitalFlow</strong>.</p>
      <p style="margin: 0;">Nếu cần hỗ trợ, vui lòng gửi phản hồi về <a href="mailto:support@capitalflow.vn">support@capitalflow.vn</a></p>
      <p style="margin: 8px 0 0 0; color: #94a3b8;">© {datetime.now().year} CapitalFlow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>"""


class EmailService:
    @staticmethod
    def _log_delivery(recipient: str, subject: str, email_type: str, status: str, error_message: str = None, db: Session = None, user_id: uuid.UUID = None):
        """Ghi nhận lịch sử gửi email vào CSDL"""
        def _do_write(session: Session):
            nonlocal user_id
            if not user_id and recipient:
                try:
                    found_uid = session.scalar(select(User.id).where(User.email == recipient))
                    if found_uid:
                        user_id = found_uid
                except Exception as ex:
                    logger.debug(f"Không thể tra cứu user_id theo recipient: {ex}")

            log_entry = EmailLog(
                id=uuid.uuid4(),
                user_id=user_id,
                recipient=recipient,
                subject=subject,
                email_type=email_type,
                status=status,
                error_message=error_message,
                created_at=datetime.now(timezone.utc)
            )
            session.add(log_entry)
            session.commit()

        if db:
            try:
                _do_write(db)
            except Exception as e:
                logger.error(f"Lỗi ghi log email với session có sẵn: {e}")
        else:
            with SessionLocal() as session:
                try:
                    _do_write(session)
                except Exception as e:
                    logger.error(f"Lỗi ghi log email: {e}")

    @staticmethod
    def _save_preview_html(recipient: str, email_type: str, html_content: str):
        """Lưu bản HTML xem trước trong uploads/emails/ khi chạy ở chế độ Dual-Mode Console"""
        try:
            folder = os.path.join(settings.upload_dir, "emails")
            os.makedirs(folder, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{recipient.replace('@', '_at_')}_{email_type}.html"
            filepath = os.path.join(folder, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html_content)
            return filepath
        except Exception as e:
            logger.warning(f"Không thể lưu file HTML xem trước: {e}")
            return None

    @classmethod
    def send_email_sync(cls, recipient: str, subject: str, html_content: str, email_type: str, db: Session = None, user_id: uuid.UUID = None) -> bool:
        """Thực hiện gửi email theo cơ chế Dual-Mode (Gửi thật nếu có SMTP, Console Preview nếu chưa cấu hình)"""
        cfg = _get_effective_smtp()
        has_smtp_creds = bool(cfg["smtp_user"] and cfg["smtp_password"] and cfg["smtp_user"].strip())

        if not has_smtp_creds:
            cls._log_delivery(recipient, subject, email_type, "FAILED", "SMTP_NOT_CONFIGURED", db, user_id=user_id)
            return False

        # ── REAL SMTP DELIVERY ────────────────────────────────────────────────
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{cfg["emails_from_name"]} <{cfg["smtp_user"]}>"
            msg["To"] = recipient

            part = MIMEText(html_content, "html", "utf-8")
            msg.attach(part)

            if cfg["smtp_ssl"] or cfg["smtp_port"] == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(cfg["smtp_host"], cfg["smtp_port"], context=context, timeout=15) as server:
                    server.login(cfg["smtp_user"], _smtp_login_password(cfg["smtp_host"], cfg["smtp_password"]))
                    server.sendmail(cfg["smtp_user"], recipient, msg.as_string())
            else:
                with smtplib.SMTP(cfg["smtp_host"], cfg["smtp_port"], timeout=15) as server:
                    if cfg["smtp_tls"]:
                        context = ssl.create_default_context()
                        server.starttls(context=context)
                    server.login(cfg["smtp_user"], _smtp_login_password(cfg["smtp_host"], cfg["smtp_password"]))
                    server.sendmail(cfg["smtp_user"], recipient, msg.as_string())

            logger.info(f"Đã gửi email thành công đến {recipient} ({email_type})")
            cls._log_delivery(recipient, subject, email_type, "SENT", None, db, user_id=user_id)
            return True

        except Exception as e:
            err_msg = type(e).__name__
            logger.error(f"Lỗi gửi SMTP đến {recipient}: {err_msg}")
            cls._log_delivery(recipient, subject, email_type, "FAILED", err_msg, db, user_id=user_id)
            return False

    # ══════════════════════════════════════════════════════════════════════════
    # CÁC MẪU EMAIL CHUYÊN BIỆT THEO NGHIỆP VỤ
    # ══════════════════════════════════════════════════════════════════════════

    @classmethod
    def send_password_reset_otp(cls, recipient: str, full_name: str, otp_code: str, db: Session = None, user_id: uuid.UUID = None):
        """Gửi mã OTP đặt lại mật khẩu"""
        subject = "🔑 Mã xác thực OTP đặt lại mật khẩu - CapitalFlow"
        body = f"""
        <p>Xin chào <strong>{escape(str(full_name))}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản CapitalFlow của bạn.</p>
        <p>Vui lòng sử dụng mã OTP dưới đây để hoàn tất việc xác thực và tạo mật khẩu mới:</p>
        
        <div class="otp-box">
          <div style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Mã xác thực OTP của bạn</div>
          <div class="otp-code">{escape(str(otp_code))}</div>
          <div style="font-size: 12px; color: #ef4444; font-weight: 500;">⏱️ Mã này có hiệu lực trong vòng <strong>10 phút</strong></div>
        </div>

        <p style="color: #64748b; font-size: 13px;">
          ⚠️ <strong>Lưu ý bảo mật:</strong> Không chia sẻ mã OTP này cho bất kỳ ai, kể cả nhân viên hỗ trợ CapitalFlow. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
        </p>
        """
        html = _get_base_html_template("Đặt Lại Mật Khẩu", "Mã xác thực OTP đổi mật khẩu của bạn", body)
        return cls.send_email_sync(recipient, subject, html, "PASSWORD_RESET", db, user_id=user_id)

    @classmethod
    def send_welcome_email(cls, recipient: str, full_name: str, db: Session = None, user_id: uuid.UUID = None):
        """Gửi email chào mừng thành viên mới"""
        subject = "🎉 Chào mừng bạn gia nhập nền tảng CapitalFlow!"
        body = f"""
        <p>Xin chào <strong>{escape(str(full_name))}</strong>,</p>
        <p>Chúc mừng bạn đã tạo tài khoản thành công và trở thành thành viên của cộng đồng Quản lý Tài chính Cá nhân thông minh <strong>CapitalFlow</strong>.</p>
        
        <div class="info-card">
          <h3 style="margin: 0 0 8px 0; color: #166534;">🚀 Bắt đầu hành trình tài chính thịnh vượng:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px;">
            <li>Ghi chép và phân loại thu chi nhanh chóng.</li>
            <li>Thiết lập ngân sách hàng tháng và nhận cảnh báo tự động.</li>
            <li>Quét hóa đơn thông minh tự động với công nghệ OCR AI.</li>
            <li>Theo dõi biểu đồ sức khỏe tài chính toàn diện.</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="{settings.frontend_url}/dashboard" class="btn">Bắt Đầu Khám Phá Ngay →</a>
        </div>
        """
        html = _get_base_html_template("Chào Mừng Thành Viên Mới", f"Chào mừng {full_name} đến với CapitalFlow", body)
        return cls.send_email_sync(recipient, subject, html, "WELCOME", db, user_id=user_id)

    @classmethod
    def send_budget_alert_email(cls, recipient: str, full_name: str, category_name: str, budget_amount: float, spent_amount: float, percentage: float, db: Session = None, user_id: uuid.UUID = None):
        """Gửi cảnh báo khi chi tiêu chạm ngưỡng hoặc vượt ngân sách"""
        is_exceeded = percentage >= 100.0
        status_label = "ĐÃ VƯỢT ĐỊNH MỨC" if is_exceeded else "CẢNH BÁO TIỆM CẬN (80%)"
        subject = f"⚠️ Cảnh báo Ngân sách: Danh mục '{category_name}' {status_label} ({percentage:.1f}%)"
        
        body = f"""
        <p>Xin chào <strong>{escape(str(full_name))}</strong>,</p>
        <p>Hệ thống ghi nhận chi tiêu của bạn trong tháng cho danh mục <strong>{escape(str(category_name))}</strong> đã đạt mức cảnh báo.</p>
        
        <div class="{'alert-card' if is_exceeded else 'info-card'}" style="{'border-left-color: #f59e0b; background: #fffbeb;' if not is_exceeded else ''}">
          <h3 style="margin: 0 0 10px 0; color: {'#991b1b' if is_exceeded else '#92400e'};">📊 Chi tiết Định mức Ngân sách:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Danh mục:</td>
              <td style="padding: 4px 0; font-weight: 700; text-align: right;">{escape(str(category_name))}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Hạn mức đã đặt:</td>
              <td style="padding: 4px 0; font-weight: 700; text-align: right;">{budget_amount:,.0f} đ</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Số tiền đã chi:</td>
              <td style="padding: 4px 0; font-weight: 700; color: {'#dc2626' if is_exceeded else '#d97706'}; text-align: right;">{spent_amount:,.0f} đ</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Tỷ lệ đã sử dụng:</td>
              <td style="padding: 4px 0; font-weight: 900; color: {'#dc2626' if is_exceeded else '#d97706'}; text-align: right;">{percentage:.1f}%</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #475569;">
          {'Vui lòng cân nhắc điều chỉnh kế hoạch chi tiêu để tránh thâm hụt tài chính.' if is_exceeded else 'Bạn đang tiến gần đến giới hạn ngân sách đã đề ra, hãy chú ý các khoản chi tiếp theo nhé!'}
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="{settings.frontend_url}/budgets" class="btn">Xem Chi Tiết Ngân Sách →</a>
        </div>
        """
        html = _get_base_html_template("Cảnh Báo Ngân Sách Chi Tiêu", f"Danh mục {category_name} đã đạt {percentage:.1f}% hạn mức", body)
        return cls.send_email_sync(recipient, subject, html, "BUDGET_ALERT", db, user_id=user_id)

    @classmethod
    def send_test_email(cls, recipient: str, subject: str = "🧪 Kiểm thử Kết nối Email CapitalFlow", message: str = "Email kiểm thử hệ thống gửi nhận thành công.", db: Session = None, user_id: uuid.UUID = None):
        """Gửi email kiểm thử kết nối SMTP"""
        body = f"""
        <p>Xin chào Quản trị viên,</p>
        <p>Đây là email kiểm thử được gửi từ hệ thống <strong>CapitalFlow</strong> để xác nhận cấu hình máy chủ gửi thư SMTP.</p>
        
        <div class="info-card">
          <p style="margin: 0; color: #166534; font-weight: 600;">✅ Kết nối máy chủ gửi thư hoạt động hoàn hảo!</p>
          <p style="margin: 6px 0 0 0; color: #15803d; font-size: 13px;"><strong>Nội dung thử nghiệm:</strong> {escape(str(message))}</p>
          <p style="margin: 4px 0 0 0; color: #15803d; font-size: 13px;"><strong>Thời gian phát:</strong> {datetime.now().strftime('%H:%M:%S %d/%m/%Y')}</p>
        </div>
        """
        html = _get_base_html_template("Kiểm Thử Kết Nối Email", "Email kiểm thử đường truyền SMTP", body)
        return cls.send_email_sync(recipient, subject, html, "TEST_EMAIL", db, user_id=user_id)

    @classmethod
    def send_account_created_by_admin_email(cls, recipient: str, full_name: str, temp_password: str, role: str = "USER", db: Session = None, user_id: uuid.UUID = None):
        """Gửi email thông báo khi tài khoản được tạo mới bởi Quản trị viên kèm mật khẩu kích hoạt tạm thời"""
        role_vn = "Quản trị viên (ADMIN)" if str(role).upper() == "ADMIN" else "Người dùng (USER)"
        subject = "🎉 Tài khoản CapitalFlow của bạn đã được khởi tạo bởi Quản trị viên"
        body = f"""
        <p>Xin chào <strong>{escape(str(full_name))}</strong>,</p>
        <p>Quản trị viên hệ thống vừa khởi tạo tài khoản truy cập nền tảng <strong>CapitalFlow</strong> dành cho bạn với vai trò <strong>{role_vn}</strong>.</p>
        
        <div class="info-card">
          <h3 style="margin: 0 0 10px 0; color: #166534;">🔐 Thông tin đăng nhập ban đầu:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;">Tài khoản (Email):</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{recipient}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Mật khẩu tạm thời:</td>
              <td style="padding: 6px 0;">
                <span style="font-family: monospace; font-size: 16px; font-weight: 800; background: #e2e8f0; padding: 3px 8px; border-radius: 6px; color: #4f46e5;">{escape(str(temp_password))}</span>
              </td>
            </tr>
          </table>
        </div>

        <p style="color: #b91c1c; font-size: 13px; font-weight: 500;">
          ⚠️ <strong>Lưu ý quan trọng:</strong> Vì lý do an toàn bảo mật, vui lòng đăng nhập và đổi mật khẩu cá nhân mới ngay trong lần truy cập đầu tiên.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="{settings.frontend_url}/login" class="btn">Đăng Nhập Vào Hệ Thống →</a>
        </div>
        """
        html = _get_base_html_template("Tài Khoản Được Khởi Tạo", f"Thông tin đăng nhập CapitalFlow của {full_name}", body)
        return cls.send_email_sync(recipient, subject, html, "ACCOUNT_CREATED", db, user_id=user_id)

    @classmethod
    def send_temporary_password_email(cls, recipient: str, full_name: str, temp_password: str, db: Session = None, user_id: uuid.UUID = None):
        """Gửi email cấp lại mật khẩu tạm thời từ Quản trị viên"""
        subject = "🔑 Cấp lại mật khẩu kích hoạt tạm thời - CapitalFlow"
        body = f"""
        <p>Xin chào <strong>{escape(str(full_name))}</strong>,</p>
        <p>Quản trị viên hệ thống vừa đặt lại mật khẩu kích hoạt tạm thời cho tài khoản <strong>CapitalFlow</strong> của bạn.</p>
        
        <div class="otp-box">
          <div style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Mật khẩu đăng nhập tạm thời</div>
          <div class="otp-code" style="letter-spacing: 2px; font-size: 26px;">{escape(str(temp_password))}</div>
          <div style="font-size: 12px; color: #64748b; font-weight: 500;">Dùng mật khẩu này để đăng nhập và đổi mật khẩu mới</div>
        </div>

        <p style="color: #64748b; font-size: 13px;">
          Nếu bạn không yêu cầu hành động này, vui lòng liên hệ ngay với Quản trị viên qua email <a href="mailto:support@capitalflow.vn">support@capitalflow.vn</a>.
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="{settings.frontend_url}/login" class="btn">Đăng Nhập Ngay →</a>
        </div>
        """
        html = _get_base_html_template("Cấp Lại Mật Khẩu", "Mật khẩu kích hoạt tạm thời của bạn", body)
        return cls.send_email_sync(recipient, subject, html, "RESET_PASSWORD_TEMP", db, user_id=user_id)


    @classmethod
    def send_account_banned_email(cls, recipient, full_name, reason, db=None):
        body = f"<p>Xin chào {escape(str(full_name))},</p><p>Tài khoản của bạn đã bị khóa.</p><p>Lý do: {escape(str(reason))}</p>"
        return cls.send_email_sync(recipient, "Thông báo khóa tài khoản", _get_base_html_template("Tài khoản bị khóa", "Thông báo bảo mật", body), "ACCOUNT_BANNED", db)

    @classmethod
    def send_account_unbanned_email(cls, recipient, full_name, db=None):
        body = f"<p>Xin chào {escape(str(full_name))},</p><p>Tài khoản đã được mở khóa. Vui lòng đăng nhập lại.</p>"
        return cls.send_email_sync(recipient, "Thông báo mở khóa tài khoản", _get_base_html_template("Tài khoản được mở khóa", "Thông báo bảo mật", body), "ACCOUNT_UNBANNED", db)

    @classmethod
    def send_role_updated_email(cls, recipient, full_name, role, db=None):
        body = f"<p>Xin chào {escape(str(full_name))},</p><p>Vai trò tài khoản đã được đổi thành: {escape(str(role))}.</p>"
        return cls.send_email_sync(recipient, "Thay đổi vai trò tài khoản", _get_base_html_template("Cập nhật vai trò", "Thông báo bảo mật", body), "ROLE_UPDATED", db)
