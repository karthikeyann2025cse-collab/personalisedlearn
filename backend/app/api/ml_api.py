"""
ML Predictions API
Exposes trained ML models via REST endpoints.
All predictions include confidence levels and honest disclaimers.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db import crud
from app.db.models import User
from app.db.session import get_db
from app.ml import spaced_repetition

router = APIRouter(prefix="/ml", tags=["ml-predictions"])
settings = get_settings()


class ScorePredictRequest(BaseModel):
    avg_session_minutes: float = 30.0
    num_sessions: int = 5
    prior_mastery_score: float = 0.5
    attempts: int = 3


class RiskPredictRequest(BaseModel):
    topic_name: str
    mastery_score: float = 0.5
    quiz_accuracy: float = 0.5
    attempts: int = 3
    prerequisite_mastery: float = 0.5
    days_since_last_study: int = 3
    avg_session_minutes: float = 30
    num_sessions_last_7d: int = 2
    incorrect_streak: int = 0


class SRSRequest(BaseModel):
    topic_name: str
    performance_score: float
    confidence: int = 3
    repetition_number: int = 0
    easiness_factor: float = 2.5
    previous_interval_days: int = 1


def _load_model(filename: str):
    """Load a joblib model from the models path."""
    import joblib
    path = Path(settings.ml_models_path) / filename
    if not path.exists():
        return None
    return joblib.load(str(path))


@router.post("/predict-score")
async def predict_score(
    req: ScorePredictRequest,
    current_user: User = Depends(get_current_user),
):
    """Estimate future quiz score (Linear Regression)."""
    from app.ml import linreg_score
    pipeline = _load_model("linreg_quiz_score.pkl")
    if pipeline is None:
        # Train on synthetic data if no model exists yet
        data = linreg_score.generate_synthetic_data()
        result = linreg_score.train(data)
        pipeline = result["pipeline"]
        linreg_score.save(pipeline, str(Path(settings.ml_models_path) / "linreg_quiz_score.pkl"))

    prediction = linreg_score.predict(pipeline, req.model_dump())
    model_path = Path(settings.ml_models_path) / "linreg_quiz_score.pkl"
    prediction["data_source_warning"] = (
        "Model trained on SYNTHETIC demo data. Integrate real student data for valid predictions."
        if not model_path.exists()
        else "Estimated from available learning history."
    )
    return prediction


@router.post("/predict-risk")
async def predict_risk(
    req: RiskPredictRequest,
    current_user: User = Depends(get_current_user),
):
    """Estimate struggle risk for a topic (Random Forest)."""
    from app.ml import rf_struggle_risk
    model_path = Path(settings.ml_models_path) / "rf_struggle_risk.pkl"
    artifact = _load_model("rf_struggle_risk.pkl")
    if artifact is None:
        data = rf_struggle_risk.generate_synthetic_data()
        result = rf_struggle_risk.train(data)
        rf_struggle_risk.save(result, str(model_path))
        artifact = {"model": result["model"], "label_encoder": result["label_encoder"]}
    # Loaded artifact is already {model, label_encoder} — validate keys
    if "model" not in artifact:
        data = rf_struggle_risk.generate_synthetic_data()
        result = rf_struggle_risk.train(data)
        rf_struggle_risk.save(result, str(model_path))
        artifact = {"model": result["model"], "label_encoder": result["label_encoder"]}

    features = req.model_dump()
    features.pop("topic_name", None)
    return rf_struggle_risk.predict(artifact, features)


@router.post("/spaced-repetition")
async def spaced_repetition_schedule(
    req: SRSRequest,
    current_user: User = Depends(get_current_user),
):
    """Calculate next review date using SM-2 spaced repetition."""
    return spaced_repetition.sm2_update(
        performance_score=req.performance_score,
        confidence=req.confidence,
        repetition_number=req.repetition_number,
        easiness_factor=req.easiness_factor,
        previous_interval_days=req.previous_interval_days,
    )


@router.post("/train-all")
async def train_all_models(current_user: User = Depends(get_current_user)):
    """
    Train all ML models on synthetic demo data.
    Call this endpoint to initialize models before real data is available.
    Returns evaluation metrics for each model.
    """
    from app.ml import linreg_score, dtree_difficulty, rf_struggle_risk, kmeans_clusters
    models_path = Path(settings.ml_models_path)
    results = {}

    # Linear Regression
    data_lr = linreg_score.generate_synthetic_data()
    r = linreg_score.train(data_lr)
    linreg_score.save(r["pipeline"], str(models_path / "linreg_quiz_score.pkl"))
    results["linreg"] = {**r["metrics"], "data": "SYNTHETIC_DEMO"}

    # Decision Tree
    data_dt = dtree_difficulty.generate_synthetic_data()
    r = dtree_difficulty.train(data_dt)
    dtree_difficulty.save(r, str(models_path / "dtree_difficulty.pkl"))
    results["dtree"] = {**r["metrics"], "data": "SYNTHETIC_DEMO"}

    # Random Forest
    data_rf = rf_struggle_risk.generate_synthetic_data()
    r = rf_struggle_risk.train(data_rf)
    rf_struggle_risk.save(r, str(models_path / "rf_struggle_risk.pkl"))
    results["random_forest"] = {**r["metrics"], "data": "SYNTHETIC_DEMO"}

    # K-Means
    data_km = kmeans_clusters.generate_synthetic_data()
    r = kmeans_clusters.train(data_km)
    kmeans_clusters.save(r, str(models_path / "kmeans_learners.pkl"))
    results["kmeans"] = {**r["metrics"], "data": "SYNTHETIC_DEMO"}

    return {
        "status": "All models trained on SYNTHETIC demo data",
        "warning": "Replace with real student data for production use.",
        "results": results,
    }


class AnalyzeTopicRequest(BaseModel):
    topic_name: str
    mastery_score: Optional[float] = None
    quiz_accuracy: Optional[float] = None
    attempts: Optional[int] = None
    avg_response_time: Optional[float] = None


@router.get("/diagnostic/report")
async def get_diagnostic_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run Knowledge Gap & Misconception Detector for the authenticated user.
    Combines Decision Tree classification, Topic Dependency Graph traversal,
    and Rule-Based Cognitive Diagnosis.
    """
    from app.ml.knowledge_gap_detector import KnowledgeGapAndMisconceptionDetector

    # Fetch real user masteries from DB
    masteries = await crud.list_masteries(db, current_user.id)
    student_masteries: dict = {}
    for m in masteries:
        student_masteries[m.topic_name] = {
            "mastery_score": m.mastery_score,
            "quiz_accuracy": m.quiz_accuracy,
            "attempts": m.attempts,
            "avg_response_time": 35.0,
        }

    detector = KnowledgeGapAndMisconceptionDetector(Path(settings.ml_models_path))
    return detector.run_full_diagnosis(student_masteries)


@router.post("/diagnostic/analyze-topic")
async def analyze_topic(
    req: AnalyzeTopicRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze a single topic using Decision Tree, Dependency Graph, and Rule-Based Diagnosis."""
    from app.ml.knowledge_gap_detector import (
        KnowledgeGapAndMisconceptionDetector,
        predict_gap_state,
        RuleBasedDiagnosticEngine,
    )

    detector = KnowledgeGapAndMisconceptionDetector(Path(settings.ml_models_path))
    mastery = req.mastery_score if req.mastery_score is not None else 0.45
    accuracy = req.quiz_accuracy if req.quiz_accuracy is not None else 0.45
    attempts = req.attempts if req.attempts is not None else 2
    avg_time = req.avg_response_time if req.avg_response_time is not None else 35.0

    prereq_health = detector.graph.calculate_prerequisite_health(req.topic_name, {req.topic_name: mastery})
    root_causes = detector.graph.detect_root_cause_gaps(req.topic_name, {req.topic_name: mastery})
    downstream_risks = detector.graph.predict_downstream_risks(req.topic_name)

    features = {
        "mastery_score": mastery,
        "quiz_accuracy": accuracy,
        "attempts": attempts,
        "error_frequency": round(1.0 - accuracy, 3),
        "avg_response_time": avg_time,
        "prerequisite_mastery": prereq_health,
        "complexity_level": detector.graph.nodes.get(req.topic_name, {}).get("complexity", 2),
    }

    tree_pred = predict_gap_state(detector.tree_artifact, features)
    rule_diagnoses = RuleBasedDiagnosticEngine.diagnose_topic(
        topic_name=req.topic_name,
        mastery_score=mastery,
        quiz_accuracy=accuracy,
        attempts=attempts,
        avg_response_time=avg_time,
        prerequisite_health=prereq_health,
        root_causes=root_causes,
    )

    return {
        "topic": req.topic_name,
        "decision_tree": tree_pred,
        "prerequisite_health": round(prereq_health * 100, 1),
        "root_causes": root_causes,
        "downstream_risks": downstream_risks,
        "rule_diagnoses": rule_diagnoses,
    }


@router.get("/diagnostic/dependency-graph")
async def get_dependency_graph(
    current_user: User = Depends(get_current_user),
):
    """Retrieve full curriculum topic dependency graph topology."""
    from app.ml.knowledge_gap_detector import build_default_curriculum_graph
    g = build_default_curriculum_graph()
    return {
        "nodes": [
            {
                "id": name,
                "label": name,
                "category": meta.get("category", "General"),
                "complexity": meta.get("complexity", 1),
                "description": meta.get("description", ""),
                "prerequisites": g.get_prerequisites(name),
                "dependents": g.get_dependents(name),
            }
            for name, meta in g.nodes.items()
        ],
        "edges": [
            {"source": p, "target": dep}
            for dep, prereqs in g.adj_backward.items()
            for p in prereqs
        ],
        "topological_order": g.get_topological_order(),
    }
