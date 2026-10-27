"""
ML Module: Knowledge Gap & Misconception Detector
==================================================
Combines three complementary technologies:
1. Decision Tree Classifier: Evaluates quantitative mastery, error frequency, speed, and prerequisite health
   to categorize learner state into [MASTERED, KNOWLEDGE_GAP, MISCONCEPTION, PREREQUISITE_BLOCKED]
   with interpretable decision tree paths.
2. Topic Dependency Graph (DAG): Directed acyclic graph traversal (topological sort, DFS/BFS)
   to pinpoint root-cause prerequisite gaps and predict downstream vulnerability cascades.
3. Rule-Based Cognitive Diagnosis: Pedagogical rules that inspect specific error patterns,
   speed-accuracy anomalies, and distractor selections to deliver actionable remediation plans.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier, export_text

# ─── Constants & Features ─────────────────────────────────────────────────────

FEATURE_COLS = [
    "mastery_score",            # 0.0 – 1.0 (continuous)
    "quiz_accuracy",            # 0.0 – 1.0 (continuous)
    "attempts",                 # integer count
    "error_frequency",          # 0.0 – 1.0 (1 - accuracy)
    "avg_response_time",        # seconds per question
    "prerequisite_mastery",     # 0.0 – 1.0 (mean mastery of upstream nodes)
    "complexity_level",         # 1: fundamental, 2: intermediate, 3: advanced
]

TARGET_COL = "diagnostic_state"
CLASSES = ["MASTERED", "KNOWLEDGE_GAP", "MISCONCEPTION", "PREREQUISITE_BLOCKED"]
MODEL_FILENAME = "dtree_gap_detector.pkl"


# ─── 1. Decision Tree Gap Classifier ──────────────────────────────────────────

def train_gap_classifier(data: pd.DataFrame) -> dict:
    """Train an interpretable Decision Tree for Knowledge Gap & Misconception classification."""
    X = data[FEATURE_COLS].fillna(0)
    y = data[TARGET_COL]

    le = LabelEncoder()
    le.fit(CLASSES)
    y_enc = le.transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    model = DecisionTreeClassifier(
        max_depth=4,
        min_samples_leaf=4,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    report = classification_report(y_test, y_pred, target_names=le.classes_, output_dict=True)
    acc = accuracy_score(y_test, y_pred)
    tree_rules = export_text(model, feature_names=FEATURE_COLS)

    return {
        "model": model,
        "label_encoder": le,
        "metrics": {
            "accuracy": round(acc, 3),
            "classification_report": report,
        },
        "tree_rules": tree_rules,
        "feature_importances": {
            col: round(float(imp), 3)
            for col, imp in zip(FEATURE_COLS, model.feature_importances_)
        },
    }


def save_artifact(result: dict, path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": result["model"], "label_encoder": result["label_encoder"]}, path)


def load_artifact(path: str) -> dict:
    return joblib.load(path)


def predict_gap_state(artifact: dict, features: dict) -> dict:
    """Classify a concept using the Decision Tree and trace its path."""
    model: DecisionTreeClassifier = artifact["model"]
    le: LabelEncoder = artifact["label_encoder"]

    row_data = {c: float(features.get(c, 0.0)) for c in FEATURE_COLS}
    row_df = pd.DataFrame([row_data])

    pred_enc = model.predict(row_df)[0]
    proba = model.predict_proba(row_df)[0]
    label = le.inverse_transform([pred_enc])[0]

    # Trace decision tree path for full transparency
    node_indicator = model.decision_path(row_df)
    leaf_id = model.apply(row_df)[0]
    feature = model.tree_.feature
    threshold = model.tree_.threshold

    path_steps = []
    node_index = node_indicator.indices[node_indicator.indptr[0]:node_indicator.indptr[1]]
    for node_id in node_index:
        if leaf_id == node_id:
            continue
        feat_name = FEATURE_COLS[feature[node_id]]
        val = row_data[feat_name]
        thresh = threshold[node_id]
        comp = "<=" if val <= thresh else ">"
        path_steps.append(f"{feat_name} ({val:.2f}) {comp} {thresh:.2f}")

    return {
        "predicted_state": label,
        "confidence": round(float(max(proba)), 3),
        "probabilities": {cls: round(float(p), 3) for cls, p in zip(le.classes_, proba)},
        "decision_path": " ➔ ".join(path_steps) if path_steps else "Direct rule leaf",
    }


def generate_synthetic_diagnostic_data(n: int = 400, random_state: int = 42) -> pd.DataFrame:
    """Generate synthetic training data mirroring cognitive learning patterns."""
    rng = np.random.RandomState(random_state)
    records = []

    for _ in range(n):
        # Sample realistic distributions
        prereq = rng.uniform(0.1, 1.0)
        attempts = rng.randint(1, 15)
        complexity = rng.choice([1, 2, 3])
        response_time = rng.uniform(10, 110)

        # Behavioral modes
        coin = rng.rand()
        if coin < 0.28:
            # MASTERED: high prerequisite, high accuracy, moderate time
            accuracy = rng.uniform(0.78, 1.0)
            mastery = accuracy * 0.95 + rng.uniform(-0.05, 0.05)
            prereq = max(prereq, 0.75)
            state = "MASTERED"
        elif coin < 0.52:
            # PREREQUISITE_BLOCKED: upstream prerequisite is failing
            prereq = rng.uniform(0.1, 0.48)
            accuracy = rng.uniform(0.2, 0.55)
            mastery = accuracy * 0.8
            state = "PREREQUISITE_BLOCKED"
        elif coin < 0.76:
            # MISCONCEPTION: low accuracy, fast or moderate responses, repeated errors
            prereq = rng.uniform(0.55, 0.95)
            accuracy = rng.uniform(0.2, 0.50)
            mastery = accuracy * 0.75
            response_time = rng.uniform(12, 35)  # fast confident errors
            state = "MISCONCEPTION"
        else:
            # KNOWLEDGE_GAP: low attempts or slow hesitation, low accuracy
            accuracy = rng.uniform(0.1, 0.45)
            mastery = rng.uniform(0.05, 0.40)
            response_time = rng.uniform(65, 120)  # hesitation stalling
            state = "KNOWLEDGE_GAP"

        mastery = float(np.clip(mastery, 0.0, 1.0))
        accuracy = float(np.clip(accuracy, 0.0, 1.0))
        error_freq = float(np.clip(1.0 - accuracy, 0.0, 1.0))

        records.append({
            "mastery_score": round(mastery, 3),
            "quiz_accuracy": round(accuracy, 3),
            "attempts": attempts,
            "error_frequency": round(error_freq, 3),
            "avg_response_time": round(response_time, 1),
            "prerequisite_mastery": round(prereq, 3),
            "complexity_level": complexity,
            "diagnostic_state": state,
        })

    return pd.DataFrame(records)


# ─── 2. Topic Dependency Graph (DAG) ──────────────────────────────────────────

class TopicDependencyGraph:
    """
    Directed Acyclic Graph (DAG) of Concepts & Prerequisites.
    Edge A -> B means A is a prerequisite for B.
    """

    def __init__(self):
        self.nodes: Dict[str, dict] = {}
        self.adj_forward: Dict[str, Set[str]] = {}   # topic -> dependent topics
        self.adj_backward: Dict[str, Set[str]] = {}  # topic -> prerequisite topics

    def add_topic(self, topic: str, category: str = "General", complexity: int = 1, description: str = ""):
        if topic not in self.nodes:
            self.nodes[topic] = {
                "name": topic,
                "category": category,
                "complexity": complexity,
                "description": description,
            }
            self.adj_forward[topic] = set()
            self.adj_backward[topic] = set()

    def add_prerequisite(self, topic: str, prerequisite: str):
        self.add_topic(topic)
        self.add_topic(prerequisite)
        self.adj_backward[topic].add(prerequisite)
        self.adj_forward[prerequisite].add(topic)

    def get_prerequisites(self, topic: str) -> List[str]:
        return sorted(list(self.adj_backward.get(topic, set())))

    def get_dependents(self, topic: str) -> List[str]:
        return sorted(list(self.adj_forward.get(topic, set())))

    def calculate_prerequisite_health(self, topic: str, user_masteries: Dict[str, float]) -> float:
        """Mean mastery of all direct prerequisites for this topic (1.0 if no prerequisites)."""
        prereqs = self.get_prerequisites(topic)
        if not prereqs:
            return 1.0
        scores = [user_masteries.get(p, 0.3) for p in prereqs]
        return round(float(np.mean(scores)), 3)

    def detect_root_cause_gaps(self, topic: str, user_masteries: Dict[str, float], threshold: float = 0.65) -> List[dict]:
        """
        Traverse backward from an unmastered topic to locate foundational root-cause gaps.
        Returns ordered list of root-cause prerequisite topics that must be remediated.
        """
        root_causes = []
        visited = set()
        queue = deque([(topic, 0)])

        while queue:
            curr, depth = queue.popleft()
            if curr in visited:
                continue
            visited.add(curr)

            prereqs = self.get_prerequisites(curr)
            for p in prereqs:
                score = user_masteries.get(p, 0.3)
                if score < threshold:
                    root_causes.append({
                        "topic": p,
                        "mastery_score": round(score, 2),
                        "distance_upstream": depth + 1,
                        "blocking_target": curr,
                        "severity": "CRITICAL" if score < 0.45 else "MODERATE",
                    })
                    queue.append((p, depth + 1))

        # Sort by distance upstream (deepest first) then score
        root_causes.sort(key=lambda x: (-x["distance_upstream"], x["mastery_score"]))
        return root_causes

    def predict_downstream_risks(self, weak_topic: str) -> List[str]:
        """Traverse forward to identify future topics endangered by this gap."""
        risks = []
        visited = set()
        queue = deque([weak_topic])

        while queue:
            curr = queue.popleft()
            for dep in self.get_dependents(curr):
                if dep not in visited:
                    visited.add(dep)
                    risks.append(dep)
                    queue.append(dep)

        return risks

    def get_topological_order(self) -> List[str]:
        """Kahn's algorithm for topological sorting."""
        in_degree = {n: len(self.adj_backward[n]) for n in self.nodes}
        queue = deque([n for n, deg in in_degree.items() if deg == 0])
        ordered = []

        while queue:
            node = queue.popleft()
            ordered.append(node)
            for dep in self.adj_forward[node]:
                in_degree[dep] -= 1
                if in_degree[dep] == 0:
                    queue.append(dep)

        # Include remaining nodes if cyclic fallback
        for n in self.nodes:
            if n not in ordered:
                ordered.append(n)
        return ordered


def build_default_curriculum_graph() -> TopicDependencyGraph:
    """Pre-built STEM / AI & Data Science Concept Dependency Graph."""
    graph = TopicDependencyGraph()

    # Level 1 Foundations
    graph.add_topic("Linear Algebra & Vectors", "Foundations", 1, "Vector spaces, dot products, matrix transformations.")
    graph.add_topic("Calculus & Gradients", "Foundations", 1, "Partial derivatives, chain rule, multidimensional gradients.")
    graph.add_topic("Probability & Statistics", "Foundations", 1, "Random variables, Bayes rule, distributions, variance.")

    # Level 2 Core ML
    graph.add_topic("Loss Functions & Optimization", "Core ML", 2, "MSE, cross-entropy, SGD, Adam optimization.")
    graph.add_prerequisite("Loss Functions & Optimization", "Calculus & Gradients")
    graph.add_prerequisite("Loss Functions & Optimization", "Linear Algebra & Vectors")

    graph.add_topic("Supervised Learning & Regression", "Core ML", 2, "Linear/logistic models, decision boundaries, overfitting.")
    graph.add_prerequisite("Supervised Learning & Regression", "Linear Algebra & Vectors")
    graph.add_prerequisite("Supervised Learning & Regression", "Probability & Statistics")

    # Level 3 Deep Learning
    graph.add_topic("Neural Network Architectures", "Deep Learning", 2, "Multi-layer perceptrons, forward propagation, activations.")
    graph.add_prerequisite("Neural Network Architectures", "Loss Functions & Optimization")

    graph.add_topic("Backpropagation & Computational Graphs", "Deep Learning", 3, "Reverse-mode automatic differentiation, gradient updates.")
    graph.add_prerequisite("Backpropagation & Computational Graphs", "Calculus & Gradients")
    graph.add_prerequisite("Backpropagation & Computational Graphs", "Neural Network Architectures")

    # Level 4 Advanced AI
    graph.add_topic("Transformer & Attention Mechanisms", "Advanced AI", 3, "Scaled dot-product attention, multi-head layers, embeddings.")
    graph.add_prerequisite("Transformer & Attention Mechanisms", "Neural Network Architectures")
    graph.add_prerequisite("Transformer & Attention Mechanisms", "Backpropagation & Computational Graphs")

    graph.add_topic("Large Language Model Alignment", "Advanced AI", 3, "RLHF, instruction tuning, prompt reasoning, safety.")
    graph.add_prerequisite("Large Language Model Alignment", "Transformer & Attention Mechanisms")

    return graph


# ─── 3. Rule-Based Cognitive Diagnosis Engine ─────────────────────────────────

KNOWN_MISCONCEPTIONS_DATABASE: Dict[str, List[dict]] = {
    "Linear Algebra & Vectors": [
        {
            "id": "m_la_1",
            "title": "Matrix Multiplication Non-Commutativity Confusion",
            "student_mental_model": "Assumes matrix multiplication is commutative (A × B = B × A) like scalar arithmetic.",
            "correct_principle": "Matrix multiplication is non-commutative in general: A × B ≠ B × A due to dimensional projection ordering.",
            "distractor_signature": "commutation_error",
            "prescriptive_action": "Practice calculating 2x2 asymmetric matrix products in both orders to visually witness differing outcomes.",
            "ai_tutor_prompt": "Explain why matrix multiplication is not commutative using a simple 2x2 coordinate transformation example.",
        }
    ],
    "Calculus & Gradients": [
        {
            "id": "m_calc_1",
            "title": "Gradient Descent Direction Inversion",
            "student_mental_model": "Adds the gradient to update weights instead of subtracting, causing loss divergence.",
            "correct_principle": "The gradient ∇L points in the direction of steepest ascent; to minimize loss, parameters must move in the opposite direction (-η∇L).",
            "distractor_signature": "gradient_sign_inversion",
            "prescriptive_action": "Draw a 1D convex parabola and observe why moving in the positive derivative direction climbs up the hill instead of down.",
            "ai_tutor_prompt": "Walk me through why gradient descent subtracts the gradient rather than adding it, with an intuitive hill-descent analogy.",
        }
    ],
    "Loss Functions & Optimization": [
        {
            "id": "m_opt_1",
            "title": "Loss vs Accuracy Conflation",
            "student_mental_model": "Believes lower cross-entropy loss always guarantees higher classification accuracy on small batches.",
            "correct_principle": "Loss is a smooth, continuous surrogate measure; accuracy is a non-differentiable step function. A model can become more confident without changing discrete accuracy.",
            "distractor_signature": "loss_acc_conflation",
            "prescriptive_action": "Analyze probability calibration charts showing confident incorrect vs unconfident correct predictions.",
            "ai_tutor_prompt": "Explain the difference between cross-entropy loss and classification accuracy, and why loss is used for backpropagation instead of accuracy.",
        }
    ],
    "Neural Network Architectures": [
        {
            "id": "m_nn_1",
            "title": "Vanishing Non-Linearity Illusion",
            "student_mental_model": "Believes stacking linear layers without activation functions can model complex non-linear curves.",
            "correct_principle": "A composition of arbitrary linear transformations W2(W1·x) reduces algebraically to a single linear layer W_combined·x.",
            "distractor_signature": "linear_composition_error",
            "prescriptive_action": "Multiply two linear 2x2 weight matrices and verify that the combined operation is identical to a single linear transform.",
            "ai_tutor_prompt": "Why can a neural network with 100 linear layers only represent a linear function? Show the math simply.",
        }
    ],
    "Backpropagation & Computational Graphs": [
        {
            "id": "m_bp_1",
            "title": "Chain Rule Branch Summation Neglect",
            "student_mental_model": "Computes gradient down only one branch when a variable is reused in multiple graph paths.",
            "correct_principle": "Multivariate chain rule requires summing gradients across ALL paths where the variable affects the loss: dL/dx = Σ (dL/dy_i · dy_i/dx).",
            "distractor_signature": "single_branch_gradient",
            "prescriptive_action": "Trace a computational graph with variable sharing (e.g., skip connection or residual branch) and sum both pathway partials.",
            "ai_tutor_prompt": "Demonstrate the multivariate chain rule on a computation graph where x splits into two intermediate nodes.",
        }
    ],
    "Transformer & Attention Mechanisms": [
        {
            "id": "m_tf_1",
            "title": "Attention Scaling Factor Misunderstanding",
            "student_mental_model": "Believes dividing by √d_k is just normalization without understanding its numerical stability role.",
            "correct_principle": "For large d_k, dot products grow large, pushing the Softmax function into regions with near-zero gradients (saturation). √d_k maintains unit variance.",
            "distractor_signature": "softmax_saturation_blindness",
            "prescriptive_action": "Plot the derivative of Softmax for large input values to observe how extreme values destroy learning gradients.",
            "ai_tutor_prompt": "Why is scaled dot-product attention divided by the square root of key dimension d_k? What happens to the Softmax gradient if we omit it?",
        }
    ],
}


class RuleBasedDiagnosticEngine:
    """Evaluates rule-based cognitive criteria to identify misconceptions and learning bottlenecks."""

    @staticmethod
    def diagnose_topic(
        topic_name: str,
        mastery_score: float,
        quiz_accuracy: float,
        attempts: int,
        avg_response_time: float,
        prerequisite_health: float,
        root_causes: List[dict],
    ) -> List[dict]:
        diagnoses = []

        # Rule 1: Upstream Dependency Cascade
        if prerequisite_health < 0.60 and (mastery_score < 0.65 or quiz_accuracy < 0.60):
            blocker = root_causes[0]["topic"] if root_causes else "Foundational Prerequisites"
            diagnoses.append({
                "rule_id": "RULE_PREREQ_CASCADE",
                "severity": "CRITICAL",
                "title": f"Upstream Dependency Deficit in {blocker}",
                "explanation": (
                    f"Your struggle in '{topic_name}' is heavily rooted in foundational gaps within '{blocker}'. "
                    f"Attempting advanced problems before mastering '{blocker}' causes high cognitive strain."
                ),
                "prescriptive_action": f"Pause '{topic_name}'. Review and pass a diagnostic quiz on '{blocker}' first.",
                "ai_tutor_prompt": f"Explain the core connection between {blocker} and {topic_name}, and how understanding {blocker} simplifies {topic_name}.",
            })

        # Rule 2: Impulsive Answering / Speed-Accuracy Tradeoff
        if avg_response_time < 18.0 and (quiz_accuracy < 0.55 or mastery_score < 0.55):
            diagnoses.append({
                "rule_id": "RULE_IMPULSIVE_HEURISTIC",
                "severity": "MODERATE",
                "title": "Speed-Accuracy Heuristic Bias",
                "explanation": (
                    f"Your average response time of {avg_response_time:.1f}s indicates fast heuristic guessing. "
                    "You are answering before checking edge cases or question qualifiers."
                ),
                "prescriptive_action": "Apply the 'Read-Twice & Check Boundary' protocol: pause for at least 15 seconds before picking your choice.",
                "ai_tutor_prompt": f"Give me a tricky question on {topic_name} with common tempting traps, and explain how to avoid falling for them.",
            })

        # Rule 3: High Cognitive Load Stalling
        if avg_response_time > 75.0 and quiz_accuracy < 0.55:
            diagnoses.append({
                "rule_id": "RULE_COGNITIVE_STALL",
                "severity": "MODERATE",
                "title": "Working Memory Saturation",
                "explanation": (
                    f"Taking {avg_response_time:.1f}s per question indicates cognitive hesitation and memory overload. "
                    "The underlying schema has not been proceduralized into working memory."
                ),
                "prescriptive_action": "Break questions into scaffolded 2-step chunks using worked-example study pairs.",
                "ai_tutor_prompt": f"Break down the primary algorithm of {topic_name} into 3 ultra-simple bite-sized steps.",
            })

        # Rule 4: Fragile Rote Memorization
        if attempts >= 4 and abs(quiz_accuracy - mastery_score) > 0.25:
            diagnoses.append({
                "rule_id": "RULE_FRAGILE_ROTE",
                "severity": "LOW",
                "title": "Fragile Retention & Variance",
                "explanation": "High repetition with fluctuating scores points to rote memorization rather than deep conceptual grounding.",
                "prescriptive_action": "Engage in the Feynman Technique: explain the mechanism in plain English without consulting reference text.",
                "ai_tutor_prompt": f"Test me on {topic_name} using an applied real-world scenario rather than a textbook definition.",
            })

        # Add domain-specific known misconceptions from the knowledge base
        known = KNOWN_MISCONCEPTIONS_DATABASE.get(topic_name, [])
        for item in known:
            if mastery_score < 0.75:
                diagnoses.append({
                    "rule_id": item["id"],
                    "severity": "CRITICAL" if mastery_score < 0.50 else "MODERATE",
                    "title": item["title"],
                    "explanation": f"Detected conceptual trap: {item['student_mental_model']} Reality: {item['correct_principle']}",
                    "prescriptive_action": item["prescriptive_action"],
                    "ai_tutor_prompt": item["ai_tutor_prompt"],
                })

        return diagnoses


# ─── Integrated Diagnostic Engine ─────────────────────────────────────────────

class KnowledgeGapAndMisconceptionDetector:
    """
    Unified Orchestrator:
    Harmonizes Decision Tree inference, Dependency Graph analysis, and Rule-Based Diagnosis.
    """

    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.graph = build_default_curriculum_graph()
        self.tree_artifact = self._load_or_train_tree()

    def _load_or_train_tree(self) -> dict:
        model_path = self.models_dir / MODEL_FILENAME
        if model_path.exists():
            try:
                art = load_artifact(str(model_path))
                if "model" in art and "label_encoder" in art:
                    return art
            except Exception:
                pass

        data = generate_synthetic_diagnostic_data()
        res = train_gap_classifier(data)
        save_artifact(res, str(model_path))
        return {"model": res["model"], "label_encoder": res["label_encoder"]}

    def run_full_diagnosis(self, student_masteries: Dict[str, dict]) -> dict:
        """
        Runs complete diagnostic analysis across all topics in the dependency graph.
        student_masteries: dict mapping topic_name -> {
            "mastery_score": float (0-1),
            "quiz_accuracy": float (0-1),
            "attempts": int,
            "avg_response_time": float,
        }
        """
        user_scores = {
            t: student_masteries.get(t, {}).get("mastery_score", 0.40)
            for t in self.graph.nodes
        }

        topological_order = self.graph.get_topological_order()
        topic_reports = []
        total_gaps = 0
        total_misconceptions = 0
        total_blocked = 0
        total_mastered = 0

        for topic in topological_order:
            node_meta = self.graph.nodes.get(topic, {})
            user_data = student_masteries.get(topic, {})

            mastery = float(user_data.get("mastery_score", 0.45))
            accuracy = float(user_data.get("quiz_accuracy", 0.45))
            attempts = int(user_data.get("attempts", 1))
            avg_time = float(user_data.get("avg_response_time", 40.0))
            complexity = node_meta.get("complexity", 1)

            # 1. Dependency Graph Metrics
            prereq_health = self.graph.calculate_prerequisite_health(topic, user_scores)
            prereqs = self.graph.get_prerequisites(topic)
            dependents = self.graph.get_dependents(topic)
            root_causes = self.graph.detect_root_cause_gaps(topic, user_scores)
            downstream_risks = self.graph.predict_downstream_risks(topic) if mastery < 0.65 else []

            # 2. Decision Tree Prediction
            features = {
                "mastery_score": mastery,
                "quiz_accuracy": accuracy,
                "attempts": attempts,
                "error_frequency": round(1.0 - accuracy, 3),
                "avg_response_time": avg_time,
                "prerequisite_mastery": prereq_health,
                "complexity_level": complexity,
            }
            tree_pred = predict_gap_state(self.tree_artifact, features)

            # 3. Rule-Based Diagnosis
            rule_diagnoses = RuleBasedDiagnosticEngine.diagnose_topic(
                topic_name=topic,
                mastery_score=mastery,
                quiz_accuracy=accuracy,
                attempts=attempts,
                avg_response_time=avg_time,
                prerequisite_health=prereq_health,
                root_causes=root_causes,
            )

            # Determine overall synthesized status
            pred_state = tree_pred["predicted_state"]
            if pred_state == "MASTERED" and mastery >= 0.75:
                status = "mastered"
                total_mastered += 1
            elif pred_state == "PREREQUISITE_BLOCKED" or (prereq_health < 0.55 and root_causes):
                status = "prerequisite_blocked"
                total_blocked += 1
            elif pred_state == "MISCONCEPTION" or len(rule_diagnoses) > 1:
                status = "misconception_alert"
                total_misconceptions += 1
            else:
                status = "gap_detected"
                total_gaps += 1

            topic_reports.append({
                "topic": topic,
                "category": node_meta.get("category", "General"),
                "complexity": complexity,
                "description": node_meta.get("description", ""),
                "status": status,
                "mastery_score": round(mastery * 100, 1),
                "quiz_accuracy": round(accuracy * 100, 1),
                "attempts": attempts,
                "avg_response_time": avg_time,
                "prerequisites": prereqs,
                "prerequisite_health": round(prereq_health * 100, 1),
                "dependents": dependents,
                "root_causes": root_causes,
                "downstream_risks": downstream_risks,
                "decision_tree": tree_pred,
                "rule_diagnoses": rule_diagnoses,
            })

        # Calculate student readiness index
        total_concepts = len(topological_order)
        health_index = round((total_mastered / total_concepts * 100) if total_concepts else 0, 1)

        return {
            "summary": {
                "total_concepts": total_concepts,
                "mastered_count": total_mastered,
                "knowledge_gaps_count": total_gaps,
                "active_misconceptions_count": total_misconceptions,
                "prerequisite_blocked_count": total_blocked,
                "readiness_index": health_index,
            },
            "topics": topic_reports,
            "dependency_edges": [
                {"from": p, "to": dep}
                for dep, prereqs in self.graph.adj_backward.items()
                for p in prereqs
            ],
        }
