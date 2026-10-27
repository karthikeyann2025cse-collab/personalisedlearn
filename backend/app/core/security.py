from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.db.session import get_db

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode("utf-8")[:72]
    hashed_bytes = hashed.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """FastAPI dependency — returns the authenticated user or raises 401."""
    from app.db import crud
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exc
    user = await crud.get_user_by_id(db, int(user_id))
    if user is None:
        raise credentials_exc
    return user
