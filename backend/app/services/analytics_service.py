"""
Analytics Service
- Aggregates study session data from the database
- Computes daily/weekly/monthly trends
- Returns dashboard summary stats
- All data is sourced from DB records, not hardcoded
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import StudySession, QuizAttempt, TopicMastery, SessionStatus


async def get_dashboard_summary(db: AsyncSession, user_id: int) -> dict:
    """Return key metrics for the analytics dashboard."""
    # Total study seconds
    total_sec_result = await db.execute(
        select(func.sum(StudySession.duration_seconds)).where(StudySession.user_id == user_id)
    )
    total_seconds = total_sec_result.scalar_one_or_none() or 0

    # Session count
    session_count_result = await db.execute(
        select(func.count(StudySession.id)).where(
            StudySession.user_id == user_id,
            StudySession.status == SessionStatus.completed,
        )
    )
    session_count = session_count_result.scalar_one_or_none() or 0

    # Quiz accuracy (average score_percent across all attempts)
    quiz_result = await db.execute(
        select(func.avg(QuizAttempt.score_percent)).where(QuizAttempt.user_id == user_id)
    )
    avg_quiz_score = round(float(quiz_result.scalar_one_or_none() or 0), 1)

    # Mastered topics count
    mastery_result = await db.execute(
        select(func.count(TopicMastery.id)).where(
            TopicMastery.user_id == user_id,
            TopicMastery.mastery_score >= 0.8,
        )
    )
    mastered_topics = mastery_result.scalar_one_or_none() or 0

    # 7-day study hours
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_result = await db.execute(
        select(func.sum(StudySession.duration_seconds)).where(
            StudySession.user_id == user_id,
            StudySession.start_time >= week_ago,
        )
    )
    week_seconds = week_result.scalar_one_or_none() or 0

    # Today's study hours
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_result = await db.execute(
        select(func.sum(StudySession.duration_seconds)).where(
            StudySession.user_id == user_id,
            StudySession.start_time >= today_start,
        )
    )
    today_seconds = today_result.scalar_one_or_none() or 0

    return {
        "total_study_hours": round(total_seconds / 3600, 1),
        "weekly_study_hours": round(week_seconds / 3600, 1),
        "today_study_hours": round(today_seconds / 3600, 1),
        "completed_sessions": session_count,
        "average_quiz_score": avg_quiz_score,
        "mastered_topics": mastered_topics,
        "daily_average_minutes": round((total_seconds / 60) / max(session_count, 1), 0),
    }


async def get_daily_study_hours(
    db: AsyncSession, user_id: int, days: int = 30
) -> List[dict]:
    """Return daily study hours for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(StudySession).where(
            StudySession.user_id == user_id,
            StudySession.start_time >= since,
        ).order_by(StudySession.start_time)
    )
    sessions = result.scalars().all()

    # Aggregate by date
    daily: Dict[str, float] = {}
    for s in sessions:
        date_key = s.start_time.strftime("%Y-%m-%d")
        daily[date_key] = daily.get(date_key, 0) + s.duration_seconds

    # Fill in zero days
    output = []
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        output.append({"date": d, "hours": round(daily.get(d, 0) / 3600, 2)})
    return output


async def get_subject_distribution(
    db: AsyncSession, user_id: int
) -> List[dict]:
    """Return subject-wise study time in hours."""
    result = await db.execute(
        select(
            StudySession.subject,
            func.sum(StudySession.duration_seconds).label("total_seconds")
        ).where(StudySession.user_id == user_id)
        .group_by(StudySession.subject)
    )
    rows = result.all()
    return [
        {"subject": r.subject or "Unspecified", "hours": round(r.total_seconds / 3600, 2)}
        for r in rows
    ]


async def get_quiz_score_trend(
    db: AsyncSession, user_id: int, limit: int = 20
) -> List[dict]:
    """Return recent quiz attempts with score for trend graph."""
    result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.started_at.desc()).limit(limit)
    )
    attempts = result.scalars().all()
    return [
        {
            "date": a.started_at.strftime("%Y-%m-%d"),
            "score": a.score_percent,
            "topic": a.topic_name or "General",
            "questions": a.total_questions,
        }
        for a in reversed(attempts)
    ]


async def get_topic_mastery_data(
    db: AsyncSession, user_id: int
) -> List[dict]:
    """Return topic mastery scores for heatmap/bar chart."""
    result = await db.execute(
        select(TopicMastery).where(TopicMastery.user_id == user_id)
        .order_by(TopicMastery.mastery_score.desc())
    )
    masteries = result.scalars().all()
    return [
        {
            "topic": m.topic_name,
            "mastery_score": round(m.mastery_score * 100, 1),
            "mastery_level": m.mastery_level.value,
            "quiz_accuracy": round(m.quiz_accuracy * 100, 1),
            "attempts": m.attempts,
        }
        for m in masteries
    ]


async def get_study_heatmap(
    db: AsyncSession, user_id: int, weeks: int = 12
) -> List[dict]:
    """Return a list of {date, duration_minutes} for the heatmap."""
    since = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    result = await db.execute(
        select(StudySession).where(
            StudySession.user_id == user_id,
            StudySession.start_time >= since,
        )
    )
    sessions = result.scalars().all()

    daily: Dict[str, int] = {}
    for s in sessions:
        date_key = s.start_time.strftime("%Y-%m-%d")
        daily[date_key] = daily.get(date_key, 0) + s.duration_seconds

    return [
        {"date": d, "minutes": round(secs / 60)}
        for d, secs in sorted(daily.items())
    ]
