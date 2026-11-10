"""Public receiving aliases; immutable UUIDs remain the ledger identity."""
import secrets
from sqlalchemy.exc import IntegrityError

CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'


def new_wallet_code():
    return 'CF-' + ''.join(secrets.choice(CODE_ALPHABET) for _ in range(8))


def insert_wallet(db, **values):
    from .luu_tru.wallet import Wallet
    # A unique constraint arbitrates collisions across users/concurrent requests.
    for _ in range(8):
        try:
            with db.begin_nested():
                wallet = Wallet(**values, short_code=new_wallet_code())
                db.add(wallet)
                db.flush()
            return wallet
        except IntegrityError as exc:
            if 'UQ_wallets_short_code' not in str(exc.orig):
                raise
    raise RuntimeError('Could not allocate a unique wallet receiving code')
