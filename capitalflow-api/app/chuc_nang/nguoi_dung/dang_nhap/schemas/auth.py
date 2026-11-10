"""Định nghĩa hợp đồng xác thực, phiên đăng nhập và đặt lại mật khẩu.

Vai trò: kiểm tra payload đăng ký, đăng nhập, refresh, OTP và đổi mật khẩu.
Đầu vào: dữ liệu người dùng tại HTTP boundary.
Đầu ra: DTO an toàn cho routes và services xác thực.
Ràng buộc: không đưa mật khẩu, OTP hoặc refresh token vào log/chuỗi biểu diễn tùy chỉnh.
"""

from typing import Annotated

from pydantic import AfterValidator, AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.dung_chung.text.unicode import normalize_unicode_text, validate_utf16_length


def validate_new_password(value: str) -> str:
    if sum(not character.isspace() for character in value) < 6:
        raise ValueError("Mật khẩu phải có ít nhất 6 ký tự không phải khoảng trắng.")
    return value


NewPassword = Annotated[str, Field(min_length=6, max_length=128), AfterValidator(validate_new_password)]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr
    password: NewPassword
    full_name: str = Field(default="", max_length=150)

    @field_validator("full_name", mode="before")
    @classmethod
    def valid_full_name(cls, value: str) -> str:
        value = normalize_unicode_text(value, strip=True)
        validate_utf16_length(value, 150, "Họ tên")
        return value

    @field_validator('email', mode='before')
    @classmethod
    def canonical_email(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        email = value.strip().lower()
        if not email.endswith('@gmail.com'):
            raise ValueError("Vui lòng sử dụng địa chỉ email @gmail.com để đăng ký.")
        return email

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr = Field(validation_alias=AliasChoices('email', 'identifier'))
    password: str

    @field_validator('email')
    @classmethod
    def canonical_identifier(cls, value):
        return str(value).lower()


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)
    new_password: NewPassword


class FirstTimePasswordRequest(BaseModel):
    new_password: NewPassword


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: NewPassword
