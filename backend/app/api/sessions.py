"""Study timer and session API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import crud
from app.db.models import SessionStatus, User
from app.db.session import get_db

router = APIRouter(prefix="/sessions", tags=["study-sessions"])


class StartSessionRequest(BaseModel):
    subject: Optional[str] = None
    topic: Optional[str] = None
    document_id: Optional[int] = None
    is_pomodoro: bool = False


class StopSessionRequest(BaseModel):
    session_id: int
    duration_seconds: int  # client-side elapsed time for accuracy


class ManualSessionRequest(BaseModel):
    subject: Optional[str] = None
    topic: Optional[str] = None
    start_time: str  # ISO format
    end_time: str
    notes: Optional[str] = None


class SessionOut(BaseModel):
    id: int
    subject: Optional[str]
    topic: Optional[str]
    start_time: str
    end_time: Optional[str]
    duration_seconds: int
    status: str
    is_pomodoro: bool
    is_manual_entry: bool


@router.post("/start", response_model=SessionOut)
async def start_session(
    req: StartSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new study session (timer started on client)."""
    session = await crud.create_study_session(
        db,
        user_id=current_user.id,
        subject=req.subject,
        topic=req.topic,
        document_id=req.document_id,
        start_time=datetime.now(timezone.utc),
        status=SessionStatus.active,
        is_pomodoro=req.is_pomodoro,
    )
    return _session_out(session)


@router.post("/stop", response_model=SessionOut)
async def stop_session(
    req: StopSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop a session and record duration from client-side elapsed time."""
    session = await crud.get_study_session(db, req.session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == SessionStatus.completed:
        raise HTTPException(status_code=409, detail="Session already completed")

    session.end_time = datetime.now(timezone.utc)
    session.duration_seconds = max(req.duration_seconds, 0)
    session.status = SessionStatus.completed
    return _session_out(session)


@router.post("/pause/{session_id}", response_model=SessionOut)
async def pause_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await crud.get_study_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = SessionStatus.paused
    return _session_out(session)


@router.post("/resume/{session_id}", response_model=SessionOut)
async def resume_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await crud.get_study_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = SessionStatus.active
    return _session_out(session)


@router.post("/manual", response_model=SessionOut)
async def add_manual_session(
    req: ManualSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a manually entered past study session."""
    try:
        start = datetime.fromisoformat(req.start_time.replace("Z", "+00:00"))
        end = datetime.fromisoformat(req.end_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    if end <= start:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")
    duration = int((end - start).total_seconds())

    session = await crud.create_study_session(
        db,
        user_id=current_user.id,
        subject=req.subject,
        topic=req.topic,
        start_time=start,
        end_time=end,
        duration_seconds=duration,
        status=SessionStatus.completed,
        is_manual_entry=True,
        notes=req.notes,
    )
    return _session_out(session)


@router.get("/", response_model=List[SessionOut])
async def list_sessions(
    from_dt: Optional[str] = None,
    to_dt: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from_parsed = _parse_dt(from_dt) if from_dt else None
    to_parsed = _parse_dt(to_dt) if to_dt else None
    sessions = await crud.list_study_sessions(db, current_user.id, from_parsed, to_parsed)
    return [_session_out(s) for s in sessions]


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await crud.get_study_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)


def _session_out(s) -> dict:
    return {
        "id": s.id,
        "subject": s.subject,
        "topic": s.topic,
        "start_time": s.start_time.isoformat(),
        "end_time": s.end_time.isoformat() if s.end_time else None,
        "duration_seconds": s.duration_seconds,
        "status": s.status.value,
        "is_pomodoro": s.is_pomodoro,
        "is_manual_entry": s.is_manual_entry,
    }


def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))
