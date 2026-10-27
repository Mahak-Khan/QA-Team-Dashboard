
from getpass import getpass

from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def main():
    name = input("Manager name: ").strip()
    email = input("Manager email: ").strip().lower()
    password = getpass("Manager password (minimum 12 characters): ")

    if not name or not email:
        print("Name and email are required.")
        return

    if len(password) < 12:
        print("Password must be at least 12 characters.")
        return

    db = SessionLocal()

    try:
        existing_user = db.query(User).filter(
            User.email == email
        ).first()

        if existing_user:
            print("This email already exists.")
            return

        manager = User(
            name=name,
            email=email,
            password_hash=get_password_hash(password),
            role="manager",
            is_active=True
        )

        db.add(manager)
        db.commit()

        print("Manager account created successfully.")

    except Exception as error:
        db.rollback()
        print(f"Could not create manager: {error}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
