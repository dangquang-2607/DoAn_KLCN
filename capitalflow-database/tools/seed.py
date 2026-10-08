r"""Seed danh mục hệ thống và tùy chọn bootstrap quản trị viên.

Vai trò: tạo dữ liệu nền tối thiểu cho môi trường CapitalFlow mới.
Đầu vào: CSDL hiện tại và credential bootstrap lấy từ biến môi trường.
Đầu ra/side effect: danh mục hệ thống và tài khoản quản trị nếu chưa tồn tại.
Ràng buộc an toàn: không có secret mặc định, không ghi secret vào log và chạy lại idempotent.
"""
import sys
import os
from pathlib import Path

# Project database đứng ngang hàng API; chỉ thêm API root để dùng model nghiệp vụ.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "capitalflow-api"))

from sqlalchemy import select
from app.dung_chung.database.session import SessionLocal
from app.dung_chung.security.passwords import hash_password
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category, CategoryType


# Thông tin bootstrap không có giá trị mặc định và không được ghi vào log.
ADMIN_EMAIL = os.getenv("CAPITALFLOW_BOOTSTRAP_ADMIN_EMAIL", "").strip()
ADMIN_PASSWORD = os.getenv("CAPITALFLOW_BOOTSTRAP_ADMIN_PASSWORD", "")
ADMIN_NAME = os.getenv("CAPITALFLOW_BOOTSTRAP_ADMIN_NAME", "System Admin").strip() or "System Admin"

# ── Danh mục hệ thống (owner_user_id = NULL) ─────────────────
SYSTEM_CATEGORIES = [
    # Chi tiêu
    {"name": "Ăn uống", "type": CategoryType.EXPENSE, "icon": "utensils", "color": "orange", "sort_order": 10, "keywords": "nhà hàng, quán ăn, cơm, phở, bún, bánh mì, cà phê, cafe, trà sữa, đồ ăn, thực phẩm, siêu thị"},
    {"name": "Di chuyển", "type": CategoryType.EXPENSE, "icon": "car", "color": "sky", "sort_order": 20, "keywords": "xăng, dầu, grab, taxi, xe buýt, vé xe, vé tàu, gửi xe, cầu đường, bảo dưỡng xe"},
    {"name": "Nhà ở", "type": CategoryType.EXPENSE, "icon": "home", "color": "teal", "sort_order": 30, "keywords": "tiền thuê nhà, chung cư, nội thất, gia dụng, sửa nhà"},
    {"name": "Y tế", "type": CategoryType.EXPENSE, "icon": "heart-pulse", "color": "rose", "sort_order": 40, "keywords": "bệnh viện, phòng khám, nhà thuốc, thuốc, nha khoa, xét nghiệm, khám bệnh"},
    {"name": "Giáo dục", "type": CategoryType.EXPENSE, "icon": "graduation-cap", "color": "cobalt", "sort_order": 50, "keywords": "học phí, trường học, khóa học, sách, giáo trình, trung tâm ngoại ngữ"},
    {"name": "Mua sắm", "type": CategoryType.EXPENSE, "icon": "shopping-bag", "color": "amber", "sort_order": 60, "keywords": "mua sắm, cửa hàng, quần áo, giày dép, mỹ phẩm, thương mại điện tử"},
    {"name": "Giải trí", "type": CategoryType.EXPENSE, "icon": "film", "color": "rose", "sort_order": 70, "keywords": "rạp phim, xem phim, karaoke, trò chơi, game, âm nhạc, du lịch"},
    {"name": "Hóa đơn điện nước", "type": CategoryType.EXPENSE, "icon": "lightbulb", "color": "amber", "sort_order": 80, "keywords": "tiền điện, tiền nước, internet, wifi, điện thoại, viễn thông"},
    {"name": "Bảo hiểm", "type": CategoryType.EXPENSE, "icon": "shield", "color": "teal", "sort_order": 90, "keywords": "bảo hiểm, bảo hiểm nhân thọ, bảo hiểm xe, bảo hiểm y tế"},
    {"name": "Chi phí doanh nghiệp", "type": CategoryType.EXPENSE, "icon": "briefcase", "color": "slate", "sort_order": 100, "keywords": "văn phòng, phần mềm, hosting, tên miền, quảng cáo, tiếp khách, công tác"},
    {"name": "Khác",             "type": CategoryType.EXPENSE, "icon": "package", "color": "slate", "sort_order": 110},
    # Thu nhập
    {"name": "Lương", "type": CategoryType.INCOME, "icon": "banknote", "color": "green", "sort_order": 10, "keywords": "lương, tiền lương, payroll, salary"},
    {"name": "Thưởng", "type": CategoryType.INCOME, "icon": "gift", "color": "amber", "sort_order": 20, "keywords": "thưởng, bonus, hoa hồng"},
    {"name": "Đầu tư", "type": CategoryType.INCOME, "icon": "trending-up", "color": "cobalt", "sort_order": 30, "keywords": "cổ tức, lợi nhuận đầu tư, chứng khoán, trái phiếu, tiền lãi"},
    {"name": "Kinh doanh", "type": CategoryType.INCOME, "icon": "store", "color": "teal", "sort_order": 40, "keywords": "doanh thu, bán hàng, kinh doanh, khách hàng thanh toán"},
    {"name": "Thu nhập khác", "type": CategoryType.INCOME, "icon": "wallet", "color": "slate", "sort_order": 50, "keywords": "hoàn tiền, quà tặng, trợ cấp, thu nhập khác"},
]


def seed():
    db = SessionLocal()
    try:
        # 1. Chỉ bootstrap Admin khi operator cấp đủ secret từ môi trường.
        if bool(ADMIN_EMAIL) != bool(ADMIN_PASSWORD):
            raise RuntimeError("Cần cung cấp đồng thời email và mật khẩu bootstrap Admin")
        if ADMIN_PASSWORD and len(ADMIN_PASSWORD) < 12:
            raise RuntimeError("Mật khẩu bootstrap Admin phải có ít nhất 12 ký tự")
        if ADMIN_EMAIL:
            admin = db.scalar(select(User).where(User.email == ADMIN_EMAIL))
            if admin:
                admin.is_system_account = True
                print("  [SKIP] Admin bootstrap đã tồn tại")
            else:
                admin = User(
                    email=ADMIN_EMAIL,
                    password_hash=hash_password(ADMIN_PASSWORD),
                    full_name=ADMIN_NAME,
                    role=UserRole.ADMIN,
                    is_system_account=True,
                    must_change_password=True,
                )
                db.add(admin)
                print("  [OK]   Đã tạo Admin bootstrap từ biến môi trường")
        else:
            print("  [SKIP] Không tạo Admin: chưa cấu hình biến bootstrap")

        # 2. Tạo danh mục hệ thống
        created = 0
        for cat_data in SYSTEM_CATEGORIES:
            existing = db.scalar(
                select(Category).where(
                    Category.name == cat_data["name"],
                    Category.type == cat_data["type"],
                    Category.owner_user_id.is_(None),
                )
            )
            if not existing:
                db.add(Category(owner_user_id=None, **cat_data))
                created += 1
            else:
                for key in ("icon", "color", "sort_order", "keywords"):
                    setattr(existing, key, cat_data.get(key))

        db.commit()
        print(f"  [OK]   Danh mục hệ thống: {created} mới / {len(SYSTEM_CATEGORIES)} tổng")
        if ADMIN_EMAIL:
            print("  Admin bootstrap phải đổi mật khẩu trong lần đăng nhập đầu tiên.")

    finally:
        db.close()


if __name__ == "__main__":
    print("\n=== CapitalFlow Seed ===\n")
    seed()
    print("\n=== Done ===\n")
