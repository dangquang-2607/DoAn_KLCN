"""Public fictional bank accounts for wallet linking, without transaction history."""
from dataclasses import dataclass

from .number_rules import validate_account_number


@dataclass(frozen=True)
class DemoAccount:
    id: str
    provider: str
    number: str


DEMO_ACCOUNTS = {
    "VCB": DemoAccount("vcb", "VCB", "1023456789"),
    "ACB": DemoAccount("acb", "ACB", "123456789"),
    "MB": DemoAccount("mb", "MB", "123456789012"),
    "TCB": DemoAccount("tcb", "TCB", "19012345678901"),
}


def find_demo(provider: str | None, number: str | None) -> DemoAccount:
    validate_account_number(provider, number)
    account = DEMO_ACCOUNTS.get(provider or "")
    if account is None or account.number != number:
        raise ValueError("Không tìm thấy tài khoản trong ngân hàng mô phỏng. Hãy dùng số mẫu được hướng dẫn.")
    return account
