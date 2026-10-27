"""Analytics API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.analytics_service import (
    get_dashboard_summary,
    get_daily_study_hours,
    get_subject_distribution,
    get_quiz_score_trend,
    get_topic_mastery_data,
    get_study_heatmap,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_dashboard_summary(db, current_user.id)


@router.get("/daily-hours")
async def daily_hours(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_daily_study_hours(db, current_user.id, days)


@router.get("/subject-distribution")
async def subject_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_subject_distribution(db, current_user.id)


@router.get("/quiz-trend")
async def quiz_trend(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_quiz_score_trend(db, current_user.id, limit)


@router.get("/topic-mastery")
async def topic_mastery(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_topic_mastery_data(db, current_user.id)


@router.get("/heatmap")
async def heatmap(
    weeks: int = Query(default=12, ge=1, le=52),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_study_heatmap(db, current_user.id, weeks)
