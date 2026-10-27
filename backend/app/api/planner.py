"""Study plan and roadmap API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import crud
from app.db.models import TaskStatus, User
from app.db.session import get_db
from app.services.planner_service import generate_study_plan, tasks_to_db

router = APIRouter(prefix="/planner", tags=["planner"])


class GeneratePlanRequest(BaseModel):
    upcoming_deadlines: Optional[List[dict]] = None


class TaskUpdateRequest(BaseModel):
    status: TaskStatus
    postpone_days: Optional[int] = None


@router.post("/generate")
async def generate_plan(
    req: GeneratePlanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a personalized 7-day study plan."""
    from sqlalchemy import select
    from app.db.models import UserProfile

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()

    masteries = await crud.list_masteries(db, current_user.id)
    docs = await crud.list_documents(db, current_user.id)

    mastery_dicts = [
        {"topic_name": m.topic_name, "mastery_score": m.mastery_score, "mastery_level": m.mastery_level.value}
        for m in masteries
    ]
    doc_dicts = [{"title": d.title, "id": d.id} for d in docs]

    plan_data = await generate_study_plan(
        user_name=current_user.full_name or current_user.username,
        learning_goals=profile.learning_goals if profile else "",
        daily_minutes=profile.daily_study_minutes if profile else 60,
        masteries=mastery_dicts,
        documents=doc_dicts,
        upcoming_deadlines=req.upcoming_deadlines,
    )

    # Deactivate old plans
    existing = await crud.get_active_plan(db, current_user.id)
    if existing:
        existing.is_active = False

    plan = await crud.create_study_plan(
        db,
        user_id=current_user.id,
        title=plan_data.get("title", "My Study Plan"),
        start_date=datetime.now(timezone.utc),
        is_active=True,
    )
    await db.flush()

    # Create tasks
    task_dicts = tasks_to_db(plan.id, plan_data.get("tasks", []), datetime.now(timezone.utc))
    from app.db.models import StudyTask
    db.add_all([StudyTask(**t) for t in task_dicts])

    return {"plan_id": plan.id, "title": plan.title, "tasks": task_dicts}


@router.get("/current")
async def get_current_plan(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = await crud.get_active_plan(db, current_user.id)
    if not plan:
        return {"plan": None, "tasks": []}
    tasks = await crud.list_plan_tasks(db, plan.id)
    return {
        "plan": {"id": plan.id, "title": plan.title, "start_date": plan.start_date.isoformat() if plan.start_date else None},
        "tasks": [_task_out(t) for t in tasks],
    }


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: int,
    req: TaskUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.db.models import StudyTask, StudyPlan
    result = await db.execute(
        select(StudyTask)
        .join(StudyPlan, StudyTask.plan_id == StudyPlan.id)
        .where(StudyTask.id == task_id, StudyPlan.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = req.status
    if req.status == TaskStatus.completed:
        task.completed_at = datetime.now(timezone.utc)
    if req.postpone_days and task.scheduled_date:
        from datetime import timedelta
        task.scheduled_date = task.scheduled_date + timedelta(days=req.postpone_days)

    return _task_out(task)


def _task_out(t) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "topic_name": t.topic_name,
        "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
        "estimated_minutes": t.estimated_minutes,
        "status": t.status.value,
        "priority": t.priority,
        "reason": t.reason,
    }
