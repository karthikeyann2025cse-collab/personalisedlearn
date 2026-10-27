from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    hash_password, verify_password, create_access_token, get_current_user
)
from app.db.session import get_db
from app.db import crud
from app.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: str | None
    role: str

    class Config:
        from_attributes = True


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if await crud.get_user_by_email(db, req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await crud.get_user_by_username(db, req.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    user = await crud.create_user(
        db,
        email=req.email,
        username=req.username,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
    )
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    token = create_access_token(str(user.id))
    return {"access_token": token}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
