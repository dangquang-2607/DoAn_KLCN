"""Kiểm tra schema Unicode và vòng ghi/đọc ORM trên SQL Server.

Vai trò: xác minh kiểu cột cùng khả năng lưu/đọc tiếng Việt và emoji xuyên ORM.
Đầu vào: SQL Server kiểm thử và metadata model hiện tại.
Đầu ra/side effect: dữ liệu probe tạm cùng kết quả PASS/assertion.
Ràng buộc an toàn: transaction ngoài luôn rollback, không giữ bản ghi probe.
"""
import json
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "capitalflow-api"))
from sqlalchemy import select, text, Unicode, UnicodeText
from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.base import Base
from app.models.account import Account
from app.models.category import Category
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.ocr_job import OcrJob
from app.models.user import User
import app.models


def verify():
    with engine.connect() as conn:
        # Trước tiên đối chiếu mọi cột Unicode trong ORM với kiểu nvarchar/ntext/nchar
        # thực tế để phát hiện schema drift trước khi thử ghi dữ liệu tiếng Việt.
        actual = {(t,c):ty for t,c,ty in conn.execute(text("SELECT t.name,c.name,ty.name FROM sys.columns c JOIN sys.tables t ON c.object_id=t.object_id JOIN sys.types ty ON c.user_type_id=ty.user_type_id"))}
        for table in Base.metadata.tables.values():
            for column in table.columns:
                if isinstance(column.type,(Unicode,UnicodeText)):
                    assert actual.get((table.name,column.name)) in {'nvarchar','ntext','nchar'}, (table.name,column.name)
        conn.rollback()
        # Probe tạo một chuỗi quan hệ user-category-account-invoice-item-OCR đầy đủ,
        # đọc lại tiếng Việt/emoji qua ORM rồi luôn rollback transaction bên ngoài.
        outer=conn.begin()
        try:
            with Session(bind=conn,join_transaction_mode='rollback_only') as db:
                suffix=uuid4().hex[:8]
                user=User(email=f'unicode-{suffix}@example.invalid',full_name='Nguyễn Ánh Dương',password_hash='probe',role='USER')
                db.add(user);db.flush()
                category_name='Bảo hiểm Ăn uống Đầu tư '+suffix
                category=Category(owner_user_id=user.id,name=category_name,type='EXPENSE',icon='🛡️')
                account=Account(user_id=user.id,name='Tiết kiệm Ngân hàng Á Châu',account_type='SAVINGS',institution_name='Ngân hàng Á Châu',color='cobalt')
                db.add_all((category,account));db.flush()
                result={'ten_nguoi_ban':'Cửa hàng Phúc Long','items':[{'ten_hang':'Bánh Mì Thập Cẩm','don_vi':'phần'}]}
                result_json=json.dumps(result,ensure_ascii=False)
                invoice=Invoice(user_id=user.id,account_id=account.id,category_id=category.id,status='REVIEW_REQUIRED',merchant_name=result['ten_nguoi_ban'],extracted_json=result_json)
                db.add(invoice);db.flush()
                item=InvoiceItem(invoice_id=invoice.id,line_no=1,name=result['items'][0]['ten_hang'],unit='phần')
                ocr=OcrJob(user_id=user.id,invoice_id=invoice.id,status='COMPLETED',response_json=result_json)
                db.add_all((item,ocr));db.flush()
                ids=(category.id,account.id,invoice.id,item.id,ocr.id)
                db.expire_all()
                loaded_category = db.get(Category, category.id)
                loaded_account = db.get(Account, account.id)
                loaded_invoice = db.get(Invoice, invoice.id)
                loaded_item = db.get(InvoiceItem, item.id)
                loaded_ocr = db.get(OcrJob, ocr.id)
                assert all(value is not None for value in (
                    loaded_category, loaded_account, loaded_invoice, loaded_item, loaded_ocr
                ))
                assert loaded_category is not None and loaded_account is not None
                assert loaded_invoice is not None and loaded_item is not None and loaded_ocr is not None
                assert loaded_category.name==category_name and loaded_category.icon=='🛡️'
                assert loaded_account.name=='Tiết kiệm Ngân hàng Á Châu' and loaded_account.color=='cobalt'
                assert loaded_invoice.extracted_json is not None
                assert loaded_invoice.merchant_name=='Cửa hàng Phúc Long' and json.loads(loaded_invoice.extracted_json)==result
                assert loaded_item.name=='Bánh Mì Thập Cẩm' and loaded_item.unit=='phần'
                assert loaded_ocr.response_json is not None
                assert json.loads(loaded_ocr.response_json)==result
        finally:outer.rollback()
    print('SQL Server Unicode schema + ORM Vietnamese/emoji round-trip: PASS; probe rolled back.')


if __name__=='__main__':verify()
