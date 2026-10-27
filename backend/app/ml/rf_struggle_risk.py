"""
ML Module C: Random Forest Classifier — Struggle Risk Prediction
=================================================================
Purpose: Estimate the risk of a student struggling with a topic.
         Enables proactive intervention before a student falls behind.

Classes: 'low_risk' | 'medium_risk' | 'high_risk'

Features (X):
  - mastery_score, quiz_accuracy, attempts, prerequisite_mastery,
    days_since_last_study, avg_session_minutes, num_sessions_last_7d,
    incorrect_streak (consecutive wrong answers on topic)

Evaluation: Precision, Recall, F1-score, ROC-AUC (one-vs-rest)

IMPORTANT: Risk predictions are probabilistic estimates.
           They must not be used to make definitive statements about
           a student's ability or potential.
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, label_binarize


FEATURE_COLS = [
    "mastery_score", "quiz_accuracy", "attempts", "prerequisite_mastery",
    "days_since_last_study", "avg_session_minutes", "num_sessions_last_7d",
    "incorrect_streak",
]
TARGET_COL = "struggle_risk"
CLASSES = ["low_risk", "medium_risk", "high_risk"]


def train(data: pd.DataFrame) -> dict:
    X = data[FEATURE_COLS].fillna(0)
    y = data[TARGET_COL]

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    model = RandomForestClassifier(
        n_estimators=100, max_depth=8, min_samples_leaf=3,
        random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)

    report = classification_report(y_test, y_pred, target_names=le.classes_, output_dict=True)

    # ROC-AUC (one-vs-rest)
    y_bin = label_binarize(y_test, classes=list(range(len(le.classes_))))
    try:
        roc_auc = roc_auc_score(y_bin, y_proba, multi_class="ovr", average="weighted")
    except Exception:
        roc_auc = None

    importance = pd.Series(model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)

    return {
        "model": model,
        "label_encoder": le,
        "metrics": {
            "classification_report": report,
            "roc_auc_weighted": round(roc_auc, 3) if roc_auc else None,
        },
        "feature_importance": importance.to_dict(),
    }


def save(result: dict, path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": result["model"], "label_encoder": result["label_encoder"]}, path)


def load(path: str) -> dict:
    return joblib.load(path)


def predict(artifact: dict, features: dict) -> dict:
    model = artifact["model"]
    le = artifact["label_encoder"]
    row = pd.DataFrame([{c: features.get(c, 0) for c in FEATURE_COLS}])
    pred_enc = model.predict(row)[0]
    proba = model.predict_proba(row)[0]
    label = le.inverse_transform([pred_enc])[0]
    return {
        "struggle_risk": label,
        "probabilities": {cls: round(float(p), 3) for cls, p in zip(le.classes_, proba)},
        "note": (
            "This is a probabilistic risk estimate based on observed patterns. "
            "It reflects current trends and is not a fixed assessment of ability."
        ),
    }


def generate_synthetic_data(n: int = 400, random_state: int = 42) -> pd.DataFrame:
    """SYNTHETIC data for demonstration only."""
    rng = np.random.RandomState(random_state)
    mastery = rng.uniform(0, 1, n)
    accuracy = np.clip(mastery * 0.8 + rng.normal(0, 0.15, n), 0, 1)
    attempts = rng.randint(0, 25, n)
    prereq = rng.uniform(0, 1, n)
    days_since = rng.randint(0, 30, n)
    session_min = rng.uniform(5, 90, n)
    sessions_7d = rng.randint(0, 14, n)
    incorrect_streak = rng.randint(0, 10, n)

    risk = []
    for m, a, ds, streak in zip(mastery, accuracy, days_since, incorrect_streak):
        score = (1 - m) * 0.4 + (1 - a) * 0.4 + (ds / 30) * 0.1 + (streak / 10) * 0.1
        if score < 0.35:
            risk.append("low_risk")
        elif score < 0.65:
            risk.append("medium_risk")
        else:
            risk.append("high_risk")

    return pd.DataFrame({
        "mastery_score": mastery, "quiz_accuracy": accuracy, "attempts": attempts,
        "prerequisite_mastery": prereq, "days_since_last_study": days_since,
        "avg_session_minutes": session_min, "num_sessions_last_7d": sessions_7d,
        "incorrect_streak": incorrect_streak, "struggle_risk": risk,
        "_data_source": "SYNTHETIC_DEMO",
    })


if __name__ == "__main__":
    print("Training Random Forest on SYNTHETIC demo data...")
    data = generate_synthetic_data()
    result = train(data)
    print("Metrics:", result["metrics"])
    print("Feature importance:", result["feature_importance"])
    save(result, "ml_models/rf_struggle_risk.pkl")
