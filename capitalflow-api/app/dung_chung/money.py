"""VND presentation: dot grouping, no decimal places; never used for accounting."""
import re
from decimal import Decimal, ROUND_HALF_UP


def format_vnd(value: Decimal | str | int | float, *, signed: bool = False) -> str:
    amount = Decimal(str(value))
    if not amount.is_finite():
        raise ValueError('Số tiền phải hữu hạn')
    rounded = amount.to_integral_value(rounding=ROUND_HALF_UP)
    sign = '-' if rounded < 0 else '+' if signed else ''
    return f'{sign}{abs(rounded):,f}'.replace(',', '.') + ' ₫'


def format_percent(value: Decimal | str | int | float, places: int = 1) -> str:
    amount = Decimal(str(value))
    if not amount.is_finite():
        raise ValueError('Tỷ lệ phải hữu hạn')
    rounded = amount.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    return f'{rounded:.{places}f}'.replace('.', ',')


# Historical messages contain raw Decimal values or US-grouped numbers.
# Match the whole token: matching only the final 000 loses two zeroes on display.
_NUMBER = r'[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?'
_LEGACY_VND = re.compile(
    rf'(?<![\w.,+\-])({_NUMBER})(?:\s*(→|/)\s*({_NUMBER}))?\s*VND\b'
)


def normalize_money_message(message: str) -> str:
    """Format old notifications on read, preserving stored history and other text."""
    def replace(match: re.Match[str]) -> str:
        def money(raw: str) -> str:
            return format_vnd(raw.replace(',', ''), signed=raw.startswith('+'))
        first, separator, second = match.groups()
        return f'{money(first)} {separator} {money(second)}' if second else money(first)

    return _LEGACY_VND.sub(replace, message)
