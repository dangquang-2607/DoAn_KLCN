"""Deterministic, privacy-preserving transaction category classifier."""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.category import Category, CategoryType
from app.models.transaction import Transaction


AUTO_CATEGORY_THRESHOLD = Decimal("0.9000")
MAX_HISTORY_ROWS = 500


@dataclass(frozen=True)
class CategorySuggestion:
    category_id: UUID | None = None
    category_name: str | None = None
    icon: str | None = None
    color: str | None = None
    confidence: Decimal = Decimal("0")
    source: str = "NONE"
    reason: str = "Không đủ dữ liệu để gợi ý danh mục"

    @property
    def auto_apply(self) -> bool:
        return self.category_id is not None and self.confidence >= AUTO_CATEGORY_THRESHOLD

    def as_dict(self) -> dict:
        return {
            "category_id": self.category_id,
            "category_name": self.category_name,
            "icon": self.icon,
            "color": self.color,
            "confidence": float(self.confidence),
            "source": self.source,
            "auto_apply": self.auto_apply,
            "reason": self.reason,
        }


def normalize_classification_text(value: str | None) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value.casefold())
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.replace("đ", "d")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def _suggestion(category: Category, confidence: Decimal, source: str, reason: str) -> CategorySuggestion:
    return CategorySuggestion(
        category_id=category.id,
        category_name=category.name,
        icon=category.icon,
        color=category.color,
        confidence=confidence.quantize(Decimal("0.0001")),
        source=source,
        reason=reason,
    )


def suggest_category(
    db: Session,
    user_id: UUID,
    tx_type: CategoryType | str,
    description: str = "",
    note: str | None = None,
    item_names: list[str] | None = None,
) -> CategorySuggestion:
    """Suggest from the user's confirmed history, then configured category keywords."""
    type_value = tx_type.value if hasattr(tx_type, "value") else str(tx_type)
    description_key = normalize_classification_text(description)
    combined = normalize_classification_text(" ".join([description, note or "", *(item_names or [])]))
    if not combined:
        return CategorySuggestion()

    categories = db.scalars(
        select(Category).where(
            Category.type == type_value,
            Category.is_active == True,
            or_(Category.owner_user_id == user_id, Category.owner_user_id.is_(None)),
        )
    ).all()
    by_id = {category.id: category for category in categories}
    if not by_id:
        return CategorySuggestion(reason="Chưa có danh mục đang hoạt động phù hợp")

    if description_key:
        history = db.execute(
            select(Transaction.category_id, Transaction.description)
            .where(
                Transaction.user_id == user_id,
                Transaction.type == type_value,
                Transaction.kind == "NORMAL",
                Transaction.category_id.is_not(None),
            )
            .order_by(Transaction.created_at.desc())
            .limit(MAX_HISTORY_ROWS)
        ).all()
        exact = Counter(
            category_id
            for category_id, prior_description in history
            if category_id in by_id and normalize_classification_text(prior_description) == description_key
        )
        if exact:
            winner_id, winner_count = exact.most_common(1)[0]
            total = sum(exact.values())
            ratio = Decimal(winner_count) / Decimal(total)
            confidence = min(Decimal("0.9900"), Decimal("0.9400") + Decimal(min(winner_count, 5)) * Decimal("0.0100")) * ratio
            if ratio >= Decimal("0.75"):
                return _suggestion(
                    by_id[winner_id], confidence, "USER_HISTORY",
                    f"Khớp {winner_count}/{total} giao dịch tương tự đã được bạn phân loại",
                )

    scored: list[tuple[int, int, Category, str]] = []
    padded_text = f" {combined} "
    for category in categories:
        phrases = [part.strip() for part in re.split(r"[,;\n]+", category.keywords or "") if part.strip()]
        phrases.append(category.name)
        best_score = 0
        best_phrase = ""
        for phrase in phrases:
            normalized_phrase = normalize_classification_text(phrase)
            if len(normalized_phrase) < 2:
                continue
            if f" {normalized_phrase} " in padded_text:
                score = len(normalized_phrase.split()) * 10 + len(normalized_phrase)
                if score > best_score:
                    best_score, best_phrase = score, phrase
        if best_score:
            scored.append((best_score, 1 if category.owner_user_id == user_id else 0, category, best_phrase))

    if not scored:
        return CategorySuggestion()
    scored.sort(key=lambda row: (row[0], row[1], -row[2].sort_order), reverse=True)
    best_score, _, category, phrase = scored[0]
    runner_score = scored[1][0] if len(scored) > 1 else 0
    margin = best_score - runner_score
    is_configured_keyword = normalize_classification_text(phrase) != normalize_classification_text(category.name)
    if is_configured_keyword and margin >= 5:
        confidence = Decimal("0.9300")
    elif is_configured_keyword:
        confidence = Decimal("0.8600")
    else:
        confidence = Decimal("0.8200")
    return _suggestion(
        category, confidence, "CATEGORY_KEYWORD",
        f"Khớp từ khóa “{phrase}” của danh mục {category.name}",
    )
