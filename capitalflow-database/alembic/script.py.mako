"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Ngày tạo: ${create_date}
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, Sequence[str], None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Nâng schema lên revision này."""

    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Hoàn tác revision khi đã chứng minh không làm mất dữ liệu."""

    ${downgrades if downgrades else "pass"}

