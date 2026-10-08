"""Định nghĩa hợp đồng API cho danh mục cá nhân và danh mục hệ thống.

Vai trò: kiểm tra thao tác tạo, sửa, sắp xếp và phản hồi danh mục.
Đầu vào: payload HTTP cùng dữ liệu ORM.
Đầu ra: DTO Pydantic phục vụ user-web và admin-web.
Ràng buộc: giữ đúng quyền sở hữu, loại thu/chi và thứ tự hiển thị.
"""

from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import CategoryType
from app.dung_chung.text.unicode import normalize_unicode_text


class CategoryCreate(BaseModel):
    @field_validator("name", mode="before")
    @classmethod
    def valid_name(cls, value):
        value = normalize_unicode_text(value, strip=True)
        if not value:
            raise ValueError("Tên danh mục không được rỗng")
        return value

    @field_validator("icon", mode="before")
    @classmethod
    def normalize_icon(cls, value: str | None) -> str | None:
        return normalize_unicode_text(value) if value is not None else None

    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    icon: str | None = Field(default=None, max_length=100)
    color: str | None = None
    keywords: str | None = Field(default=None, max_length=1000)
    sort_order: int = 0

    @field_validator("keywords", mode="before")
    @classmethod
    def normalize_keywords(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = normalize_unicode_text(value, strip=True)
        return normalized or None


class CategoryUpdate(BaseModel):
    @field_validator("name", mode="before")
    @classmethod
    def valid_name(cls, value):
        if value is not None:
            value = normalize_unicode_text(value, strip=True)
        if value is not None and not value:
            raise ValueError("Tên danh mục không được rỗng")
        return value

    @field_validator("icon", mode="before")
    @classmethod
    def normalize_icon(cls, value: str | None) -> str | None:
        return normalize_unicode_text(value) if value is not None else None

    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: CategoryType | None = None
    icon: str | None = Field(default=None, max_length=100)
    color: str | None = None
    keywords: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = None
    is_active: bool | None = None

    @field_validator("keywords", mode="before")
    @classmethod
    def normalize_keywords(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = normalize_unicode_text(value, strip=True)
        return normalized or None


class CategoryOut(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    icon: str | None
    color: str | None
    keywords: str | None
    sort_order: int
    is_active: bool
    owner_user_id: UUID | None  # None = global category
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoryRestore(BaseModel):
    """Khôi phục ID cũ; chỉ cập nhật metadata người dùng đã xác nhận."""

    icon: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=20)
    keywords: str | None = Field(default=None, max_length=1000)

    @field_validator("icon", "keywords", mode="before")
    @classmethod
    def normalize_metadata(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_unicode_text(value, strip=True) or None

    model_config = {"extra": "forbid"}


class AdminCategoryCreate(CategoryCreate):
    """Danh mục mặc định do quản trị viên tạo cho toàn hệ thống."""

    is_active: bool = True


class CategoryReorder(BaseModel):
    """Thứ tự đầy đủ của danh mục hệ thống trong một nhóm thu hoặc chi."""

    type: CategoryType
    ordered_ids: list[UUID] = Field(min_length=1, max_length=200)

    @field_validator("ordered_ids")
    @classmethod
    def unique_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Danh sách sắp xếp chứa danh mục trùng lặp")
        return value


class CategorySuggestionRequest(BaseModel):
    type: CategoryType
    description: str = Field(default="", max_length=255)
    note: str | None = Field(default=None, max_length=1000)
    item_names: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("item_names")
    @classmethod
    def bounded_item_names(cls, values: list[str]) -> list[str]:
        return [normalize_unicode_text(value, strip=True)[:500] for value in values if value and value.strip()]


class CategorySuggestionOut(BaseModel):
    category_id: UUID | None = None
    category_name: str | None = None
    icon: str | None = None
    color: str | None = None
    confidence: float = 0.0
    source: str = "NONE"
    auto_apply: bool = False
    reason: str = "Không đủ dữ liệu để gợi ý danh mục"
