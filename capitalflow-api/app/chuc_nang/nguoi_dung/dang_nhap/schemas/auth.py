"""Định nghĩa hợp đồng xác thực, phiên đăng nhập và đặt lại mật khẩu.

Vai trò: kiểm tra payload đăng ký, đăng nhập, refresh, OTP và đổi mật khẩu.
Đầu vào: dữ liệu người dùng tại HTTP boundary.
Đầu ra: DTO an toàn cho routes và services xác thực.
Ràng buộc: không đưa mật khẩu, OTP hoặc refresh token vào log/chuỗi biểu diễn tùy chỉnh.
"""

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(default="", max_length=150)

    @field_validator('email')
    @classmethod
    def canonical_email(cls, value):
        return str(value).lower()

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
    new_password: str = Field(..., min_length=6, max_length=128)


class FirstTimePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)
