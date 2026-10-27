"""Documents API — upload, process, list, view."""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db import crud
from app.db.models import DocStatus, Document, DocumentChunk, User
from app.db.session import get_db, AsyncSessionLocal
from app.services.pdf_service import extract_pdf, generate_summary_prompt, generate_heuristic_summary
from app.services.rag_service import build_vector_store, call_llm

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    title: str
    filename: str
    file_size: int
    page_count: int
    status: str
    summary: Optional[str]
    subject: Optional[str]
    created_at: str
    error_message: Optional[str]

    class Config:
        from_attributes = True


class PageOut(BaseModel):
    page_number: int
    text: str
    heading: Optional[str]
    chapter: Optional[str]


# ─── Background processing ────────────────────────────────────────────────────

async def _process_document(doc_id: int) -> None:
    """Extract, chunk, embed, and index a PDF/document in the background."""
    async with AsyncSessionLocal() as db:
        try:
            # Fetch without user isolation — background task
            from sqlalchemy import select
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if not doc:
                return

            await crud.update_document_status(db, doc_id, DocStatus.processing)
            await db.commit()

            # Extract
            extraction = extract_pdf(doc.file_path)

            # Generate summary via LLM
            summary_prompt = generate_summary_prompt(extraction.pages)
            try:
                summary = await call_llm([
                    {"role": "system", "content": "Summarise educational documents concisely."},
                    {"role": "user", "content": summary_prompt},
                ])
            except Exception:
                summary = generate_heuristic_summary(extraction.pages)

            # Save chunks to DB
            db_chunks = [
                DocumentChunk(
                    document_id=doc_id,
                    chunk_index=c.chunk_index,
                    content=c.content,
                    page_number=c.page_number,
                    heading=c.heading,
                    chapter=c.chapter,
                    token_count=c.token_count,
                )
                for c in extraction.chunks
            ]
            db.add_all(db_chunks)
            await db.flush()

            # Build vector store
            chunk_dicts = [
                {
                    "content": c.content,
                    "page_number": c.page_number,
                    "heading": c.heading,
                    "chapter": c.chapter,
                    "chunk_index": c.chunk_index,
                }
                for c in extraction.chunks
            ]
            try:
                vs_id = await build_vector_store(doc_id, chunk_dicts)
            except Exception:
                vs_id = None

            await crud.update_document_status(
                db, doc_id, DocStatus.ready,
                summary=summary,
                page_count=extraction.page_count,
                vector_store_id=vs_id,
            )
            await db.commit()

        except ValueError as e:
            async with AsyncSessionLocal() as db2:
                await crud.update_document_status(db2, doc_id, DocStatus.failed, error_message=str(e))
                await db2.commit()
        except Exception as e:
            async with AsyncSessionLocal() as db2:
                await crud.update_document_status(db2, doc_id, DocStatus.failed, error_message=f"Processing error: {e}")
                await db2.commit()


# ─── Endpoints ────────────────────────────────────────────────────────────────

SUPPORTED_EXTENSIONS = (".pdf", ".txt", ".md", ".text")

@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate file presence and format
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename_lower = file.filename.lower()
    if not any(filename_lower.endswith(ext) for ext in SUPPORTED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Accepted document formats: PDF (.pdf), Text (.txt), and Markdown (.md)",
        )

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.max_upload_size_mb} MB",
        )

    # Save to disk
    upload_dir = Path(settings.upload_dir) / str(current_user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = upload_dir / safe_name
    file_path.write_bytes(content)

    # Clean title
    raw_title = file.filename
    for ext in SUPPORTED_EXTENSIONS:
        if raw_title.lower().endswith(ext):
            raw_title = raw_title[: -len(ext)]
            break

    # Create DB record
    doc = await crud.create_document(
        db,
        user_id=current_user.id,
        title=raw_title or "Untitled Document",
        filename=file.filename,
        file_path=str(file_path),
        file_size=len(content),
        subject=subject,
    )
    await db.commit()
    await db.refresh(doc)

    # Queue background processing
    background_tasks.add_task(_process_document, doc.id)

    return _doc_to_out(doc)


@router.get("/", response_model=List[DocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = await crud.list_documents(db, current_user.id)
    return [_doc_to_out(d) for d in docs]


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await crud.get_document(db, doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_to_out(doc)


@router.get("/{doc_id}/pages", response_model=List[PageOut])
async def get_document_pages(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-extract page texts on demand (for the PDF viewer side panel)."""
    doc = await crud.get_document(db, doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != DocStatus.ready:
        raise HTTPException(status_code=409, detail="Document is still processing")
    try:
        extraction = extract_pdf(doc.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return [
        {"page_number": p.page_number, "text": p.text, "heading": p.heading, "chapter": p.chapter}
        for p in extraction.pages
    ]


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await crud.get_document(db, doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Remove file from disk
    try:
        Path(doc.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    await db.delete(doc)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _doc_to_out(doc: Document) -> dict:
    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "status": doc.status.value,
        "summary": doc.summary,
        "subject": doc.subject,
        "created_at": doc.created_at.isoformat(),
        "error_message": doc.error_message,
    }
