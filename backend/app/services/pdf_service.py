"""
PDF Processing Service
- Text extraction with PyMuPDF
- OCR fallback with pytesseract
- Chapter / heading detection
- Smart text chunking
"""

from __future__ import annotations

import io
import re
from pathlib import Path
from typing import List, Optional, Tuple

try:
    import pymupdf as fitz
except ImportError:
    import fitz  # PyMuPDF fallback
import structlog
from PIL import Image

from app.core.config import get_settings

log = structlog.get_logger()
settings = get_settings()


# ─── Data classes ─────────────────────────────────────────────────────────────

class PageContent:
    def __init__(self, page_number: int, text: str, heading: Optional[str] = None, chapter: Optional[str] = None):
        self.page_number = page_number
        self.text = text.strip()
        self.heading = heading
        self.chapter = chapter


class TextChunk:
    def __init__(
        self,
        chunk_index: int,
        content: str,
        page_number: Optional[int],
        heading: Optional[str],
        chapter: Optional[str],
        token_count: int = 0,
    ):
        self.chunk_index = chunk_index
        self.content = content
        self.page_number = page_number
        self.heading = heading
        self.chapter = chapter
        self.token_count = token_count


class PDFExtractionResult:
    def __init__(
        self,
        pages: List[PageContent],
        chunks: List[TextChunk],
        page_count: int,
        used_ocr: bool = False,
    ):
        self.pages = pages
        self.chunks = chunks
        self.page_count = page_count
        self.used_ocr = used_ocr


# ─── Heading detection ────────────────────────────────────────────────────────

HEADING_PATTERNS = [
    re.compile(r"^(Chapter|CHAPTER)\s+\d+", re.MULTILINE),
    re.compile(r"^(\d+\.)+\s+\w", re.MULTILINE),
    re.compile(r"^[A-Z][A-Z\s]{5,50}$", re.MULTILINE),
]

CHAPTER_PATTERN = re.compile(r"(Chapter|CHAPTER|Unit|UNIT)\s+(\d+)[:\s]*(.*)", re.IGNORECASE)


def _detect_heading(text: str) -> Optional[str]:
    for line in text.split("\n")[:5]:
        line = line.strip()
        if not line:
            continue
        for pat in HEADING_PATTERNS:
            if pat.match(line):
                return line[:200]
    return None


def _detect_chapter(text: str) -> Optional[str]:
    m = CHAPTER_PATTERN.search(text[:500])
    if m:
        return m.group(0)[:200]
    return None


# ─── Core extraction ──────────────────────────────────────────────────────────

def _extract_page_text(page: fitz.Page) -> str:
    """Extract text from a single PDF page."""
    return page.get_text("text")


def _ocr_page(page: fitz.Page, dpi: int = 200) -> str:
    """Render page to image and run OCR."""
    try:
        import pytesseract
        pix = page.get_pixmap(dpi=dpi)
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data))
        return pytesseract.image_to_string(img, lang="eng")
    except Exception as e:
        log.warning("ocr_failed", error=str(e))
        return ""


def extract_pdf(file_path: str) -> PDFExtractionResult:
    """
    Extract text and structure from a PDF, text, or markdown file.
    Falls back to OCR when pages contain less than 20 characters of selectable text.
    Raises ValueError for corrupted files.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = path.suffix.lower()
    pages: List[PageContent] = []
    used_ocr = False

    if ext in [".txt", ".md", ".text"]:
        try:
            raw_content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raw_content = path.read_text(encoding="latin-1", errors="replace")

        # Split into ~400-word logical pages
        paragraphs = raw_content.split("\n\n")
        current_page_text: List[str] = []
        current_word_count = 0
        page_num = 1

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            words = len(para.split())
            if current_word_count + words > 450 and current_page_text:
                full_text = "\n\n".join(current_page_text)
                pages.append(PageContent(
                    page_number=page_num,
                    text=full_text,
                    heading=_detect_heading(full_text),
                    chapter=_detect_chapter(full_text),
                ))
                page_num += 1
                current_page_text = [para]
                current_word_count = words
            else:
                current_page_text.append(para)
                current_word_count += words

        if current_page_text or not pages:
            full_text = "\n\n".join(current_page_text) if current_page_text else (raw_content or "Notes document.")
            pages.append(PageContent(
                page_number=page_num,
                text=full_text,
                heading=_detect_heading(full_text),
                chapter=_detect_chapter(full_text),
            ))

    else:
        try:
            doc = fitz.open(str(path))
        except Exception as e:
            raise ValueError(f"Could not open PDF: {e}") from e

        if doc.is_encrypted:
            raise ValueError("PDF is encrypted. Please provide an unencrypted copy.")

        current_chapter: Optional[str] = None

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = _extract_page_text(page)

            # OCR fallback for image-heavy pages
            if len(text.strip()) < 20:
                text = _ocr_page(page)
                if text.strip():
                    used_ocr = True

            heading = _detect_heading(text)
            chapter_hit = _detect_chapter(text)
            if chapter_hit:
                current_chapter = chapter_hit

            pages.append(PageContent(
                page_number=page_num + 1,
                text=text,
                heading=heading,
                chapter=current_chapter,
            ))

        doc.close()

    chunks = _chunk_pages(pages, settings.chunk_size, settings.chunk_overlap)
    if not chunks and pages:
        # Guarantee at least one chunk so vector store and search do not fail
        fallback_content = " ".join(p.text for p in pages if p.text).strip() or path.stem
        chunks = [TextChunk(
            chunk_index=0,
            content=fallback_content[:1500],
            page_number=1,
            heading=pages[0].heading if pages else None,
            chapter=pages[0].chapter if pages else None,
            token_count=len(fallback_content.split()),
        )]

    return PDFExtractionResult(
        pages=pages,
        chunks=chunks,
        page_count=len(pages),
        used_ocr=used_ocr,
    )


# ─── Chunking ─────────────────────────────────────────────────────────────────

def _count_words(text: str) -> int:
    return len(text.split())


def _chunk_pages(
    pages: List[PageContent],
    chunk_size: int,
    chunk_overlap: int,
) -> List[TextChunk]:
    """
    Splits page texts into overlapping chunks of approximately chunk_size words.
    Preserves page number and heading metadata from the source page.
    """
    chunks: List[TextChunk] = []
    chunk_idx = 0
    buffer: List[str] = []
    buffer_words = 0
    current_page: Optional[int] = None
    current_heading: Optional[str] = None
    current_chapter: Optional[str] = None

    for page in pages:
        words = page.text.split()
        if not words:
            continue

        # update metadata from this page when starting a new chunk
        page_words = words
        word_pos = 0

        while word_pos < len(page_words):
            remaining = chunk_size - buffer_words
            take = page_words[word_pos: word_pos + remaining]
            buffer.extend(take)
            buffer_words += len(take)
            word_pos += len(take)

            if current_page is None:
                current_page = page.page_number
                current_heading = page.heading
                current_chapter = page.chapter

            if buffer_words >= chunk_size:
                content = " ".join(buffer)
                chunks.append(TextChunk(
                    chunk_index=chunk_idx,
                    content=content,
                    page_number=current_page,
                    heading=current_heading,
                    chapter=current_chapter,
                    token_count=buffer_words,
                ))
                chunk_idx += 1

                # overlap: keep last N words
                overlap_words = buffer[-chunk_overlap:] if chunk_overlap > 0 else []
                buffer = overlap_words
                buffer_words = len(buffer)
                current_page = page.page_number
                current_heading = page.heading
                current_chapter = page.chapter

    # flush remainder
    if buffer:
        chunks.append(TextChunk(
            chunk_index=chunk_idx,
            content=" ".join(buffer),
            page_number=current_page,
            heading=current_heading,
            chapter=current_chapter,
            token_count=buffer_words,
        ))

    return chunks


def generate_summary_prompt(pages: List[PageContent]) -> str:
    """Build a prompt for an LLM to summarise the document."""
    first_3k_words = " ".join(
        w for p in pages for w in p.text.split()
    )[:3000]
    return (
        "You are an expert educational summariser. "
        "Summarise the following document content in 150–300 words, "
        "highlighting the main topics, key concepts, and intended audience.\n\n"
        f"DOCUMENT CONTENT:\n{first_3k_words}"
    )


def generate_heuristic_summary(pages: List[PageContent]) -> str:
    """Generate an informative educational analysis directly from extracted pages."""
    if not pages:
        return "Academic study document."

    total_pages = len(pages)
    headings = [p.heading for p in pages if p.heading]
    first_page_clean = " ".join(pages[0].text.split())

    parts = [
        f"### Document Analysis ({total_pages} Pages)\n"
        f"**Core Subject:** {first_page_clean[:220]}...\n",
    ]
    if headings:
        parts.append(f"**Key Topics & Headings Identified:**\n" + "\n".join(f"- {h}" for h in headings[:4]))

    parts.append("\n**Learning Focus:** Methodological analysis, conceptual definitions, and real-world implementations.")
    return "\n".join(parts)

