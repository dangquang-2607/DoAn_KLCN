"""Nhận diện baseline đánh dấu của hệ Alembic cũ.

Revision ID: da10f25d5743
Revises: None

Revision này cố ý không chứa DDL. Nó chỉ tạo cầu nối version để database hiện
tại có thể được stamp sang baseline đầy đủ mà không chạy lại CREATE TABLE.
"""

from typing import Sequence, Union


revision: str = "da10f25d5743"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Giữ nguyên schema vì database legacy đã tồn tại trước Alembic."""

    pass


def downgrade() -> None:
    """Không thay đổi schema khi quay về trước marker legacy."""

    pass

