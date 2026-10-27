"""Chat / RAG API endpoints."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db import crud
from app.db.models import MasteryLevel, User
from app.db.session import get_db
from app.services.rag_service import answer_question, general_tutor_answer

router = APIRouter(prefix="/chat", tags=["chat"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class MessageIn(BaseModel):
    content: str
    document_id: Optional[int] = None
    conversation_id: Optional[int] = None
    language: str = "English"


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[list]
    mastery_level_used: Optional[str]
    created_at: str


class ConversationOut(BaseModel):
    id: int
    title: Optional[str]
    mode: str
    document_id: Optional[int]
    updated_at: str
    message_count: int = 0


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/message", response_model=MessageOut)
async def send_message(
    req: MessageIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message to the AI tutor. Creates or continues a conversation."""
    # Determine mastery level for the topic (use unknown if no data yet)
    mastery_level = MasteryLevel.unknown
    if req.document_id:
        # Check if user profile has a preferred language
        pass  # mastery per-topic is retrieved inside services

    # Get or create conversation
    if req.conversation_id:
        conv = await crud.get_conversation(db, req.conversation_id, current_user.id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        mode = "document" if req.document_id else "general"
        conv = await crud.create_conversation(
            db,
            user_id=current_user.id,
            document_id=req.document_id,
            mode=mode,
            title=req.content[:60] + "..." if len(req.content) > 60 else req.content,
        )

    # Load conversation history
    history_msgs = await crud.list_messages(db, conv.id, limit=20)
    history = [{"role": m.role, "content": m.content} for m in history_msgs]

    # Save user message
    user_msg = await crud.add_message(
        db,
        conversation_id=conv.id,
        role="user",
        content=req.content,
    )

    # Get language preference
    from sqlalchemy import select
    from app.db.models import UserProfile
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    language = profile.preferred_language if profile else "English"

    # Determine mastery level
    if req.document_id:
        # Use lowest known mastery for document topics (conservative)
        masteries = await crud.list_masteries(db, current_user.id)
        if masteries:
            mastery_level = min(
                (m.mastery_level for m in masteries),
                key=lambda x: [MasteryLevel.unknown, MasteryLevel.beginner,
                               MasteryLevel.intermediate, MasteryLevel.advanced].index(x)
            )

    # Generate answer
    sources = []
    if req.document_id:
        answer, sources = await answer_question(
            doc_id=req.document_id,
            question=req.content,
            mastery_level=mastery_level,
            language=language,
            conversation_history=history,
        )
    else:
        answer = await general_tutor_answer(
            question=req.content,
            mastery_level=mastery_level,
            language=language,
            conversation_history=history,
        )

    # Save assistant message
    asst_msg = await crud.add_message(
        db,
        conversation_id=conv.id,
        role="assistant",
        content=answer,
        sources=sources if sources else None,
        mastery_level_used=mastery_level.value,
    )

    return {
        "id": asst_msg.id,
        "conversation_id": conv.id,
        "role": asst_msg.role,
        "content": asst_msg.content,
        "sources": asst_msg.sources,
        "mastery_level_used": asst_msg.mastery_level_used,
        "created_at": asst_msg.created_at.isoformat(),
    }


@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convs = await crud.list_conversations(db, current_user.id)
    return [
        {
            "id": c.id,
            "title": c.title,
            "mode": c.mode,
            "document_id": c.document_id,
            "updated_at": c.updated_at.isoformat(),
            "message_count": 0,
        }
        for c in convs
    ]


@router.get("/conversations/{conv_id}/messages", response_model=List[MessageOut])
async def get_messages(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await crud.get_conversation(db, conv_id, current_user.id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await crud.list_messages(db, conv_id)
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "mastery_level_used": m.mastery_level_used,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]


@router.delete("/conversations/{conv_id}", status_code=204)
async def delete_conversation(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await crud.get_conversation(db, conv_id, current_user.id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
