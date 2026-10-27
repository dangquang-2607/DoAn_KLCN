"""Legacy bank-sync fixture reader; not used by independent wallets."""
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from .demo_catalog import DEMO_ACCOUNTS

DATA_PATH = Path(__file__).with_name("demo_bank_data.json")
MAX_MONEY = Decimal("99999999999999999.99")


class SourceUnavailable(ConnectionError):
    """File/provider failure that must preserve the last successful snapshot."""


class SourceEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,60}$")
    date: date
    amount: Decimal = Field(max_digits=19, decimal_places=2)
    description: str = Field(min_length=1, max_length=255)
    status: Literal["BOOKED", "PENDING"]

    @field_validator("date", mode="before")
    @classmethod
    def iso_date(cls, value):
        if not isinstance(value, str) or len(value) != 10 or date.fromisoformat(value).isoformat() != value:
            raise ValueError("Use YYYY-MM-DD dates")
        return value

    @field_validator("amount", mode="before")
    @classmethod
    def decimal_string(cls, value):
        if not isinstance(value, str):
            raise ValueError("Money must be a decimal string")
        return value

    @field_validator("amount")
    @classmethod
    def nonzero(cls, value: Decimal) -> Decimal:
        if not value.is_finite() or value == 0:
            raise ValueError("Transaction amount must be finite and nonzero")
        return value


class SourceAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    opening_balance: Decimal = Field(max_digits=19, decimal_places=2)
    events: list[SourceEvent]

    @field_validator("opening_balance", mode="before")
    @classmethod
    def decimal_string(cls, value):
        if not isinstance(value, str):
            raise ValueError("Money must be a decimal string")
        return value

    @model_validator(mode="after")
    def valid_ledger(self):
        if len({event.id for event in self.events}) != len(self.events):
            raise ValueError("Duplicate transaction ID")
        if not self.opening_balance.is_finite() or abs(self.balance) > MAX_MONEY:
            raise ValueError("Balance exceeds storage precision")
        return self

    @property
    def balance(self) -> Decimal:
        return self.opening_balance + sum((e.amount for e in self.events if e.status == "BOOKED"), Decimal(0))


class SourceFile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1]
    accounts: dict[str, SourceAccount]

    @model_validator(mode="after")
    def providers_match(self):
        if set(self.accounts) != set(DEMO_ACCOUNTS):
            raise ValueError("Expected all five supported providers")
        return self


def unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def read_source(provider: str) -> SourceAccount:
    try:
        raw = DATA_PATH.read_bytes()
        if len(raw) > 5_000_000:
            raise ValueError("Source file too large")
        data = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=unique_keys)
        return SourceFile.model_validate(data).accounts[provider]
    except (OSError, ValueError, KeyError, ValidationError) as exc:
        raise SourceUnavailable("Không đọc được demo_bank_data.json. Kiểm tra cú pháp, ngân hàng, mã giao dịch, ngày và số tiền.") from exc
