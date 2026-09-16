from pathlib import Path
import unicodedata

from sqlalchemy import Unicode, UnicodeText
from sqlalchemy.dialects import mssql

from app.models.base import Base
import app.models


def test_human_text_columns_are_unicode():
    fields = {
        "categories": ["name", "icon"], "accounts": ["name", "institution_name"],
        "transactions": ["description", "note"], "invoice_items": ["name", "unit", "raw_text"],
        "invoices": [
            "merchant_name", "original_filename", "note", "extracted_json",
            "invoice_symbol", "vat_rate", "payment_method",
        ],
        "ocr_jobs": ["response_json", "error_message"],
        "users": ["full_name"], "budgets": ["name"], "system_settings": ["value", "description"],
    }
    for table, columns in fields.items():
        for name in columns:
            typ = Base.metadata.tables[table].c[name].type
            assert isinstance(typ, (Unicode, UnicodeText)), (table, name)
            assert "NVARCHAR" in typ.compile(dialect=mssql.dialect(deprecate_large_types=True)), (table, name)


def test_api_preserves_vietnamese(client, user_token):
    def headers(token): return {"Authorization": f"Bearer {token}"}
    name = "Bảo hiểm – Ăn uống – Đầu tư"
    decomposed_name = unicodedata.normalize("NFD", name)
    created = client.post('/api/v1/categories', headers=headers(user_token), json={"name":decomposed_name,"type":"EXPENSE", "icon": "🛡️"})
    assert created.status_code == 201
    assert created.json()['name'] == name
    category_id = created.json()["id"]
    updated_name = "Sức khỏe – Bảo hiểm"
    updated = client.patch(
        f"/api/v1/categories/{category_id}",
        headers=headers(user_token),
        json={"name": unicodedata.normalize("NFD", updated_name)},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == updated_name
    listed = client.get('/api/v1/categories', headers=headers(user_token)).json()
    assert any(row['name'] == updated_name and row["icon"] == "🛡️" for row in listed)
    assert client.delete(f"/api/v1/categories/{category_id}", headers=headers(user_token)).status_code == 204

    account_name = "Tiết kiệm – Ngân hàng Á Châu"
    account = client.post(
        "/api/v1/accounts",
        headers=headers(user_token),
        json={
            "name": unicodedata.normalize("NFD", account_name),
            "account_type": "SAVINGS",
            "institution_name": "Ngân hàng Á Châu",
            "balance": "0",
        },
    )
    assert account.status_code == 201
    assert account.json()["name"] == account_name
    account_id = account.json()["id"]
    renamed = "Quỹ dự phòng – Việt Nam"
    updated = client.patch(
        f"/api/v1/accounts/{account_id}",
        headers=headers(user_token),
        json={"name": unicodedata.normalize("NFD", renamed)},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == renamed
    listed = client.get("/api/v1/accounts", headers=headers(user_token)).json()
    assert any(row["name"] == renamed for row in listed)
    assert client.delete(f"/api/v1/accounts/{account_id}", headers=headers(user_token)).status_code == 204


def test_invalid_decoding_marker_is_rejected(client, user_token):
    def headers(token): return {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/categories",
        headers=headers(user_token),
        json={"name": "Bảo hi�m", "type": "EXPENSE"},
    )
    assert response.status_code == 422


def test_maintained_sql_and_seed_sources_contain_no_known_mojibake():
    project_root = Path(__file__).parents[1]
    maintained_files = [
        *sorted((project_root / "migrations").glob("*.sql")),
        project_root / "scripts" / "seed.py",
    ]
    source = "\n".join(path.read_text(encoding="utf-8") for path in maintained_files)
    damaged_values = {
        "Ti?t ki?m Binance",
        "An u?ng",
        "Di chuy?n",
        "Nhà ?",
        "Y t?",
        "Giáo d?c",
        "Mua s?m",
        "Gi?i trí",
        "Hóa don di?n nu?c",
        "B?o hi?m",
        "Chi phí doanh nghi?p",
        "Luong",
        "Thu?ng",
        "Ð?u tu",
        "Thu nh?p khác",
        "Bánh Mì Th?p C?m Phúc Long",
        "D?ch v? xe qua b?n",
        "D?ch v? d?u theo gi?",
    }
    assert not {value for value in damaged_values if value in source}
    assert "N'??'" not in source
    assert "N'???'" not in source
