"""
M5 - Train the diagnostic confidence calibrator and the urgency cross-check.

Usage
-----
    # Inspect the expected input schema and a worked example
    python training/train_calibrator.py --print-schema

    # Train from a labelled case file
    python training/train_calibrator.py --cases training/data/mimic/labelled_cases.jsonl

    # Show the deterministic pillar arithmetic the TypeScript must reproduce
    python training/train_calibrator.py --pillar-demo

Outputs
-------
    training/exports/confidence_calibrator.joblib   calibrator + feature order
    training/exports/urgency_classifier.joblib      urgency cross-check model
    training/out/calibration_m5_report.txt          ECE/Brier + reliability table
    training/out/pillar_weights.json                machine-readable pillar config

The problem this solves
-----------------------
server/agents/doctor.ts currently produces `probabilityScore` like this:

    const cappedScore = idx === 0 ? Math.min(cond.probabilityScore || 50, 55) : ...

That is a prompted convention, not a probability. This script replaces it with a
model whose outputs are measured: it takes features the pipeline ALREADY produces
and learns P(top-1 diagnosis is correct), then calibrates that probability so it
means what it says.

Input schema (one JSON object per line)
---------------------------------------
{
  "case_id": "case-123",
  "top1_correct": 1,                    // label: did the top-1 diagnosis match gold?
  "urgency_true": "urgent",             // label: routine | urgent | emergency
  "features": {
    "max_radiograph_probability": 0.82,
    "flagged_radiograph_findings": 2,
    "critical_lab_count": 1,
    "abnormal_lab_count": 4,
    "organ_systems_flagged": 2,
    "red_flag_count": 2,
    "deranged_vital_count": 3,
    "data_completeness": "partial",     // symptoms_only | partial | complete
    "top_guideline_similarity": 0.71,
    "citation_count_interview": 1,
    "citation_count_radiology": 1,
    "citation_count_lab": 1,
    "citation_count_guideline": 1
  }
}
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np

from mediagent_training.config import (
    CALIBRATION_MODEL_PATH,
    OUT_DIR,
    PILLAR_MAX_WEIGHTS,
    SEED,
    URGENCY_MODEL_PATH,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("calibrator")

COMPLETENESS_LEVELS = ("symptoms_only", "partial", "complete")
URGENCY_LEVELS = ("routine", "urgent", "emergency")

NUMERIC_FEATURES = (
    "max_radiograph_probability",
    "flagged_radiograph_findings",
    "critical_lab_count",
    "abnormal_lab_count",
    "organ_systems_flagged",
    "red_flag_count",
    "deranged_vital_count",
    "top_guideline_similarity",
    "citation_count_interview",
    "citation_count_radiology",
    "citation_count_lab",
    "citation_count_guideline",
)


def print_schema() -> None:
    example = {
        "case_id": "case-123",
        "top1_correct": 1,
        "urgency_true": "urgent",
        "features": {
            "max_radiograph_probability": 0.82,
            "flagged_radiograph_findings": 2,
            "critical_lab_count": 1,
            "abnormal_lab_count": 4,
            "organ_systems_flagged": 2,
            "red_flag_count": 2,
            "deranged_vital_count": 3,
            "data_completeness": "partial",
            "top_guideline_similarity": 0.71,
            "citation_count_interview": 1,
            "citation_count_radiology": 1,
            "citation_count_lab": 1,
            "citation_count_guideline": 1,
        },
    }
    print("Expected JSONL record:")
    print(json.dumps(example, indent=2))
    print()
    print("Numeric features:", ", ".join(NUMERIC_FEATURES))
    print("Categorical: data_completeness in", COMPLETENESS_LEVELS)
    print("Labels: top1_correct (0/1), urgency_true in", URGENCY_LEVELS)
    print()
    print("How to produce labelled cases:")
    print("  1. Run the pipeline over your cases:  POST /api/triage/run")
    print("  2. Have a clinician mark the gold diagnosis and gold urgency")
    print("  3. Extract the features listed above from the stored ClinicalCase")
    print("  4. For MIMIC-IV-ED, map triage_acuity: ESI 1-2 -> emergency,")
    print("     ESI 3 -> urgent, ESI 4-5 -> routine")


def load_cases(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"No labelled cases at {path}\n"
            "Run --print-schema for the expected format."
        )
    cases: list[dict] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                cases.append(json.loads(line))
    if not cases:
        raise ValueError(f"{path} contained no records.")
    return cases


def featurise(cases: list[dict]) -> tuple[np.ndarray, list[str]]:
    """Build the design matrix: numeric features + one-hot data completeness."""
    feature_names: list[str] = list(NUMERIC_FEATURES)
    feature_names += [f"completeness_{level}" for level in COMPLETENESS_LEVELS]

    rows = []
    for case in cases:
        features = case.get("features", {})
        row = [float(features.get(name, 0.0) or 0.0) for name in NUMERIC_FEATURES]
        completeness = str(features.get("data_completeness", "partial"))
        row += [1.0 if completeness == level else 0.0 for level in COMPLETENESS_LEVELS]
        rows.append(row)

    return np.asarray(rows, dtype=np.float64), feature_names


def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    for low, high in zip(bin_edges[:-1], bin_edges[1:]):
        mask = (y_prob > low) & (y_prob <= high)
        if not np.any(mask):
            continue
        ece += (mask.sum() / len(y_true)) * abs(y_true[mask].mean() - y_prob[mask].mean())
    return float(ece)


def reliability_table(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> str:
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    lines = [f"{'bin':<16}{'n':>7}{'mean_pred':>12}{'observed':>12}"]
    lines.append("-" * 47)
    for low, high in zip(bin_edges[:-1], bin_edges[1:]):
        mask = (y_prob > low) & (y_prob <= high)
        count = int(mask.sum())
        if count == 0:
            lines.append(f"{low:.1f}-{high:.1f}{'':<9}{count:>7}{'--':>12}{'--':>12}")
        else:
            lines.append(
                f"{low:.1f}-{high:.1f}{'':<9}{count:>7}{y_prob[mask].mean():>12.3f}"
                f"{y_true[mask].mean():>12.3f}"
            )
    return "\n".join(lines)


def train_confidence_calibrator(cases: list[dict]) -> dict:
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import train_test_split

    if not all("top1_correct" in case for case in cases):
        raise ValueError("Every case needs a 'top1_correct' label (0 or 1).")

    matrix, feature_names = featurise(cases)
    labels = np.asarray([int(case["top1_correct"]) for case in cases])

    if len(np.unique(labels)) < 2:
        raise ValueError("All labels are identical; cannot train a calibrator.")

    train_x, test_x, train_y, test_y = train_test_split(
        matrix, labels, test_size=0.30, random_state=SEED, stratify=labels
    )

    # Gradient boosting for discrimination, then isotonic calibration on a
    # held-out fold. Isotonic is preferred over Platt here because the raw GBM
    # scores are over-confident in a non-sigmoidal way.
    base = GradientBoostingClassifier(random_state=SEED, n_estimators=200, max_depth=3)
    base.fit(train_x, train_y)

    calibrator = CalibratedClassifierCV(base, method="isotonic", cv=5)
    calibrator.fit(train_x, train_y)

    calibrated = calibrator.predict_proba(test_x)[:, 1]

    metrics = {
        "n_cases": len(cases),
        "n_train": len(train_x),
        "n_test": len(test_x),
        "auc_calibrated": round(float(roc_auc_score(test_y, calibrated)), 4),
        "brier_calibrated": round(float(brier_score_loss(test_y, calibrated)), 4),
        "ece_calibrated": round(expected_calibration_error(test_y, calibrated), 4),
    }

    # Baseline: what the current prompted heuristic effectively does.
    heuristic = np.full_like(test_y, 0.55, dtype=float)
    metrics["brier_baseline_constant_55"] = round(float(brier_score_loss(test_y, heuristic)), 4)
    metrics["ece_baseline_constant_55"] = round(expected_calibration_error(test_y, heuristic), 4)

    reliability = reliability_table(test_y, calibrated)

    import joblib
    CALIBRATION_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": calibrator,
            "feature_names": feature_names,
            "numeric_features": list(NUMERIC_FEATURES),
            "completeness_levels": list(COMPLETENESS_LEVELS),
        },
        CALIBRATION_MODEL_PATH,
    )
    logger.info("Saved confidence calibrator to %s", CALIBRATION_MODEL_PATH)

    simple = LogisticRegression(max_iter=1000).fit(train_x, train_y)
    metrics["logistic_reference_auc"] = round(
        float(roc_auc_score(test_y, simple.predict_proba(test_x)[:, 1])), 4
    )

    return {"metrics": metrics, "reliability": reliability, "feature_names": feature_names}


def train_urgency_classifier(cases: list[dict]) -> dict:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.metrics import classification_report, confusion_matrix
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder

    labelled = [
        case for case in cases
        if case.get("urgency_true") in URGENCY_LEVELS
    ]
    if len(labelled) < 30:
        return {"skipped": f"only {len(labelled)} cases have urgency_true; need >= 30"}

    matrix, feature_names = featurise(labelled)
    encoder = LabelEncoder().fit(list(URGENCY_LEVELS))
    labels = encoder.transform([case["urgency_true"] for case in labelled])

    if len(np.unique(labels)) < 2:
        return {"skipped": "only one urgency class present"}

    train_x, test_x, train_y, test_y = train_test_split(
        matrix, labels, test_size=0.30, random_state=SEED, stratify=labels
    )

    model = GradientBoostingClassifier(random_state=SEED, n_estimators=250, max_depth=3)
    model.fit(train_x, train_y)
    predicted = model.predict(test_x)

    report = classification_report(
        test_y, predicted, labels=range(len(encoder.classes_)),
        target_names=list(encoder.classes_), output_dict=True, zero_division=0,
    )

    import joblib
    URGENCY_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "classes": list(encoder.classes_),
            "feature_names": feature_names,
            "numeric_features": list(NUMERIC_FEATURES),
            "completeness_levels": list(COMPLETENESS_LEVELS),
        },
        URGENCY_MODEL_PATH,
    )
    logger.info("Saved urgency classifier to %s", URGENCY_MODEL_PATH)

    return {
        "n_cases": len(labelled),
        "classes": list(encoder.classes_),
        "macro_f1": round(float(report["macro avg"]["f1-score"]), 4),
        "per_class": {
            name: {
                "precision": round(float(report[name]["precision"]), 4),
                "recall": round(float(report[name]["recall"]), 4),
                "f1": round(float(report[name]["f1-score"]), 4),
            }
            for name in encoder.classes_
        },
        "confusion_matrix": confusion_matrix(test_y, predicted).tolist(),
        "usage": (
            "Run this as an INDEPENDENT second opinion against the LLM's urgencyLevel. "
            "On disagreement, surface a warning in FinalReportView.tsx - never silently "
            "override the primary assessment."
        ),
    }


def pillar_demo() -> None:
    """
    Show the deterministic pillar arithmetic that doctor.ts must reproduce.

    Having the reference implementation here means the TypeScript can be checked
    against known-good numbers instead of eyeballed.
    """
    weights = PILLAR_MAX_WEIGHTS

    def score(support: dict[str, float]) -> dict:
        contributed = {}
        for pillar, max_weight in weights.items():
            supported = support.get(pillar, 0.0)
            contributed[pillar] = round(max_weight * supported, 2)

        total = sum(contributed.values())
        max_possible = sum(
            weights[pillar] for pillar in weights if support.get(pillar, 0.0) > 0
        )
        percentage = round(100 * total / max_possible, 1) if max_possible else 0.0

        return {
            "contributed": contributed,
            "weighted_total": round(total, 2),
            "max_possible": max_possible,
            "probability_score": percentage,
        }

    scenarios = {
        "complete data, everything positive": {
            "interview": 1.0, "radiology": 1.0, "lab": 1.0, "guideline": 0.9,
        },
        "symptoms only (no imaging, no labs)": {
            "interview": 1.0, "radiology": 0.0, "lab": 0.0, "guideline": 0.7,
        },
        "partial: imaging present, labs deferred": {
            "interview": 1.0, "radiology": 1.0, "lab": 0.0, "guideline": 0.8,
        },
    }

    print("Pillar weights:", weights)
    print()
    for name, support in scenarios.items():
        result = score(support)
        print(f"{name}")
        print(f"  support              : {support}")
        print(f"  contributed          : {result['contributed']}")
        print(f"  weighted total       : {result['weighted_total']} / {result['max_possible']}")
        print(f"  probability_score    : {result['probability_score']}%")
        print()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "pillar_weights.json").write_text(
        json.dumps(
            {
                "weights": weights,
                "formula": (
                    "contributed[p] = weights[p] * support[p]; "
                    "probability = 100 * sum(contributed) / sum(weights[p] for supported p)"
                ),
                "support_rules": {
                    "interview": "1.0 if clinicalSummary present and >=2 red flags, else 0.7 if summary present, else 0",
                    "radiology": "1.0 if any positive imaging finding, else 0.6 if imaging submitted, else 0",
                    "lab": "1.0 if any critical lab alert, else 0.7 if any abnormal marker, else 0",
                    "guideline": "top retrieval cosine similarity",
                },
                "note": "doctor.ts must reproduce these numbers exactly.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Written to {OUT_DIR / 'pillar_weights.json'}")


def main() -> int:
    np.random.seed(SEED)

    parser = argparse.ArgumentParser(description="Train the M5 confidence calibrator")
    parser.add_argument("--cases", type=str, help="JSONL of labelled cases.")
    parser.add_argument("--print-schema", action="store_true")
    parser.add_argument("--pillar-demo", action="store_true")
    args = parser.parse_args()

    if args.print_schema:
        print_schema()
        return 0

    if args.pillar_demo:
        pillar_demo()
        return 0

    if not args.cases:
        parser.error("Provide --cases, or use --print-schema / --pillar-demo")

    cases = load_cases(Path(args.cases))
    logger.info("Loaded %d labelled cases", len(cases))

    confidence = train_confidence_calibrator(cases)
    urgency = train_urgency_classifier(cases)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report_lines = [
        "M5 - Confidence calibration and urgency cross-check",
        "=" * 78,
        "",
        "Diagnostic confidence calibrator",
        "-" * 78,
        f"  Cases                       : {confidence['metrics']['n_cases']}",
        f"  Train / test                : {confidence['metrics']['n_train']} / {confidence['metrics']['n_test']}",
        f"  ROC-AUC (calibrated)        : {confidence['metrics']['auc_calibrated']}",
        f"  Brier (calibrated)          : {confidence['metrics']['brier_calibrated']}",
        f"  ECE   (calibrated)          : {confidence['metrics']['ece_calibrated']}",
        "",
        "  Current prompted heuristic, for comparison:",
        f"    Brier at a constant 0.55  : {confidence['metrics']['brier_baseline_constant_55']}",
        f"    ECE   at a constant 0.55  : {confidence['metrics']['ece_baseline_constant_55']}",
        "",
        "Reliability (calibrated)",
        "-" * 78,
        confidence["reliability"],
        "",
        "Urgency cross-check classifier",
        "-" * 78,
    ]

    if urgency.get("skipped"):
        report_lines.append(f"  SKIPPED: {urgency['skipped']}")
    else:
        report_lines.append(f"  Cases     : {urgency['n_cases']}")
        report_lines.append(f"  Classes   : {urgency['classes']}")
        report_lines.append(f"  Macro F1  : {urgency['macro_f1']}")
        for name, values in urgency["per_class"].items():
            report_lines.append(
                f"    {name:<10} P={values['precision']:.3f}  R={values['recall']:.3f}  F1={values['f1']:.3f}"
            )
        report_lines.append(f"  Confusion : {urgency['confusion_matrix']}")

    report_lines.extend([
        "",
        "Integration notes",
        "-" * 78,
        "  1. Replace the prompted probabilityScore in doctor.ts with:",
        "       - extract the features above from the pipeline's own outputs",
        "       - call the calibrator (or port the exported tree to TS)",
        "       - use the CALIBRATED value as probabilityScore",
        "  2. Populate ConfidencePillarScore deterministically:",
        "       python training/train_calibrator.py --pillar-demo",
        "  3. Add the urgency cross-check as a WARNING on disagreement, never",
        "     as a silent override.",
    ])

    report = "\n".join(report_lines)
    (OUT_DIR / "calibration_m5_report.txt").write_text(report, encoding="utf-8")
    (OUT_DIR / "calibration_m5_metrics.json").write_text(
        json.dumps({"confidence": confidence["metrics"], "urgency": urgency}, indent=2),
        encoding="utf-8",
    )

    print()
    print(report)
    print()
    print(f"Report written to {OUT_DIR / 'calibration_m5_report.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
