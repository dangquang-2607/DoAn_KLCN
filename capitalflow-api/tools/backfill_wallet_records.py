"""Add historical wallet movements to bookkeeping without changing money.

Run after deploying the wallet history update:
  .venv/Scripts/python.exe tools/backfill_wallet_records.py
The unique wallet-entry relationship and transaction locks make reruns safe.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app.dung_chung.database.dang_ky_mo_hinh
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.wallet_records import backfill_wallet_records

if __name__ == '__main__':
    engine = create_engine(settings.database_url, hide_parameters=True)
    with Session(engine) as db:
        with db.begin():
            count = backfill_wallet_records(db)
    print(f'Added {count} wallet history records. Wallet and bank balances unchanged.')
