"""Private simulated bank identities; provisioning never resets available funds."""
import secrets
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .luu_tru.wallet import DemoBankBalance
from .number_rules import NUMBER_RULES, mask_account_number

DEMO_FUNDING_BALANCES = {'VCB': Decimal('25000000'), 'ACB': Decimal('10000000'),
                         'MB': Decimal('20000000'), 'TCB': Decimal('30000000')}


def provision(db, user):
    # Caller holds the user's update lock, including across concurrent GET requests.
    banks = {b.provider: b for b in db.scalars(select(DemoBankBalance).where(DemoBankBalance.user_id == user.id))}
    for provider, opening in DEMO_FUNDING_BALANCES.items():
        if provider in banks:
            continue
        length = max(NUMBER_RULES[provider]['lengths'])
        for attempt in range(10):
            number = str(secrets.randbelow(9 * 10 ** (length - 1)) + 10 ** (length - 1))
            try:
                with db.begin_nested():
                    bank = DemoBankBalance(user_id=user.id, provider=provider, account_number=number,
                        account_number_masked=mask_account_number(number), opening_balance=opening, balance=opening)
                    db.add(bank); db.flush()
                banks[provider] = bank
                break
            except IntegrityError as exc:
                if 'UQ_demo_bank_number' not in str(exc.orig):
                    raise
        else:
            raise HTTPException(503, 'Chưa cấp được tài khoản demo. Vui lòng thử lại.')
    return banks


def owned_bank(db, user, payload):
    bank = db.scalar(select(DemoBankBalance).where(DemoBankBalance.user_id == user.id,
        DemoBankBalance.provider == payload.provider, DemoBankBalance.account_number == payload.account_number))
    if bank is None:
        # Do not disclose whether an entered number belongs to another user.
        raise HTTPException(422, 'Chỉ được liên kết tài khoản ngân hàng demo được cấp riêng cho bạn.')
    return bank
