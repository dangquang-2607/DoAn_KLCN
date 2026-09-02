import sys
import os
import random
from datetime import datetime, timedelta

# Thêm project root vào path để import app.*
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.user import User
from app.models.account import Account, AccountType
from app.models.category import Category, CategoryType
from app.models.transaction import Transaction, TransactionType

def seed_dummy_data():
    db = SessionLocal()
    try:
        # Lấy admin user (hoặc user đầu tiên)
        admin = db.scalar(select(User).where(User.email == "admin@capitalflow.vn"))
        if not admin:
            print("❌ Không tìm thấy Admin user. Hãy chạy `python seed.py` trước!")
            return

        print(f"🚀 Bắt đầu tạo dữ liệu giả lập cho user: {admin.email}")

        # 1. Xóa dữ liệu cũ (Tùy chọn, ở đây ta chỉ xóa accounts và transactions để làm mới)
        print("Đang dọn dẹp dữ liệu cũ...")
        db.query(Transaction).filter(Transaction.user_id == admin.id).delete()
        db.query(Account).filter(Account.user_id == admin.id).delete()
        db.commit()

        # 2. Tạo 3 tài khoản ngân hàng/ví
        print("Tạo tài khoản...")
        accounts_data = [
            {"name": "Vietcombank", "account_type": AccountType.BANK, "balance": 15000000, "currency": "VND"},
            {"name": "Tiết kiệm Binance", "account_type": AccountType.CRYPTO, "balance": 50000000, "currency": "VND"},
            {"name": "Ví Momo", "account_type": AccountType.E_WALLET, "balance": 2000000, "currency": "VND"},
        ]
        
        accounts = []
        for acc in accounts_data:
            account = Account(user_id=admin.id, **acc)
            db.add(account)
            accounts.append(account)
            
        db.commit()
        for acc in accounts:
            db.refresh(acc)

        # 3. Lấy danh sách category
        expense_categories = db.scalars(select(Category).where(Category.type == CategoryType.EXPENSE)).all()
        income_categories = db.scalars(select(Category).where(Category.type == CategoryType.INCOME)).all()

        if not expense_categories or not income_categories:
            print("❌ Không tìm thấy danh mục. Hãy chắc chắn đã chạy `python seed.py`.")
            return

        # 4. Sinh giao dịch ngẫu nhiên cho 6 tháng qua
        print("Sinh các giao dịch ngẫu nhiên...")
        transactions = []
        now = datetime.now()
        
        for _ in range(150): # Tạo 150 giao dịch
            is_income = random.random() < 0.25 # 25% là thu nhập
            
            # Random thời gian trong vòng 180 ngày qua
            random_days_ago = random.randint(0, 180)
            tx_date = (now - timedelta(days=random_days_ago)).date()
            
            account = random.choice(accounts)
            
            if is_income:
                cat = random.choice(income_categories)
                amount = random.randint(5, 50) * 1000000 # 5M - 50M
                tx_type = TransactionType.INCOME
                description = f"Thu nhập từ {cat.name}"
                # Cập nhật số dư tài khoản
                account.balance += amount
            else:
                cat = random.choice(expense_categories)
                amount = random.randint(5, 100) * 100000 # 500k - 10M
                # Trong model amount được lưu là dương hay âm? 
                # Thường amount lưu giá trị tuyệt đối hoặc số âm tùy logic backend.
                # Ở Frontend user-web: tx.amount < 0 là expense. Ta sẽ lưu số âm cho Expense.
                amount = -abs(amount)
                tx_type = TransactionType.EXPENSE
                description = f"Chi tiêu: {cat.name}"
                # Cập nhật số dư
                account.balance += amount

            tx = Transaction(
                user_id=admin.id,
                account_id=account.id,
                category_id=cat.id,
                description=description,
                amount=amount,
                type=tx_type,
                transaction_date=tx_date
            )
            transactions.append(tx)

        db.add_all(transactions)
        db.commit()
        
        print(f"✅ Hoàn tất! Đã tạo 3 tài khoản và {len(transactions)} giao dịch.")

    except Exception as e:
        print(f"❌ Lỗi: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_dummy_data()
