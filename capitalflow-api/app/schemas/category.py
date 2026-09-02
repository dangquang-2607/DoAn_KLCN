from uuid import UUID
from datetime import datetime

from pydantic import BaseModel

from app.models.category import CategoryType


class CategoryCreate(BaseModel):
    name: str
    type: CategoryType
    icon: str | None = None
    color: str | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    type: CategoryType | None = None
    icon: str | None = None
    color: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: UUID
    name: str
    type: CategoryType
    icon: str | None
    color: str | None
    sort_order: int
    is_active: bool
    owner_user_id: UUID | None  # None = global category
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
