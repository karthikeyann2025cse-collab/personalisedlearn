"""
Quiz Service
- Generates questions from document chunks using the LLM
- Supports MCQ, T/F, short-answer, long-answer
- Grades objective questions automatically
- Uses rubric-based AI grading for descriptive answers
- Updates topic mastery after grading
"""

from __future__ import annotations

import json
import re
from typing import List, Optional, Tuple

import structlog

from app.core.config import get_settings
from app.db.models import DifficultyLevel, MasteryLevel, QuestionType
from app.services.rag_service import call_llm, retrieve_chunks

log = structlog.get_logger()
settings = get_settings()


# ─── Generation ───────────────────────────────────────────────────────────────

QUESTION_TYPE_LABELS = {
    QuestionType.mcq: "multiple-choice (4 options, one correct)",
    QuestionType.true_false: "true/false",
    QuestionType.short_answer: "short-answer (2–4 sentences expected)",
    QuestionType.long_answer: "long-answer essay",
}

DIFFICULTY_LABELS = {
    DifficultyLevel.easy: "easy (recall-level, straightforward)",
    DifficultyLevel.medium: "medium (requires understanding and application)",
    DifficultyLevel.hard: "hard (analysis, synthesis, edge cases)",
}

MARKS_GUIDANCE = {
    2: "A concise 2-mark answer: key definition or fact.",
    5: "A 5-mark answer: explanation with an example.",
    10: "A 10-mark answer: detailed explanation with points, examples, and diagrams if needed.",
    13: "A 13-mark answer: comprehensive essay with introduction, detailed points, examples, comparisons, and conclusion.",
}


async def generate_questions(
    doc_id: Optional[int],
    topic: str,
    num_questions: int = 5,
    question_type: QuestionType = QuestionType.mcq,
    difficulty: DifficultyLevel = DifficultyLevel.medium,
    marks: int = 2,
) -> List[dict]:
    """
    Generate questions grounded in the document or topic using the LLM.
    Returns a list of question dicts.
    """
    context = ""
    if doc_id:
        retrieved = await retrieve_chunks(doc_id, topic, top_k=6)
        context = "\n\n".join(c["content"] for c, _ in retrieved[:5])
    if not context.strip():
        context = f"Educational curriculum material regarding principles, methodologies, architecture, and applications of {topic}."

    type_label = QUESTION_TYPE_LABELS.get(question_type, "multiple-choice (4 options, one correct)")
    diff_label = DIFFICULTY_LABELS.get(difficulty, "medium")
    marks_guidance = MARKS_GUIDANCE.get(marks, f"{marks}-mark answer.")

    prompt = f"""You are an expert educational assessment designer.

TASK: Generate exactly {num_questions} {type_label} questions on the topic: "{topic}"
DIFFICULTY: {diff_label}
MARKS PER QUESTION: {marks} ({marks_guidance})

DOCUMENT CONTEXT (base questions on this material):
{context}

OUTPUT FORMAT (JSON array, no markdown fences):
[
  {{
    "text": "<question text>",
    "type": "{question_type.value}",
    "difficulty": "{difficulty.value}",
    "marks": {marks},
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "<correct answer>",
    "explanation": "<why this is the answer, with reference>",
    "source_page": 1,
    "topic_name": "{topic}"
  }}
]

RULES:
- Return ONLY the JSON array, no other text.
"""

    messages = [
        {"role": "system", "content": "You are an expert question generator. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ]

    try:
        response = await call_llm(messages)
        # Strip potential markdown code fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", response.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
        # Try finding json array inside
        array_match = re.search(r"\[\s*\{.*\}\s*\]", cleaned, re.DOTALL)
        if array_match:
            cleaned = array_match.group(0)
        questions = json.loads(cleaned)
        if isinstance(questions, list) and len(questions) > 0:
            return questions
    except Exception as e:
        log.error("question_generation_failed", error=str(e))

    # Fallback deterministic question synthesis if LLM or parsing fails
    fallback_questions = []
    for i in range(1, num_questions + 1):
        if question_type == QuestionType.true_false:
            fallback_questions.append({
                "text": f"True or False: In {topic}, key operational constraints and foundational principles must be satisfied for convergence.",
                "type": "true_false",
                "difficulty": difficulty.value,
                "marks": marks,
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": f"Grounded in core principles of {topic}.",
                "source_page": 1,
                "topic_name": topic,
            })
        elif question_type in (QuestionType.short_answer, QuestionType.long_answer):
            fallback_questions.append({
                "text": f"Explain the core mechanism, architectural steps, and primary significance of {topic}.",
                "type": question_type.value,
                "difficulty": difficulty.value,
                "marks": marks,
                "options": None,
                "correct_answer": f"{topic} enables robust systematic execution through structured evaluation.",
                "explanation": f"Key conceptual formulation of {topic}.",
                "source_page": 1,
                "topic_name": topic,
            })
        else:
            fallback_questions.append({
                "text": f"Which of the following correctly defines the primary objective or mechanism of {topic}?",
                "type": "mcq",
                "difficulty": difficulty.value,
                "marks": marks,
                "options": [
                    f"A) Optimizing performance bounds and systematic transitions in {topic}",
                    f"B) Bypassing parameter verification in {topic}",
                    f"C) Arbitrary uncalibrated execution without evaluation",
                    f"D) None of the above",
                ],
                "correct_answer": f"A) Optimizing performance bounds and systematic transitions in {topic}",
                "explanation": f"Demonstrates fundamental understanding of {topic}.",
                "source_page": 1,
                "topic_name": topic,
            })

    return fallback_questions


async def generate_exam_answer(
    doc_id: int,
    question: str,
    marks: int = 5,
    language: str = "English",
) -> str:
    """Generate a model exam answer for the given question and mark allocation."""
    retrieved = await retrieve_chunks(doc_id, question, top_k=5)
    context = "\n\n".join(c["content"] for c, _ in retrieved[:5])
    marks_guidance = MARKS_GUIDANCE.get(marks, f"{marks}-mark answer.")

    lang = "Tamil (தமிழ்)" if language == "Tamil" else "English"

    prompt = f"""You are an expert answer writer for academic exams.

QUESTION: {question}
MARKS: {marks} ({marks_guidance})
LANGUAGE: Write in {lang}.

DOCUMENT CONTEXT:
{context}

Write a complete, well-structured model answer for the above question worth {marks} marks.
Include: clear headings, key points, examples from the document, and a brief conclusion.
Cite page references where applicable as (Page X).
Label this clearly as a SAMPLE MODEL ANSWER at the top.
"""

    messages = [
        {"role": "system", "content": "You are an expert academic answer writer."},
        {"role": "user", "content": prompt},
    ]
    return await call_llm(messages)


# ─── Grading ──────────────────────────────────────────────────────────────────

def grade_objective(
    question: dict,
    user_answer: str,
) -> Tuple[bool, float, str]:
    """
    Grade MCQ or True/False.
    Returns (is_correct, score, feedback).
    """
    correct = (question.get("correct_answer") or "").strip().lower()
    given = user_answer.strip().lower()

    # Normalize option letters: "a", "a)", "a." → "a"
    def normalise(s: str) -> str:
        s = re.sub(r"[)\.\s]", "", s)
        return s.lower()

    is_correct = normalise(correct) == normalise(given)
    score = float(question.get("marks", 1)) if is_correct else 0.0
    feedback = (
        f"Correct! {question.get('explanation', '')}"
        if is_correct
        else f"Incorrect. The correct answer is: {question.get('correct_answer')}. {question.get('explanation', '')}"
    )
    return is_correct, score, feedback


async def grade_descriptive(
    question: dict,
    user_answer: str,
    marks: int,
) -> Tuple[float, str]:
    """
    Use the LLM to grade a short or long answer with a transparent rubric.
    Returns (score, feedback).
    """
    prompt = f"""You are a fair and encouraging academic examiner.

QUESTION ({marks} marks): {question.get('text', '')}
IDEAL ANSWER: {question.get('correct_answer', 'Not provided — use your knowledge.')}
STUDENT ANSWER: {user_answer}

RUBRIC:
- Award marks proportionally based on accuracy, completeness, and clarity.
- Identify up to 3 specific strengths and up to 3 specific areas for improvement.
- Do NOT penalise for minor spelling or grammar errors in non-language subjects.
- Maximum marks: {marks}

OUTPUT FORMAT (JSON):
{{
  "score": <numeric score out of {marks}, e.g. 3.5>,
  "percentage": <0-100>,
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "feedback": "<encouraging 2–3 sentence summary for the student>"
}}

Return ONLY valid JSON.
"""
    messages = [
        {"role": "system", "content": "You are a fair academic grader. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ]
    try:
        response = await call_llm(messages)
        response = re.sub(r"^```(?:json)?\s*", "", response.strip(), flags=re.MULTILINE)
        response = re.sub(r"\s*```$", "", response.strip(), flags=re.MULTILINE)
        result = json.loads(response)
        score = float(result.get("score", 0))
        feedback = result.get("feedback", "")
        return score, feedback
    except Exception as e:
        log.error("descriptive_grading_failed", error=str(e))
        return 0.0, "Grading failed. Please try again."


# ─── Mastery update ───────────────────────────────────────────────────────────

def compute_mastery_level(score_percent: float, attempts: int) -> MasteryLevel:
    """
    Heuristic mastery estimation from quiz accuracy.
    Requires at least 2 attempts before moving beyond 'unknown'.
    """
    if attempts < 2:
        return MasteryLevel.unknown
    if score_percent >= 85:
        return MasteryLevel.advanced
    if score_percent >= 60:
        return MasteryLevel.intermediate
    return MasteryLevel.beginner
