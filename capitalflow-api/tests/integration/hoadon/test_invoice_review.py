"""Kiểm thử metadata duyệt hóa đơn và khả năng sửa dòng hàng OCR."""
from decimal import Decimal

from app.modules.hoadon.persistence.invoice import Invoice
from app.modules.hoadon.persistence.invoice_item import InvoiceItem
from app.modules.jobs.runner import validated_amount


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_quantity_parser_preserves_fractional_kilograms():
    assert validated_amount("0.215", quantity=True) == Decimal("0.2150")
    assert validated_amount("1,365", quantity=True) == Decimal("1.3650")


def test_user_can_replace_own_ocr_items(client, db, test_user, user_token):
    invoice = Invoice(user_id=test_user.id, status="REVIEW_REQUIRED", currency="VND")
    db.add(invoice)
    db.flush()
    db.add(InvoiceItem(invoice_id=invoice.id, line_no=1, name="Giò lụa", quantity=215))
    db.commit()

    response = client.put(
        f"/api/v1/invoices/{invoice.id}/items",
        headers=auth(user_token),
        json={
            "items": [{
                "name": "Giò lụa lợn quế",
                "unit": "Kg",
                "quantity": "0.215",
                "unit_price": "229000",
                "line_total": "49235",
            }]
        },
    )

    assert response.status_code == 200
    assert response.json()[0]["name"] == "Giò lụa lợn quế"
    assert response.json()[0]["unit"] == "Kg"
    assert Decimal(response.json()[0]["quantity"]) == Decimal("0.2150")
    stored = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).one()
    assert stored.name == "Giò lụa lợn quế" and stored.unit == "Kg"


def test_confirmed_invoice_items_are_immutable(client, db, test_user, user_token):
    invoice = Invoice(user_id=test_user.id, status="CONFIRMED", currency="VND")
    db.add(invoice)
    db.commit()

    response = client.put(
        f"/api/v1/invoices/{invoice.id}/items",
        headers=auth(user_token),
        json={"items": [{"name": "Không được sửa"}]},
    )
    assert response.status_code == 409
