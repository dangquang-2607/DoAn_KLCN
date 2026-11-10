"""Supported demo account formats, not bank ownership/existence verification.

Deliberately supports a bounded set of common formats, not every custom account
or alias offered by providers. UI reads these rules from /accounts/number-rules.
"""
from typing import TypedDict


class NumberRule(TypedDict):
    name: str
    lengths: list[int]
    pattern: str
    label: str
    hint: str
    max_length: int


def _bank(name: str, lengths: list[int]) -> NumberRule:
    readable = ", ".join(str(n) for n in lengths[:-1]) + " hoặc " + str(lengths[-1])
    return {
        "name": name, "lengths": lengths,
        "pattern": "(?:" + "|".join("[0-9]{%d}" % n for n in lengths) + ")",
        "label": "Số tài khoản ngân hàng",
        "hint": f"{name}: nhập {readable} chữ số. Không nhập số in trên thẻ.",
        "max_length": max(lengths),
    }


NUMBER_RULES: dict[str, NumberRule] = {
    "VCB": _bank("Vietcombank", [10, 13]),
    "ACB": _bank("ACB", [8, 9]),
    "MB": _bank("MB Bank", [9, 10, 12, 13]),
    "TCB": _bank("Techcombank", [10, 12, 14]),
    "MOMO": {
        "name": "MoMo", "lengths": [10], "pattern": "0[35789][0-9]{8}",
        "label": "Số điện thoại đăng ký MoMo",
        "hint": "MoMo: nhập 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.",
        "max_length": 10,
    },
}


def mask_account_number(number: str | None) -> str | None:
    return "*" * (len(number) - 3) + number[-3:] if number is not None else None
