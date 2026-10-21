"""Dịch vụ gửi email cho CapitalFlow.

Vai trò: cung cấp hàm gửi OTP và các email hệ thống khác.
Đầu vào: địa chỉ email người nhận và nội dung.
Đầu ra: gửi email qua SMTP sử dụng cấu hình trong settings.
Ràng buộc: không log mật khẩu SMTP; phải xử lý lỗi gửi mail an toàn.
"""

import logging

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.dung_chung.config import settings

logger = logging.getLogger(__name__)


def _build_mail_config() -> ConnectionConfig:
    """Tạo cấu hình kết nối SMTP từ settings."""
    return ConnectionConfig(
        MAIL_USERNAME=settings.smtp_user,
        MAIL_PASSWORD=settings.smtp_password,
        MAIL_FROM=settings.emails_from_email,
        MAIL_FROM_NAME=settings.emails_from_name,
        MAIL_PORT=settings.smtp_port,
        MAIL_SERVER=settings.smtp_host,
        MAIL_STARTTLS=settings.smtp_tls,
        MAIL_SSL_TLS=settings.smtp_ssl,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


async def send_otp_email(to_email: str, otp_code: str, purpose_label: str = "liên kết ngân hàng") -> None:
    """Gửi mã OTP đến email người dùng.

    Args:
        to_email: Địa chỉ email người nhận.
        otp_code: Mã OTP 6 chữ số.
        purpose_label: Mô tả mục đích (hiển thị trong nội dung mail).

    Raises:
        Exception: Nếu gửi mail thất bại.
    """
    html_body = f"""
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <title>Mã xác thực CapitalFlow</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background:#f5f7fb; margin:0; padding:32px;">
      <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <h2 style="color:#1e3a8a; margin-top:0;">CapitalFlow</h2>
        <p style="color:#334155; font-size:15px;">Xin chào,</p>
        <p style="color:#334155; font-size:15px;">
          Bạn đang thực hiện thao tác <strong>{purpose_label}</strong> trên CapitalFlow.
          Vui lòng sử dụng mã xác thực dưới đây để hoàn tất:
        </p>
        <div style="text-align:center; margin:28px 0;">
          <span style="display:inline-block; font-size:32px; font-weight:bold; letter-spacing:8px;
                       color:#1e3a8a; background:#eff6ff; padding:16px 28px; border-radius:10px;">
            {otp_code}
          </span>
        </div>
        <p style="color:#64748b; font-size:13px;">Mã có hiệu lực trong <strong>5 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />
        <p style="color:#94a3b8; font-size:12px;">Nếu bạn không thực hiện thao tác này, vui lòng bỏ qua email.</p>
      </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="[CapitalFlow] Mã xác thực OTP",
        recipients=[to_email],
        body=html_body,
        subtype=MessageType.html,
    )

    fm = FastMail(_build_mail_config())
    await fm.send_message(message)
    logger.info("Đã gửi OTP tới %s", to_email)