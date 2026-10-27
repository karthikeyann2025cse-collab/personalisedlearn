"""
Study Planner Service
- Generates personalized daily/weekly study plans
- Considers mastery, prerequisites, available time, and deadlines
- Uses the LLM to create intelligent task breakdowns
- Updates plans after quiz results
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import structlog

from app.services.rag_service import call_llm

log = structlog.get_logger()


async def generate_study_plan(
    user_name: str,
    learning_goals: str,
    daily_minutes: int,
    masteries: List[dict],
    documents: List[dict],
    upcoming_deadlines: Optional[List[dict]] = None,
) -> dict:
    """
    Generate a 7-day study plan using LLM.
    Returns a dict with title and a list of task dicts.
    """
    mastery_summary = json.dumps(masteries[:15], indent=2) if masteries else "No mastery data yet."
    docs_summary = ", ".join(d.get("title", "Untitled") for d in documents[:5]) if documents else "No documents uploaded."
    deadlines_text = json.dumps(upcoming_deadlines, indent=2) if upcoming_deadlines else "None provided."

    prompt = f"""You are an expert educational planner for a student named {user_name}.

STUDENT PROFILE:
- Learning goals: {learning_goals or 'General improvement'}
- Available daily study time: {daily_minutes} minutes
- Uploaded documents: {docs_summary}

TOPIC MASTERY (current):
{mastery_summary}

UPCOMING DEADLINES:
{deadlines_text}

TASK: Create a realistic 7-day personalized study plan.

RULES:
- Do NOT schedule more than {daily_minutes} minutes of study per day.
- Prioritize weak topics (low mastery score) and upcoming deadlines.
- Include revision tasks for previously learned topics.
- Break complex topics into smaller subtasks (max 30 min each).
- Explain the reason for each task recommendation.

OUTPUT FORMAT (JSON, no markdown):
{{
  "title": "Your 7-Day Personalized Study Plan",
  "tasks": [
    {{
      "title": "<task title>",
      "description": "<what to do>",
      "topic_name": "<topic>",
      "day_offset": <0-6>,
      "estimated_minutes": <15-{daily_minutes}>,
      "priority": <1-5, 1=highest>,
      "reason": "<why this task was recommended>"
    }}
  ]
}}

Return ONLY valid JSON.
"""

    messages = [
        {"role": "system", "content": "You are an expert educational planner. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ]

    try:
        response = await call_llm(messages)
        response = re.sub(r"^```(?:json)?\s*", "", response.strip(), flags=re.MULTILINE)
        response = re.sub(r"\s*```$", "", response.strip(), flags=re.MULTILINE)
        plan_data = json.loads(response)
        return plan_data
    except Exception as e:
        log.error("plan_generation_failed", error=str(e))
        return {
            "title": "Study Plan (generation failed — please retry)",
            "tasks": [],
        }


def tasks_to_db(
    plan_id: int,
    tasks: List[dict],
    start_date: datetime,
) -> List[dict]:
    """Convert LLM-generated task dicts to DB-ready dicts with scheduled_date."""
    db_tasks = []
    for t in tasks:
        day_offset = int(t.get("day_offset", 0))
        scheduled = start_date + timedelta(days=day_offset)
        db_tasks.append({
            "plan_id": plan_id,
            "title": t.get("title", "Study Task"),
            "description": t.get("description"),
            "topic_name": t.get("topic_name"),
            "scheduled_date": scheduled,
            "estimated_minutes": int(t.get("estimated_minutes", 30)),
            "priority": int(t.get("priority", 3)),
            "reason": t.get("reason"),
        })
    return db_tasks


async def recommend_next_topic(
    masteries: List[dict],
    completed_topics: List[str],
) -> Optional[str]:
    """Simple rule-based next-topic recommendation."""
    # Find the lowest-mastery, not-yet-completed topic
    weak = [
        m for m in masteries
        if m.get("topic_name") not in completed_topics
    ]
    if not weak:
        return None
    weak.sort(key=lambda m: m.get("mastery_score", 0))
    return weak[0].get("topic_name")
