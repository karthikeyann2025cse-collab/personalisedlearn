"""Profile and preferences API."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import crud
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    learning_goals: Optional[str] = None
    preferred_language: Optional[str] = None
    subjects: Optional[List[str]] = None
    daily_study_minutes: Optional[int] = None
    preferred_formats: Optional[List[str]] = None
    timezone: Optional[str] = None
    onboarding_complete: Optional[bool] = None


@router.get("/")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.db.models import UserProfile
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "learning_goals": profile.learning_goals if profile else None,
        "preferred_language": profile.preferred_language if profile else "English",
        "subjects": profile.subjects if profile else [],
        "daily_study_minutes": profile.daily_study_minutes if profile else 60,
        "preferred_formats": profile.preferred_formats if profile else [],
        "onboarding_complete": profile.onboarding_complete if profile else False,
        "timezone": profile.timezone if profile else "UTC",
    }


@router.patch("/")
async def update_profile(
    req: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.full_name is not None:
        current_user.full_name = req.full_name

    profile_updates = req.model_dump(exclude_none=True, exclude={"full_name"})
    if profile_updates:
        await crud.update_user_profile(db, current_user.id, **profile_updates)

    return {"message": "Profile updated successfully"}
