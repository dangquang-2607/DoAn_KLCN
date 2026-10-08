"""Kiểm thử hồi quy các feature đã hoàn thiện và hợp đồng API liên quan."""

from datetime import date
from io import BytesIO

from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_admin_manages_and_reorders_global_categories(client, admin_token, user_token):
    first = client.post(
        "/api/v1/admin/categories",
        headers=headers(admin_token),
        json={"name": "Ăn trưa", "type": "EXPENSE", "icon": "utensils", "color": "orange"},
    )
    assert first.status_code == 201, first.text
    second = client.post(
        "/api/v1/admin/categories",
        headers=headers(admin_token),
        json={"name": "Đi lại", "type": "EXPENSE", "icon": "car", "color": "sky"},
    )
    assert second.status_code == 201, second.text
    ids = [first.json()["id"], second.json()["id"]]
    reordered = client.put(
        "/api/v1/admin/categories/reorder",
        headers=headers(admin_token),
        json={"type": "EXPENSE", "ordered_ids": list(reversed(ids))},
    )
    assert reordered.status_code == 200, reordered.text
    assert [row["id"] for row in reordered.json()] == list(reversed(ids))

    hidden = client.patch(
        f"/api/v1/admin/categories/{ids[0]}",
        headers=headers(admin_token),
        json={"is_active": False},
    )
    assert hidden.status_code == 200
    visible_to_user = client.get("/api/v1/categories", headers=headers(user_token)).json()
    assert ids[0] not in {row["id"] for row in visible_to_user}
    assert client.get("/api/v1/admin/categories", headers=headers(user_token)).status_code == 403


def test_structured_invoice_xml_is_parsed_without_ocr(client, user_token):
    xml = b"""<?xml version='1.0' encoding='UTF-8'?>
    <HDon><DLHDon><TTChung><KHHDon>1C26TAA</KHHDon><SHDon>00001234</SHDon><NLap>2026-09-16</NLap><HTTToan>CK</HTTToan></TTChung>
    <NDHDon><NBan><Ten>Cong ty Viet</Ten><MST>0101234567</MST><DChi>Ha Noi</DChi></NBan>
    <DSHHDVu><HHDVu><THHDVu>Dich vu phan mem</THHDVu><DVTinh>Thang</DVTinh><SLuong>1</SLuong><DGia>1000000</DGia><ThTien>1000000</ThTien></HHDVu></DSHHDVu>
    <TToan><TgTCThue>1000000</TgTCThue><TgTThue>100000</TgTThue><TgTTTBSo>1100000</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>"""
    response = client.post(
        "/api/v1/invoices",
        headers=headers(user_token),
        files={"file": ("invoice.xml", BytesIO(xml), "application/xml")},
    )
    assert response.status_code == 201, response.text
    invoice = client.get(f"/api/v1/invoices/{response.json()['id']}", headers=headers(user_token))
    assert invoice.status_code == 200
    body = invoice.json()
    assert body["source"] == "IMPORT" # current source enum; original_filename remains XML
    assert body["status"] == "REVIEW_REQUIRED"
    assert body["invoice_number"] == "00001234"
    assert body["merchant_tax_code"] == "0101234567"
    assert body["total_amount"] == "1100000.00"
    assert body["items"][0]["name"] == "Dich vu phan mem"


def test_custom_range_analytics_and_full_csv_export(client, db, test_user, user_token):
    account = Account(user_id=test_user.id, name="Ví", account_type="CASH", balance=0, currency="VND")
    category = Category(owner_user_id=test_user.id, name="Ăn uống", type="EXPENSE")
    db.add_all([account, category]); db.flush()
    db.add_all([
        Transaction(user_id=test_user.id, account_id=account.id, category_id=category.id, amount=-125000, type="EXPENSE", kind="NORMAL", source="MANUAL", transaction_date=date(2026, 9, 10), description="Bữa trưa"),
        Transaction(user_id=test_user.id, account_id=account.id, amount=500000, type="INCOME", kind="NORMAL", source="MANUAL", transaction_date=date(2026, 9, 11), description="Hoàn tiền"),
    ])
    db.commit()
    params = {"start_date": "2026-09-01", "end_date": "2026-09-30"}
    report = client.get("/api/v1/analytics", headers=headers(user_token), params=params)
    assert report.status_code == 200, report.text
    assert report.json()["summary"] == {"income": 500000.0, "expense": 125000.0, "net": 375000.0}
    exported = client.get("/api/v1/analytics/export.csv", headers=headers(user_token), params=params)
    assert exported.status_code == 200
    assert "Bữa trưa" in exported.content.decode("utf-8-sig")


def test_admin_can_retry_failed_ocr_without_reading_user_invoice(client, db, test_user, admin_token):
    invoice = Invoice(user_id=test_user.id, status="FAILED", mime_type="image/jpeg", source="UPLOAD")
    db.add(invoice); db.flush()
    job = OcrJob(user_id=test_user.id, invoice_id=invoice.id, status="FAILED", error_message="provider timeout")
    db.add(job); db.commit()
    response = client.post(f"/api/v1/admin/system/ocr-jobs/{job.id}/retry", headers=headers(admin_token))
    assert response.status_code == 202, response.text
    db.refresh(invoice)
    assert invoice.status == "PROCESSING"


def test_keyword_suggestion_is_auto_applied_and_auditable(client, db, test_user, user_token):
    account = Account(user_id=test_user.id, name="Ví tự động", account_type="CASH", balance=500000, currency="VND")
    category = Category(owner_user_id=None, name="Ăn uống tự động", type="EXPENSE", keywords="starbucks, cà phê, bữa trưa")
    db.add_all([account, category]); db.commit()
    suggestion = client.post(
        "/api/v1/categories/suggest",
        headers=headers(user_token),
        json={"type": "EXPENSE", "description": "Thanh toán Starbucks Nguyễn Huệ"},
    )
    assert suggestion.status_code == 200, suggestion.text
    assert suggestion.json()["category_id"] == str(category.id)
    assert suggestion.json()["auto_apply"] is True

    created = client.post(
        "/api/v1/transactions",
        headers=headers(user_token),
        json={
            "account_id": str(account.id), "amount": 65000, "type": "EXPENSE",
            "transaction_date": "2026-09-17", "description": "Thanh toán Starbucks Nguyễn Huệ",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["category_id"] == str(category.id)
    assert body["category_was_auto"] is True
    assert body["category_source"] == "CATEGORY_KEYWORD"
    assert float(body["category_confidence"]) >= 0.9


def test_user_history_learns_from_manual_category_correction(client, db, test_user, user_token):
    account = Account(user_id=test_user.id, name="Ví học", account_type="CASH", balance=500000, currency="VND")
    category = Category(owner_user_id=test_user.id, name="Cửa hàng quen", type="EXPENSE")
    db.add_all([account, category]); db.commit()
    payload = {
        "account_id": str(account.id), "category_id": str(category.id), "amount": 20000,
        "type": "EXPENSE", "transaction_date": "2026-09-17", "description": "Quầy ABC số 12",
    }
    assert client.post("/api/v1/transactions", headers=headers(user_token), json=payload).status_code == 201
    learned = client.post(
        "/api/v1/categories/suggest",
        headers=headers(user_token),
        json={"type": "EXPENSE", "description": "QUẦY ABC SỐ 12"},
    )
    assert learned.status_code == 200
    assert learned.json()["category_id"] == str(category.id)
    assert learned.json()["source"] == "USER_HISTORY"
    assert learned.json()["auto_apply"] is True


def test_unknown_description_remains_uncategorized(client, db, test_user, user_token):
    account = Account(user_id=test_user.id, name="Ví chưa rõ", account_type="CASH", balance=500000, currency="VND")
    db.add(account); db.commit()
    created = client.post(
        "/api/v1/transactions",
        headers=headers(user_token),
        json={
            "account_id": str(account.id), "amount": 10000, "type": "EXPENSE",
            "transaction_date": "2026-09-17", "description": "ZXQ-991 không xác định",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["category_id"] is None
    assert created.json()["category_was_auto"] is False
