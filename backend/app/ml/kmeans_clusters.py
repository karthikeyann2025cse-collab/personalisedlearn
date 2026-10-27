"""
ML Module D: K-Means Clustering — Learner Performance Groups
=============================================================
Purpose: Explore natural groupings of students with similar study and
         performance patterns to inform instructional design.

Features (X) — standardized before clustering:
  - avg_mastery_score, avg_quiz_accuracy, total_study_hours,
    total_sessions, avg_session_minutes, topics_attempted

IMPORTANT:
- Clusters describe patterns in aggregate data; they do NOT classify
  individual students as 'good' or 'bad' learners.
- Cluster labels are descriptive (derived from centroid analysis),
  not evaluative or permanent.
- Cluster assignments can change as new data is collected.
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline


FEATURE_COLS = [
    "avg_mastery_score", "avg_quiz_accuracy", "total_study_hours",
    "total_sessions", "avg_session_minutes", "topics_attempted",
]


def train(data: pd.DataFrame, n_clusters: int = 4) -> dict:
    X = data[FEATURE_COLS].fillna(0)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("kmeans", KMeans(n_clusters=n_clusters, random_state=42, n_init=10)),
    ])
    pipeline.fit(X)

    labels = pipeline.named_steps["kmeans"].labels_
    sil = silhouette_score(pipeline.named_steps["scaler"].transform(X), labels) if len(set(labels)) > 1 else 0.0

    # Describe clusters from centroids
    scaler = pipeline.named_steps["scaler"]
    centroids = scaler.inverse_transform(pipeline.named_steps["kmeans"].cluster_centers_)
    centroid_df = pd.DataFrame(centroids, columns=FEATURE_COLS)

    return {
        "pipeline": pipeline,
        "metrics": {"silhouette_score": round(sil, 3), "n_clusters": n_clusters},
        "centroid_summary": centroid_df.round(2).to_dict(orient="records"),
    }


def save(result: dict, path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(result["pipeline"], path)


def load(path: str):
    return joblib.load(path)


def predict(pipeline, features: dict) -> dict:
    row = pd.DataFrame([{c: features.get(c, 0) for c in FEATURE_COLS}])
    cluster = int(pipeline.predict(row)[0])
    return {
        "cluster_id": cluster,
        "note": (
            "This cluster assignment describes observed learning patterns "
            "and does not reflect fixed ability or potential."
        ),
    }


def generate_synthetic_data(n: int = 300, random_state: int = 42) -> pd.DataFrame:
    """SYNTHETIC data for demonstration only."""
    rng = np.random.RandomState(random_state)
    return pd.DataFrame({
        "avg_mastery_score": rng.uniform(0, 1, n),
        "avg_quiz_accuracy": rng.uniform(0, 1, n),
        "total_study_hours": rng.uniform(0, 100, n),
        "total_sessions": rng.randint(0, 100, n),
        "avg_session_minutes": rng.uniform(10, 90, n),
        "topics_attempted": rng.randint(1, 30, n),
        "_data_source": "SYNTHETIC_DEMO",
    })


if __name__ == "__main__":
    print("Training K-Means on SYNTHETIC demo data...")
    data = generate_synthetic_data()
    result = train(data)
    print("Metrics:", result["metrics"])
    print("Centroids:", result["centroid_summary"])
    save(result, "ml_models/kmeans_learners.pkl")
