"""
Seed script — tạo tài khoản Admin mặc định và danh mục hệ thống.
Chạy 1 lần duy nhất:  .venv\Scripts\python seed.py

Sau đó đổi mật khẩu Admin qua API.
"""
import sys
import os

# Thêm project root vào path để import app.*
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.category import Category, CategoryType


# ── Tài khoản Admin mặc định ─────────────────────────────────
ADMIN_EMAIL = "admin@capitalflow.vn"
ADMIN_PASSWORD = "CapitalFlow@2026"   # Đổi ngay sau khi deploy!
ADMIN_NAME = "System Admin"

# ── Danh mục hệ thống (owner_user_id = NULL) ─────────────────
SYSTEM_CATEGORIES = [
    # Chi tiêu
    {"name": "Ăn uống",          "type": CategoryType.EXPENSE, "icon": "🍜"},
    {"name": "Di chuyển",        "type": CategoryType.EXPENSE, "icon": "🚗"},
    {"name": "Nhà ở",            "type": CategoryType.EXPENSE, "icon": "🏠"},
    {"name": "Y tế",             "type": CategoryType.EXPENSE, "icon": "🏥"},
    {"name": "Giáo dục",         "type": CategoryType.EXPENSE, "icon": "📚"},
    {"name": "Mua sắm",          "type": CategoryType.EXPENSE, "icon": "🛍️"},
    {"name": "Giải trí",         "type": CategoryType.EXPENSE, "icon": "🎬"},
    {"name": "Hóa đơn điện nước","type": CategoryType.EXPENSE, "icon": "💡"},
    {"name": "Bảo hiểm",         "type": CategoryType.EXPENSE, "icon": "🛡️"},
    {"name": "Chi phí doanh nghiệp","type": CategoryType.EXPENSE, "icon": "💼"},
    {"name": "Khác",             "type": CategoryType.EXPENSE, "icon": "📦"},
    # Thu nhập
    {"name": "Lương",            "type": CategoryType.INCOME,  "icon": "💰"},
    {"name": "Thưởng",           "type": CategoryType.INCOME,  "icon": "🎁"},
    {"name": "Đầu tư",           "type": CategoryType.INCOME,  "icon": "📈"},
    {"name": "Kinh doanh",       "type": CategoryType.INCOME,  "icon": "🏪"},
    {"name": "Thu nhập khác",    "type": CategoryType.INCOME,  "icon": "💵"},
]


def seed():
    db = SessionLocal()
    try:
        # 1. Tạo Admin nếu chưa có
        admin = db.scalar(select(User).where(User.email == ADMIN_EMAIL))
        if admin:
            print(f"  [SKIP] Admin đã tồn tại: {ADMIN_EMAIL}")
        else:
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASSWORD),
                full_name=ADMIN_NAME,
                role=UserRole.ADMIN,
            )
            db.add(admin)
            print(f"  [OK]   Tạo Admin: {ADMIN_EMAIL}")

        # 2. Tạo danh mục hệ thống
        created = 0
        for cat_data in SYSTEM_CATEGORIES:
            existing = db.scalar(
                select(Category).where(
                    Category.name == cat_data["name"],
                    Category.owner_user_id.is_(None),
                )
            )
            if not existing:
                db.add(Category(owner_user_id=None, **cat_data))
                created += 1

        db.commit()
        print(f"  [OK]   Danh mục hệ thống: {created} mới / {len(SYSTEM_CATEGORIES)} tổng")
        print()
        print("  Admin login:")
        print(f"    Email:    {ADMIN_EMAIL}")
        print(f"    Password: {ADMIN_PASSWORD}")
        print()
        print("  ⚠️  Hãy đổi mật khẩu Admin ngay sau khi đăng nhập lần đầu!")

    finally:
        db.close()


if __name__ == "__main__":
    print("\n=== CapitalFlow Seed ===\n")
    seed()
    print("\n=== Done ===\n")
