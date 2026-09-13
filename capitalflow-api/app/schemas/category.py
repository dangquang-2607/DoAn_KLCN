from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.category import CategoryType


class CategoryCreate(BaseModel):
    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if not value.strip():
            raise ValueError("Tên danh mục không được rỗng")
        return value.strip()

    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    icon: str | None = None
    color: str | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Tên danh mục không được rỗng")
        return value.strip() if value is not None else value

    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: CategoryType | None = None
    icon: str | None = None
    color: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    icon: str | None
    color: str | None
    sort_order: int
    is_active: bool
    owner_user_id: UUID | None  # None = global category
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
