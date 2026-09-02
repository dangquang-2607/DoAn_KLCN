import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_, case
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cats = db.scalars(
        select(Category)
        .where(or_(Category.owner_user_id == user.id, Category.owner_user_id.is_(None)))
        .where(Category.is_active == True)
        .order_by(
            case((Category.owner_user_id.is_(None), 1), else_=0).desc(),
            Category.sort_order.asc()
        )
    ).all()
    return cats

@router.post("", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = Category(owner_user_id=user.id, **payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
