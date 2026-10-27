"""
ML Module A: Linear Regression — Quiz Score Prediction
=======================================================
Purpose: Estimate a student's likely quiz score on a new topic given
         their historical learning features.

Features (X):
  - avg_session_minutes: average daily study session length (minutes)
  - num_sessions: number of completed study sessions
  - prior_mastery_score: average mastery score across all topics (0-1)
  - attempts: total quiz attempts

Target (y): quiz score percent (0-100)

Evaluation: MAE, RMSE, R-squared
Baseline: mean-predictor (always predict the training mean)

IMPORTANT: This model makes ESTIMATED predictions. Outputs should be
           presented as estimates, not guarantees. Correlation between
           study features and quiz scores does NOT imply causation.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline


FEATURE_COLS = ["avg_session_minutes", "num_sessions", "prior_mastery_score", "attempts"]
TARGET_COL = "quiz_score_percent"
MODEL_FILENAME = "linreg_quiz_score.pkl"


def build_pipeline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("model", LinearRegression()),
    ])


def train(data: pd.DataFrame) -> dict:
    """
    Train the linear regression model.
    Returns evaluation metrics and the trained pipeline.
    data must contain columns: FEATURE_COLS + [TARGET_COL]
    """
    assert all(c in data.columns for c in FEATURE_COLS + [TARGET_COL]), \
        f"Missing columns. Required: {FEATURE_COLS + [TARGET_COL]}"

    X = data[FEATURE_COLS].fillna(0)
    y = data[TARGET_COL].fillna(data[TARGET_COL].mean())

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    metrics = evaluate(pipeline, X_test, y_test, baseline_mean=y_train.mean())

    return {"pipeline": pipeline, "metrics": metrics}


def evaluate(pipeline, X_test, y_test, baseline_mean: Optional[float] = None) -> dict:
    y_pred = pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    result = {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r_squared": round(r2, 3),
        "n_test_samples": len(y_test),
    }

    if baseline_mean is not None:
        baseline_pred = np.full(len(y_test), baseline_mean)
        result["baseline_mae"] = round(mean_absolute_error(y_test, baseline_pred), 3)
        result["model_vs_baseline_improvement"] = round(result["baseline_mae"] - mae, 3)

    return result


def save(pipeline, path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, path)


def load(path: str):
    return joblib.load(path)


def predict(pipeline, features: dict) -> dict:
    """
    Predict quiz score for a single student.
    features: dict with keys matching FEATURE_COLS.
    Returns estimated score and a confidence note.
    """
    row = pd.DataFrame([{c: features.get(c, 0) for c in FEATURE_COLS}])
    score = float(pipeline.predict(row)[0])
    score = max(0.0, min(100.0, score))
    return {
        "estimated_quiz_score": round(score, 1),
        "note": (
            "This is a statistical ESTIMATE based on historical patterns. "
            "It is not a guarantee of future performance."
        ),
    }


# ─── Synthetic demo data ──────────────────────────────────────────────────────

def generate_synthetic_data(n: int = 200, random_state: int = 42) -> pd.DataFrame:
    """
    Generate synthetic training data for demonstration.
    IMPORTANT: This data is SYNTHETIC and for demonstration only.
    Do NOT use predictions from this data in production decisions.
    """
    rng = np.random.RandomState(random_state)
    avg_session = rng.uniform(10, 120, n)
    num_sessions = rng.randint(1, 50, n)
    prior_mastery = rng.uniform(0, 1, n)
    attempts = rng.randint(1, 30, n)

    # Simulated relationship (not a real causal model)
    score = (
        0.3 * avg_session
        + 0.5 * num_sessions
        + 30 * prior_mastery
        + 0.4 * attempts
        + rng.normal(0, 10, n)
    )
    score = np.clip(score, 0, 100)

    return pd.DataFrame({
        "avg_session_minutes": avg_session,
        "num_sessions": num_sessions,
        "prior_mastery_score": prior_mastery,
        "attempts": attempts,
        "quiz_score_percent": score,
        "_data_source": "SYNTHETIC_DEMO",
    })


if __name__ == "__main__":
    print("Training Linear Regression model on SYNTHETIC demo data...")
    data = generate_synthetic_data()
    result = train(data)
    print(f"Metrics: {result['metrics']}")
    save(result["pipeline"], "ml_models/linreg_quiz_score.pkl")
    print("Model saved to ml_models/linreg_quiz_score.pkl")
