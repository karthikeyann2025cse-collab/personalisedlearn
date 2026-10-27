"""Quiz API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import crud
from app.db.models import (
    DifficultyLevel, MasteryLevel, QuestionType, User
)
from app.db.session import get_db
from app.services.quiz_service import (
    generate_questions, generate_exam_answer,
    grade_objective, grade_descriptive, compute_mastery_level,
)

router = APIRouter(prefix="/quiz", tags=["quiz"])


class GenerateRequest(BaseModel):
    document_id: Optional[int] = None
    topic: str
    num_questions: int = 5
    question_type: QuestionType = QuestionType.mcq
    difficulty: DifficultyLevel = DifficultyLevel.medium
    marks: int = 2


class ExamAnswerRequest(BaseModel):
    document_id: Optional[int] = None
    question: str
    marks: int = 5
    language: str = "English"


class SubmitAnswerRequest(BaseModel):
    attempt_id: int
    question_data: dict          # Full question dict from generate
    user_answer: str
    time_taken_seconds: Optional[int] = None


class AttemptOut(BaseModel):
    id: int
    topic_name: Optional[str]
    total_questions: int
    correct_count: int
    score_percent: float
    started_at: str
    completed_at: Optional[str]


@router.post("/generate")
async def generate(
    req: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate practice questions from a document or curriculum topic."""
    doc = None
    if req.document_id:
        doc = await crud.get_document(db, req.document_id, current_user.id)

    questions = await generate_questions(
        doc_id=doc.id if doc else None,
        topic=req.topic or "General Subject Knowledge",
        num_questions=req.num_questions,
        question_type=req.question_type,
        difficulty=req.difficulty,
        marks=req.marks,
    )

    # Save attempt to DB
    attempt = await crud.create_quiz_attempt(
        db,
        user_id=current_user.id,
        document_id=doc.id if doc else None,
        topic_name=req.topic,
        total_questions=len(questions),
    )
    await db.commit()

    return {
        "attempt_id": attempt.id,
        "questions": questions,
        "topic": req.topic,
        "note": "These are AI-generated practice questions, not actual exam papers.",
    }


@router.post("/submit-answer")
async def submit_answer(
    req: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grade a single answer and update mastery."""
    q = req.question_data
    q_type = q.get("type", "short_answer")
    marks = int(q.get("marks", 2))

    if q_type in ("mcq", "true_false"):
        is_correct, score, feedback = grade_objective(q, req.user_answer)
    else:
        score, feedback = await grade_descriptive(q, req.user_answer, marks)
        is_correct = score >= (marks * 0.6)

    # Update mastery
    topic = q.get("topic_name") or "General"
    mastery = await crud.get_or_create_mastery(db, current_user.id, topic)
    mastery.attempts += 1
    if is_correct:
        mastery.correct_answers += 1
    accuracy = mastery.correct_answers / mastery.attempts if mastery.attempts else 0.0
    mastery.quiz_accuracy = accuracy
    mastery.mastery_score = accuracy
    mastery.mastery_level = compute_mastery_level(accuracy * 100, mastery.attempts)
    mastery.last_assessed_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "is_correct": is_correct,
        "score": score,
        "max_score": marks,
        "feedback": feedback,
        "mastery_level": mastery.mastery_level.value,
        "mastery_score": round(mastery.mastery_score * 100, 1),
    }


@router.post("/complete-attempt")
async def complete_attempt(
    attempt_id: int,
    correct_count: int,
    total_questions: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a quiz attempt as completed with final score."""
    from sqlalchemy import select
    from app.db.models import QuizAttempt
    result = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id, QuizAttempt.user_id == current_user.id
        )
    )
    attempt = result.scalar_one_or_none()
    score_percent = (correct_count / total_questions * 100) if total_questions else 0
    if not attempt:
        attempt = QuizAttempt(
            user_id=current_user.id,
            total_questions=total_questions,
            correct_count=correct_count,
            score_percent=score_percent,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(attempt)
    else:
        attempt.correct_count = correct_count
        attempt.total_questions = total_questions
        attempt.score_percent = score_percent
        attempt.completed_at = datetime.now(timezone.utc)

    await db.commit()

    return {"score_percent": round(score_percent, 1), "correct_count": correct_count}


@router.post("/exam-answer")
async def get_exam_answer(
    req: ExamAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await crud.get_document(db, req.document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    answer = await generate_exam_answer(
        doc_id=req.document_id,
        question=req.question,
        marks=req.marks,
        language=req.language,
    )
    return {"answer": answer, "marks": req.marks}


@router.get("/attempts", response_model=List[AttemptOut])
async def list_attempts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attempts = await crud.list_quiz_attempts(db, current_user.id)
    return [
        {
            "id": a.id,
            "topic_name": a.topic_name,
            "total_questions": a.total_questions,
            "correct_count": a.correct_count,
            "score_percent": a.score_percent,
            "started_at": a.started_at.isoformat(),
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        }
        for a in attempts
    ]


@router.get("/mastery")
async def get_mastery(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    masteries = await crud.list_masteries(db, current_user.id)
    return [
        {
            "topic_name": m.topic_name,
            "mastery_level": m.mastery_level.value,
            "mastery_score": round(m.mastery_score * 100, 1),
            "quiz_accuracy": round(m.quiz_accuracy * 100, 1),
            "attempts": m.attempts,
        }
        for m in masteries
    ]
