"""Archived bank-sync catalogue, including the old MoMo account fixture."""
from dataclasses import dataclass

from ..number_rules import validate_account_number


@dataclass(frozen=True)
class DemoAccount:
    id: str
    provider: str
    number: str

    @property
    def aliases(self) -> set[str]:
        # Keep IDs already persisted by the earlier version; never rewrite bank references.
        return {self.id, self.provider.lower() + "-demo"}


DEMO_ACCOUNTS = {
    "VCB": DemoAccount("vcb", "VCB", "1023456789"),
    "ACB": DemoAccount("acb", "ACB", "123456789"),
    "MB": DemoAccount("mb", "MB", "123456789012"),
    "TCB": DemoAccount("tcb", "TCB", "19012345678901"),
    "MOMO": DemoAccount("momo", "MOMO", "0987654321"),
}


def find_demo(provider: str | None, number: str | None) -> DemoAccount:
    validate_account_number(provider, number)
    account = DEMO_ACCOUNTS.get(provider or "")
    if account is None or account.number != number:
        raise ValueError("Không tìm thấy tài khoản trong ngân hàng mô phỏng. Hãy dùng số mẫu được hướng dẫn.")
    return account
