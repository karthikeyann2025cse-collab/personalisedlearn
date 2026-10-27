"""
ML Module E: Spaced Repetition Scheduler
=========================================
Purpose: Schedule the optimal next review date for a topic based on
         previous performance, confidence, and the SM-2 algorithm.

Algorithm: SM-2 (SuperMemo 2) with confidence-based interval adjustment.

Inputs:
  - performance_score: float 0–1 (quiz accuracy on the topic)
  - confidence: int 1–5 (student self-reported confidence)
  - repetition_number: int (how many times reviewed)
  - easiness_factor: float (default 2.5)
  - previous_interval_days: int (days since last review)

Output:
  - next_review_days: days until next review
  - new_easiness_factor: updated EF
  - new_repetition_number: updated rep count

Reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-of-learning
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional


MIN_EF = 1.3
DEFAULT_EF = 2.5


def sm2_update(
    performance_score: float,
    confidence: int,
    repetition_number: int,
    easiness_factor: float = DEFAULT_EF,
    previous_interval_days: int = 1,
) -> dict:
    """
    Run one SM-2 iteration.
    performance_score: 0.0–1.0 (maps to quality q: 0–5)
    confidence: 1–5 (added to quality signal)
    """
    # Map to SM-2 quality (0-5)
    q = round(performance_score * 3) + round((confidence - 1) / 4 * 2)
    q = max(0, min(5, q))

    if q < 3:
        # Incorrect or low confidence — reset
        new_rep = 0
        new_interval = 1
    else:
        new_rep = repetition_number + 1
        if new_rep == 1:
            new_interval = 1
        elif new_rep == 2:
            new_interval = 6
        else:
            new_interval = round(previous_interval_days * easiness_factor)

    new_ef = easiness_factor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
    new_ef = max(MIN_EF, new_ef)

    next_review = datetime.now(timezone.utc) + timedelta(days=new_interval)

    return {
        "next_review_days": new_interval,
        "next_review_date": next_review.isoformat(),
        "new_easiness_factor": round(new_ef, 2),
        "new_repetition_number": new_rep,
        "quality_score": q,
        "note": "Spaced repetition interval calculated using SM-2 algorithm.",
    }


def schedule_revision(topic_mastery: dict) -> dict:
    """
    Compute next revision schedule for a topic from its mastery record.
    topic_mastery: dict with mastery_score, attempts, quiz_accuracy, etc.
    """
    return sm2_update(
        performance_score=float(topic_mastery.get("mastery_score", 0.5)),
        confidence=int(topic_mastery.get("confidence", 3)),
        repetition_number=int(topic_mastery.get("attempts", 0)),
        easiness_factor=float(topic_mastery.get("easiness_factor", DEFAULT_EF)),
        previous_interval_days=int(topic_mastery.get("previous_interval_days", 1)),
    )
