import os
import uuid
import random
from datetime import datetime, timedelta

def escape_sql(val):
    if val is None:
        return 'NULL'
    if isinstance(val, str):
        val = val.replace("'", "''")
        return f"N'{val}'"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, datetime):
        return f"'{val.strftime('%Y-%m-%d %H:%M:%S')}'"
    return f"'{val}'"

def generate_sql():
    sql = []
    
    # 1. User
    admin_id = str(uuid.uuid4())
    now = datetime.now()
    # Mật khẩu được hash tạm thời (bạn có thể đổi lại sau)
    pw_hash = "$argon2id$v=19$m=65536,t=3,p=4$2q6H/wP3t0R7h5yL8qXkGQ$s+Q6mB4w3tD1/rO2pM2xH1a5c6k9d2A4b7E8f9A0b1C" 
    
    sql.append(f"INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at) VALUES ")
    sql.append(f"('{admin_id}', 'admin@capitalflow.vn', N'System Admin', '{pw_hash}', 'ADMIN', 1, {escape_sql(now)});")
    sql.append("GO\n")

    # 2. Categories
    cats = [
        ("Ăn uống", "EXPENSE", "🍜"),
        ("Di chuyển", "EXPENSE", "🚗"),
        ("Nhà ở", "EXPENSE", "🏠"),
        ("Y tế", "EXPENSE", "🏥"),
        ("Giáo dục", "EXPENSE", "📚"),
        ("Lương", "INCOME", "💰"),
        ("Thưởng", "INCOME", "🎁"),
        ("Đầu tư", "INCOME", "📈")
    ]
    cat_ids = {}
    sql.append("INSERT INTO categories (id, owner_user_id, name, type, icon, created_at) VALUES ")
    cat_values = []
    for name, ctype, icon in cats:
        cid = str(uuid.uuid4())
        cat_ids[(name, ctype)] = cid
        cat_values.append(f"('{cid}', NULL, N'{name}', '{ctype}', N'{icon}', {escape_sql(now)})")
    sql.append(",\n".join(cat_values) + ";")
    sql.append("GO\n")

    # 3. Accounts
    accs = [
        ("Vietcombank", "BANK", 15000000),
        ("Tiết kiệm Binance", "CRYPTO", 50000000),
        ("Ví Momo", "E_WALLET", 2000000)
    ]
    acc_ids = []
    sql.append("INSERT INTO accounts (id, user_id, name, account_type, balance, currency, icon, created_at) VALUES ")
    acc_values = []
    for name, atype, bal in accs:
        aid = str(uuid.uuid4())
        acc_ids.append(aid)
        acc_values.append(f"('{aid}', '{admin_id}', N'{name}', '{atype}', {bal}, 'VND', NULL, {escape_sql(now)})")
    sql.append(",\n".join(acc_values) + ";")
    sql.append("GO\n")

    # 4. Transactions
    sql.append("INSERT INTO transactions (id, user_id, account_id, category_id, invoice_id, description, amount, type, transaction_date, note, created_at) VALUES ")
    tx_values = []
    income_cats = [cid for (name, ctype), cid in cat_ids.items() if ctype == "INCOME"]
    expense_cats = [cid for (name, ctype), cid in cat_ids.items() if ctype == "EXPENSE"]

    for _ in range(150):
        tid = str(uuid.uuid4())
        is_income = random.random() < 0.25
        random_days_ago = random.randint(0, 180)
        tx_date = (now - timedelta(days=random_days_ago))
        
        acc_id = random.choice(acc_ids)
        
        if is_income:
            cid = random.choice(income_cats)
            amount = random.randint(5, 50) * 1000000
            ttype = "INCOME"
            desc = "Thu nhập"
        else:
            cid = random.choice(expense_cats)
            amount = -random.randint(5, 100) * 100000
            ttype = "EXPENSE"
            desc = "Chi tiêu"

        tx_values.append(f"('{tid}', '{admin_id}', '{acc_id}', '{cid}', NULL, N'{desc}', {amount}, '{ttype}', '{tx_date.strftime('%Y-%m-%d')}', NULL, {escape_sql(tx_date)})")

    # SQL Server INSERT limits to 1000 rows, but we only have 150, so it's fine.
    sql.append(",\n".join(tx_values) + ";")
    sql.append("GO\n")

    with open(r"d:\code\DoAn_KLCN\capitalflow-api\insert_dummy_data.sql", "w", encoding="utf-8") as f:
        f.write("\n".join(sql))

if __name__ == "__main__":
    generate_sql()
