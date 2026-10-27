"""
LearnOn Database Models
All tables used by the application.  Relationships are explicit via FK columns
and SQLAlchemy relationship() declarations.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Integer,
    String, Text, JSON, Index, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    student = "student"
    admin = "admin"


class DocStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class MasteryLevel(str, enum.Enum):
    unknown = "unknown"
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class QuestionType(str, enum.Enum):
    mcq = "mcq"
    true_false = "true_false"
    short_answer = "short_answer"
    long_answer = "long_answer"
    programming = "programming"


class DifficultyLevel(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    postponed = "postponed"


class SessionStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    completed = "completed"


# ─── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.student)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    profile: Mapped[Optional["UserProfile"]] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    documents: Mapped[List["Document"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    quiz_attempts: Mapped[List["QuizAttempt"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    study_sessions: Mapped[List["StudySession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    topic_masteries: Mapped[List["TopicMastery"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    study_plans: Mapped[List["StudyPlan"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_conversations: Mapped[List["ChatConversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    insights: Mapped[List["LearningInsight"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    learning_goals: Mapped[Optional[str]] = mapped_column(Text)
    preferred_language: Mapped[str] = mapped_column(String(50), default="English")
    subjects: Mapped[Optional[str]] = mapped_column(JSON)          # list[str]
    daily_study_minutes: Mapped[int] = mapped_column(Integer, default=60)
    preferred_formats: Mapped[Optional[str]] = mapped_column(JSON)  # list[str]
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="profile")


# ─── Documents ────────────────────────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[DocStatus] = mapped_column(Enum(DocStatus), default=DocStatus.pending)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    subject: Mapped[Optional[str]] = mapped_column(String(255))
    vector_store_id: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    owner: Mapped["User"] = relationship(back_populates="documents")
    chunks: Mapped[List["DocumentChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer)
    heading: Mapped[Optional[str]] = mapped_column(String(500))
    chapter: Mapped[Optional[str]] = mapped_column(String(255))
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    document: Mapped["Document"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_doc_chunk", "document_id", "chunk_index"),
    )


# ─── Knowledge Graph ──────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    topics: Mapped[List["Topic"]] = relationship(back_populates="subject")


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    difficulty_level: Mapped[DifficultyLevel] = mapped_column(Enum(DifficultyLevel), default=DifficultyLevel.medium)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    subject: Mapped["Subject"] = relationship(back_populates="topics")
    prerequisites: Mapped[List["TopicPrerequisite"]] = relationship(
        foreign_keys="TopicPrerequisite.topic_id", back_populates="topic"
    )
    masteries: Mapped[List["TopicMastery"]] = relationship(back_populates="topic")


class TopicPrerequisite(Base):
    __tablename__ = "topic_prerequisites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)
    prerequisite_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)

    topic: Mapped["Topic"] = relationship(foreign_keys=[topic_id], back_populates="prerequisites")
    prerequisite: Mapped["Topic"] = relationship(foreign_keys=[prerequisite_id])

    __table_args__ = (
        UniqueConstraint("topic_id", "prerequisite_id"),
    )


# ─── Topic Mastery ────────────────────────────────────────────────────────────

class TopicMastery(Base):
    __tablename__ = "topic_masteries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)
    topic_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mastery_level: Mapped[MasteryLevel] = mapped_column(Enum(MasteryLevel), default=MasteryLevel.unknown)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)   # 0.0 – 1.0
    quiz_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0)
    misconceptions: Mapped[Optional[str]] = mapped_column(JSON)         # list[str]
    last_assessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    next_revision_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="topic_masteries")
    topic: Mapped[Optional["Topic"]] = relationship(back_populates="masteries")

    __table_args__ = (
        Index("ix_user_topic", "user_id", "topic_name"),
    )


# ─── Quiz ─────────────────────────────────────────────────────────────────────

class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"))
    topic_name: Mapped[Optional[str]] = mapped_column(String(255))
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType))
    difficulty: Mapped[DifficultyLevel] = mapped_column(Enum(DifficultyLevel), default=DifficultyLevel.medium)
    marks: Mapped[int] = mapped_column(Integer, default=2)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[Optional[str]] = mapped_column(JSON)         # list[str] for MCQ
    correct_answer: Mapped[Optional[str]] = mapped_column(Text)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    source_page: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"))
    topic_name: Mapped[Optional[str]] = mapped_column(String(255))
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    score_percent: Mapped[float] = mapped_column(Float, default=0.0)
    time_taken_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_practice: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="quiz_attempts")
    answers: Mapped[List["SubmittedAnswer"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")


class SubmittedAnswer(Base):
    __tablename__ = "submitted_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("quiz_attempts.id"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    user_answer: Mapped[Optional[str]] = mapped_column(Text)
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    feedback: Mapped[Optional[str]] = mapped_column(Text)
    time_taken_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    attempt: Mapped["QuizAttempt"] = relationship(back_populates="answers")
    question: Mapped["Question"] = relationship()


# ─── Study Sessions ───────────────────────────────────────────────────────────

class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subject: Mapped[Optional[str]] = mapped_column(String(255))
    topic: Mapped[Optional[str]] = mapped_column(String(255))
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.active)
    is_pomodoro: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_manual_entry: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="study_sessions")

    __table_args__ = (
        Index("ix_session_user_date", "user_id", "start_time"),
    )


# ─── Study Plans ──────────────────────────────────────────────────────────────

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="study_plans")
    tasks: Mapped[List["StudyTask"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class StudyTask(Base):
    __tablename__ = "study_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("study_plans.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    topic_name: Mapped[Optional[str]] = mapped_column(String(255))
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"))
    scheduled_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.pending)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    plan: Mapped["StudyPlan"] = relationship(back_populates="tasks")


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"))
    title: Mapped[Optional[str]] = mapped_column(String(500))
    mode: Mapped[str] = mapped_column(String(50), default="document")  # document | general
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="chat_conversations")
    messages: Mapped[List["ChatMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("chat_conversations.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)   # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[Optional[str]] = mapped_column(JSON)             # list[{page, excerpt}]
    mastery_level_used: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation: Mapped["ChatConversation"] = relationship(back_populates="messages")


# ─── Learner Assessment ───────────────────────────────────────────────────────

class LearnerAssessment(Base):
    __tablename__ = "learner_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    topic_name: Mapped[str] = mapped_column(String(255), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    student_answer: Mapped[Optional[str]] = mapped_column(Text)
    evaluation: Mapped[Optional[str]] = mapped_column(Text)
    confidence_level: Mapped[Optional[int]] = mapped_column(Integer)  # 1-5
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ─── Learning Insights ────────────────────────────────────────────────────────

class LearningInsight(Base):
    __tablename__ = "learning_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    insight_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[Optional[str]] = mapped_column(JSON)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="insights")
