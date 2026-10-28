
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse
from app.core.security import verify_password, create_access_token
from app.services.activity_service import record_activity

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == payload.email
    ).first()

    if not user or not verify_password(
        payload.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    if user.role not in ["manager", "tester"]:
        raise HTTPException(
            status_code=403,
            detail="Invalid user role"
        )

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role
    })

    # Record login activity
    record_activity(
        db=db,
        user_id=user.id,
        action_type="session_login",
        title=f"User logged in ({user.role.title()})",
        description=f"Active session initiated from dashboard",
    )
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role
    }
