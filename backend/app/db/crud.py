"""
CRUD helpers — thin async wrappers over SQLAlchemy queries.
Business logic lives in services/, not here.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Sequence

from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    User, UserProfile, Document, DocumentChunk, TopicMastery,
    QuizAttempt, SubmittedAnswer, StudySession, StudyPlan, StudyTask,
    ChatConversation, ChatMessage, LearnerAssessment, LearningInsight,
    Question, MasteryLevel, DocStatus, SessionStatus,
)


# ─── Users ────────────────────────────────────────────────────────────────────

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, **kwargs) -> User:
    user = User(**kwargs)
    db.add(user)
    await db.flush()
    # create empty profile
    profile = UserProfile(user_id=user.id)
    db.add(profile)
    return user


async def update_user_profile(db: AsyncSession, user_id: int, **kwargs) -> Optional[UserProfile]:
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile:
        for k, v in kwargs.items():
            setattr(profile, k, v)
    return profile


# ─── Documents ────────────────────────────────────────────────────────────────

async def create_document(db: AsyncSession, **kwargs) -> Document:
    doc = Document(**kwargs)
    db.add(doc)
    await db.flush()
    return doc


async def get_document(db: AsyncSession, doc_id: int, user_id: int) -> Optional[Document]:
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_documents(db: AsyncSession, user_id: int) -> Sequence[Document]:
    result = await db.execute(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc())
    )
    return result.scalars().all()


async def update_document_status(
    db: AsyncSession, doc_id: int, status: DocStatus,
    error_message: Optional[str] = None, summary: Optional[str] = None,
    page_count: Optional[int] = None, vector_store_id: Optional[str] = None,
) -> None:
    vals: dict = {"status": status}
    if error_message is not None:
        vals["error_message"] = error_message
    if summary is not None:
        vals["summary"] = summary
    if page_count is not None:
        vals["page_count"] = page_count
    if vector_store_id is not None:
        vals["vector_store_id"] = vector_store_id
    if status == DocStatus.ready:
        vals["processed_at"] = datetime.now(timezone.utc)
    await db.execute(update(Document).where(Document.id == doc_id).values(**vals))


async def add_chunks(db: AsyncSession, chunks: List[DocumentChunk]) -> None:
    db.add_all(chunks)


async def get_chunks_by_document(db: AsyncSession, doc_id: int) -> Sequence[DocumentChunk]:
    result = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == doc_id)
        .order_by(DocumentChunk.chunk_index)
    )
    return result.scalars().all()


# ─── Topic Mastery ────────────────────────────────────────────────────────────

async def get_or_create_mastery(
    db: AsyncSession, user_id: int, topic_name: str, topic_id: Optional[int] = None
) -> TopicMastery:
    result = await db.execute(
        select(TopicMastery).where(
            TopicMastery.user_id == user_id,
            TopicMastery.topic_name == topic_name,
        )
    )
    mastery = result.scalar_one_or_none()
    if mastery is None:
        mastery = TopicMastery(user_id=user_id, topic_name=topic_name, topic_id=topic_id)
        db.add(mastery)
        await db.flush()
    return mastery


async def list_masteries(db: AsyncSession, user_id: int) -> Sequence[TopicMastery]:
    result = await db.execute(
        select(TopicMastery).where(TopicMastery.user_id == user_id)
    )
    return result.scalars().all()


# ─── Quiz ─────────────────────────────────────────────────────────────────────

async def create_question(db: AsyncSession, **kwargs) -> Question:
    q = Question(**kwargs)
    db.add(q)
    await db.flush()
    return q


async def get_question(db: AsyncSession, q_id: int) -> Optional[Question]:
    result = await db.execute(select(Question).where(Question.id == q_id))
    return result.scalar_one_or_none()


async def create_quiz_attempt(db: AsyncSession, **kwargs) -> QuizAttempt:
    attempt = QuizAttempt(**kwargs)
    db.add(attempt)
    await db.flush()
    return attempt


async def list_quiz_attempts(db: AsyncSession, user_id: int, limit: int = 50) -> Sequence[QuizAttempt]:
    result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.started_at.desc()).limit(limit)
    )
    return result.scalars().all()


# ─── Study Sessions ───────────────────────────────────────────────────────────

async def create_study_session(db: AsyncSession, **kwargs) -> StudySession:
    session = StudySession(**kwargs)
    db.add(session)
    await db.flush()
    return session


async def get_study_session(db: AsyncSession, session_id: int, user_id: int) -> Optional[StudySession]:
    result = await db.execute(
        select(StudySession).where(StudySession.id == session_id, StudySession.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_study_sessions(
    db: AsyncSession, user_id: int,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
) -> Sequence[StudySession]:
    q = select(StudySession).where(StudySession.user_id == user_id)
    if from_dt:
        q = q.where(StudySession.start_time >= from_dt)
    if to_dt:
        q = q.where(StudySession.start_time <= to_dt)
    q = q.order_by(StudySession.start_time.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def total_study_seconds(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.sum(StudySession.duration_seconds)).where(StudySession.user_id == user_id)
    )
    return result.scalar_one_or_none() or 0


# ─── Study Plans ──────────────────────────────────────────────────────────────

async def create_study_plan(db: AsyncSession, **kwargs) -> StudyPlan:
    plan = StudyPlan(**kwargs)
    db.add(plan)
    await db.flush()
    return plan


async def get_active_plan(db: AsyncSession, user_id: int) -> Optional[StudyPlan]:
    result = await db.execute(
        select(StudyPlan).where(StudyPlan.user_id == user_id, StudyPlan.is_active == True)
        .order_by(StudyPlan.created_at.desc())
    )
    return result.scalars().first()


async def list_plan_tasks(db: AsyncSession, plan_id: int) -> Sequence[StudyTask]:
    result = await db.execute(
        select(StudyTask).where(StudyTask.plan_id == plan_id)
        .order_by(StudyTask.scheduled_date, StudyTask.priority)
    )
    return result.scalars().all()


# ─── Chat ─────────────────────────────────────────────────────────────────────

async def create_conversation(db: AsyncSession, **kwargs) -> ChatConversation:
    conv = ChatConversation(**kwargs)
    db.add(conv)
    await db.flush()
    return conv


async def get_conversation(db: AsyncSession, conv_id: int, user_id: int) -> Optional[ChatConversation]:
    result = await db.execute(
        select(ChatConversation).where(
            ChatConversation.id == conv_id, ChatConversation.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def list_conversations(db: AsyncSession, user_id: int) -> Sequence[ChatConversation]:
    result = await db.execute(
        select(ChatConversation).where(ChatConversation.user_id == user_id)
        .order_by(ChatConversation.updated_at.desc())
    )
    return result.scalars().all()


async def add_message(db: AsyncSession, **kwargs) -> ChatMessage:
    msg = ChatMessage(**kwargs)
    db.add(msg)
    await db.flush()
    return msg


async def list_messages(db: AsyncSession, conv_id: int, limit: int = 100) -> Sequence[ChatMessage]:
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.conversation_id == conv_id)
        .order_by(ChatMessage.created_at).limit(limit)
    )
    return result.scalars().all()


# ─── Insights ─────────────────────────────────────────────────────────────────

async def create_insight(db: AsyncSession, **kwargs) -> LearningInsight:
    insight = LearningInsight(**kwargs)
    db.add(insight)
    await db.flush()
    return insight


async def list_insights(db: AsyncSession, user_id: int, include_dismissed: bool = False) -> Sequence[LearningInsight]:
    q = select(LearningInsight).where(LearningInsight.user_id == user_id)
    if not include_dismissed:
        q = q.where(LearningInsight.is_dismissed == False)
    result = await db.execute(q.order_by(LearningInsight.created_at.desc()))
    return result.scalars().all()
