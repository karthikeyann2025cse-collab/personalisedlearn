"""
ML Module B: Decision Tree Classifier — Topic Difficulty Category
=================================================================
Purpose: Classify a topic as 'easy', 'moderate', or 'challenging'
         for a specific student based on their observable learning features.

Features (X):
  - mastery_score: current mastery score (0-1)
  - quiz_accuracy: quiz accuracy on topic (0-1)
  - attempts: number of quiz attempts
  - avg_time_per_question: average seconds per question
  - prerequisite_mastery: average mastery of prerequisite topics (0-1)

Target (y): difficulty_category — 'easy' | 'moderate' | 'challenging'

The Decision Tree is intentionally kept interpretable (max_depth=4)
so that the classification rules can be explained to students and educators.

Evaluation: Accuracy, precision, recall, F1-score (weighted)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


FEATURE_COLS = ["mastery_score", "quiz_accuracy", "attempts", "avg_time_per_question", "prerequisite_mastery"]
TARGET_COL = "difficulty_category"
CLASSES = ["easy", "moderate", "challenging"]
MODEL_FILENAME = "dtree_difficulty.pkl"


def train(data: pd.DataFrame) -> dict:
    X = data[FEATURE_COLS].fillna(0)
    y = data[TARGET_COL]

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(X, y_enc, test_size=0.2, random_state=42, stratify=y_enc)

    model = DecisionTreeClassifier(max_depth=4, min_samples_leaf=5, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    report = classification_report(y_test, y_pred, target_names=le.classes_, output_dict=True)
    acc = accuracy_score(y_test, y_pred)

    # Human-readable rules
    tree_rules = export_text(model, feature_names=FEATURE_COLS)

    return {
        "model": model,
        "label_encoder": le,
        "metrics": {
            "accuracy": round(acc, 3),
            "classification_report": report,
        },
        "tree_rules": tree_rules,
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
        "predicted_difficulty": label,
        "confidence": round(float(max(proba)), 3),
        "probabilities": {cls: round(float(p), 3) for cls, p in zip(le.classes_, proba)},
        "note": "This classification is based on observed learning data and should be used as a guide, not a fixed assessment.",
    }


def generate_synthetic_data(n: int = 300, random_state: int = 42) -> pd.DataFrame:
    """SYNTHETIC data for demonstration only."""
    rng = np.random.RandomState(random_state)
    mastery = rng.uniform(0, 1, n)
    accuracy = mastery * 0.8 + rng.uniform(-0.2, 0.2, n)
    accuracy = np.clip(accuracy, 0, 1)
    attempts = rng.randint(1, 20, n)
    time_per_q = rng.uniform(10, 120, n)
    prereq = rng.uniform(0, 1, n)

    categories = []
    for m, a in zip(mastery, accuracy):
        if m >= 0.75 and a >= 0.7:
            categories.append("easy")
        elif m >= 0.45 or a >= 0.45:
            categories.append("moderate")
        else:
            categories.append("challenging")

    return pd.DataFrame({
        "mastery_score": mastery,
        "quiz_accuracy": accuracy,
        "attempts": attempts,
        "avg_time_per_question": time_per_q,
        "prerequisite_mastery": prereq,
        "difficulty_category": categories,
        "_data_source": "SYNTHETIC_DEMO",
    })


if __name__ == "__main__":
    print("Training Decision Tree on SYNTHETIC demo data...")
    data = generate_synthetic_data()
    result = train(data)
    print(f"Accuracy: {result['metrics']['accuracy']}")
    print("Tree Rules:\n", result["tree_rules"])
    save(result, "ml_models/dtree_difficulty.pkl")
