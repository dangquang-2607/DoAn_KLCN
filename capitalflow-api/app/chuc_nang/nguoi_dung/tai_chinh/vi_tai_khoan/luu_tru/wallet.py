"""Independent demo wallets. Their money ledger never feeds personal income/expense."""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Uuid, Unicode, String, Numeric, DateTime, Boolean, ForeignKey, CheckConstraint, UniqueConstraint, Index, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base
from ..wallet_codes import new_wallet_code


class Wallet(Base):
    __tablename__ = 'wallets'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'), nullable=False)
    name: Mapped[str] = mapped_column(Unicode(150), nullable=False)
    short_code: Mapped[str] = mapped_column(String(11), nullable=False, default=new_wallet_code)
    balance: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False, default=0, server_default='0')
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default='1')
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default='0')
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    __table_args__ = (CheckConstraint('balance >= 0', name='CK_wallets_balance'),
                     UniqueConstraint('short_code', name='UQ_wallets_short_code'),
                     CheckConstraint('is_default = 0 OR is_active = 1', name='CK_default_wallet_active'),
                     Index('UX_wallets_default_owner', 'user_id', unique=True, mssql_where=text('is_default = 1')),
                     Index('IX_wallets_owner', 'user_id', 'is_active'))


class DemoBankBalance(Base):
    __tablename__ = 'wallet_demo_banks'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    account_number_masked: Mapped[str] = mapped_column(String(20), nullable=False)
    account_number: Mapped[str] = mapped_column(String(20), nullable=False)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'provider', name='UQ_wallet_bank_owner_provider'),
                     UniqueConstraint('provider', 'account_number', name='UQ_demo_bank_number'),
                     CheckConstraint('balance >= 0', name='CK_wallet_bank_balance'))


class UserBankLink(Base):
    __tablename__ = 'user_bank_links'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'), nullable=False)
    bank_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('wallet_demo_banks.id'), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'bank_id', name='UQ_user_bank_link'),)


class WalletEntry(Base):
    __tablename__ = 'wallet_entries'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    operation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    wallet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('wallets.id'), nullable=False)
    bank_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('wallet_demo_banks.id'), nullable=True)
    counterparty_wallet_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('wallets.id'), nullable=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    merchant_name: Mapped[str | None] = mapped_column(Unicode(150), nullable=True)
    bill_reference: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    __table_args__ = (
        UniqueConstraint('operation_id', 'wallet_id', name='UQ_wallet_operation_leg'),
        CheckConstraint("(kind IN ('TOPUP','TRANSFER_IN') AND amount > 0) OR (kind IN ('WITHDRAW','TRANSFER_OUT','PAYMENT') AND amount < 0)", name='CK_wallet_entry_sign'),
        CheckConstraint("(kind IN ('TOPUP','WITHDRAW') AND bank_id IS NOT NULL AND counterparty_wallet_id IS NULL) OR (kind IN ('TRANSFER_IN','TRANSFER_OUT') AND bank_id IS NULL AND counterparty_wallet_id IS NOT NULL) OR (kind = 'PAYMENT' AND bank_id IS NULL AND counterparty_wallet_id IS NULL)", name='CK_wallet_entry_counterparty'),
        Index('IX_wallet_entries_history', 'wallet_id', 'created_at', 'id'),
    )
