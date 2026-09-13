import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.user import User

def test():
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == "admin@capitalflow.vn"))
        if user:
            print(f"User found: {user.email}")
            print(f"Role: {user.role}")
            print(f"Type of Role: {type(user.role)}")
            if hasattr(user.role, 'value'):
                print(f"Role value: {user.role.value}")
        else:
            print("User not found.")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
