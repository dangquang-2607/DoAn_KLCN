# Financial integrity and authentication update

## Deployment

Run from `capitalflow-api` using its virtual environment. Deploy the backend and user-web together: Create/Update transaction requests now require a **positive amount**; response amounts retain their accounting sign.

1. `python -m scripts.migrate_financial_integrity` validates all migration batches in SQL Server and rolls back.
2. `python -m scripts.migrate_financial_integrity --apply` commits the migration once. Later runs return `already_applied`.
3. Restart the backend process if it does not reload code automatically.
4. `python -m scripts.verify_financial_integrity` exercises the money services and SQL reports using synthetic rows inside an outer transaction. All synthetic rows are rolled back.
5. `python -m pytest -q` runs the offline automated suite.

The migration was applied to the configured project database on 2026-09-10 after successful rollback validation. Its migration version is `20260910_financial_integrity`. It takes exclusive table locks while applying schema and baseline changes; schedule deployment accordingly on other environments.

## Money contract

- Transactions carry `kind=NORMAL|TRANSFER|ADJUSTMENT`.
- Transfers retain signed INCOME/EXPENSE legs linked by a full `transfer_id`. Each leg is protected from generic PATCH/DELETE. To correct a transfer, record a new transfer in the opposite direction; the original history remains.
- Opening balances and subsequent balance edits create immutable ADJUSTMENT entries in the same database transaction. Notes record the before/after balance.
- Dashboard, analytics, category spending, budget progress and budget alerts count only NORMAL transactions. SQL views use the same rule.
- Create/Update accept strictly positive amounts with at most two decimal places; the service assigns the stored sign. Clients cannot create SYSTEM/OCR entries through the manual endpoint.
- Money operations roll back on failure, lock affected rows and preserve intermediate balance changes before a second locked read.

## Existing data

Historic transfer pairs can be linked only when the stored reference identifies exactly two balanced legs belonging to different wallets of the same user on the same date. Ambiguous/incomplete pairs abort the migration. Zero-amount transactions and non-VND budgets also abort it rather than silently changing their meaning.

The migration preserves wallet balances. Where historic transaction totals do not explain a wallet balance, it adds an explicitly labeled opening reconciliation baseline. This establishes a starting point; it does not reconstruct missing historical adjustments or prove that an old balance was correct.

## Authentication and email

- Register passwords use the same minimum length as password reset/change (6), with a maximum of 128 characters. The register endpoint allows 5 requests/minute and 20/hour per client IP, including attempts using existing emails.
- The current SlowAPI storage is per-process memory. Multiple workers/instances require shared rate-limit storage and trusted proxy configuration before scaling; restarting a process resets its counters.
- JWTs must contain `sub`, `exp`, `type=access` and integer `ver`. User token versions invalidate old access tokens after ban/unban. Existing access tokens without the new claims must refresh or sign in again.
- Single/bulk ban revokes refresh tokens and increments the user token version. Refresh and ban lock the user row to serialize their updates.
- User-controlled text is HTML-escaped in email templates. Automated tests replace delivery, so no real email is sent.

## Categories and constraints

- `PATCH /api/v1/categories/{id}` edits an owned custom category. A type change is rejected once the category is referenced by a transaction, invoice or budget.
- `DELETE /api/v1/categories/{id}` deactivates it; financial history retains its references. Global categories and another user's categories cannot be edited through these endpoints.
- Category and budget filtered unique indexes are represented in ORM metadata and the SQL Server migration. Duplicate creates return 409; invalid budget currency/date/ownership returns 422.
- The user portal includes edit/hide controls for custom categories. Authentication pages were preserved.

## Tests

The automatic suite lives under `tests/`. Earlier interactive scripts were moved to `scripts/manual/`; they are not pytest tests and should only be run deliberately against a disposable environment. They are retained for reference and are not evidence of automated coverage.

SQLite integration tests cover API lifecycle, transfer integrity, adjustments, report exclusion, actual/false budget alerts, registration limits, JWT validation, refresh rotation, ban/unban, category ownership/history, and constraints. MSSQL compilation tests check filtered index predicates. The rollback verifier additionally exercises the deployed SQL Server schema and views; SQLite alone does not validate SQL Server locking behavior.
