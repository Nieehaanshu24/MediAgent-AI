"""
Evaluation metrics for the MediAgent radiology classifier (M1).

Everything the progress-review report needs, per class rather than as a single
flattering average:

  * per-class ROC-AUC        — the standard ChestX-ray14 comparability metric
  * per-class average precision (mAP) — correct metric for the rare classes
  * sensitivity @ fixed specificity   — the clinically meaningful operating point
  * expected calibration error (ECE) + Brier — proves confidence is honest
  * reliability-curve data   — for the diagrams
  * subgroup AUC             — so you can show you checked for bias
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
    roc_curve,
)


def per_class_roc_auc(y_true: np.ndarray, y_prob: np.ndarray, labels: tuple[str, ...]) -> dict[str, float]:
    """
    ROC-AUC per label. NaN is returned (rather than raising) for a class with a
    single observed value, because rare classes legitimately produce this on
    small validation folds.
    """
    assert y_true.shape == y_prob.shape, f"shape mismatch: {y_true.shape} vs {y_prob.shape}"
    out: dict[str, float] = {}
    for i, name in enumerate(labels):
        col = y_true[:, i]
        if len(np.unique(col)) < 2:
            out[name] = float("nan")
        else:
            out[name] = float(roc_auc_score(col, y_prob[:, i]))
    return out


def mean_roc_auc(per_class: dict[str, float]) -> float:
    """Mean over classes that produced a finite AUC, plus the count used."""
    finite = [v for v in per_class.values() if np.isfinite(v)]
    return float(np.mean(finite)) if finite else float("nan")


def per_class_average_precision(y_true: np.ndarray, y_prob: np.ndarray, labels: tuple[str, ...]) -> dict[str, float]:
    out: dict[str, float] = {}
    for i, name in enumerate(labels):
        col = y_true[:, i]
        if col.sum() == 0:
            out[name] = float("nan")
        else:
            out[name] = float(average_precision_score(col, y_prob[:, i]))
    return out


def sensitivity_at_specificity(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    labels: tuple[str, ...],
    target_specificity: float = 0.90,
) -> dict[str, float]:
    """
    Sensitivity at a fixed specificity. This is the number a clinician cares
    about: 'if I accept a 10% false-positive rate, what fraction of real
    findings do I catch?'
    """
    out: dict[str, float] = {}
    for i, name in enumerate(labels):
        col = y_true[:, i]
        if len(np.unique(col)) < 2:
            out[name] = float("nan")
            continue
        fpr, tpr, _ = roc_curve(col, y_prob[:, i])
        spec = 1.0 - fpr
        # Nearest achievable specificity at or above the target.
        idx = np.where(spec >= target_specificity)[0]
        out[name] = float(tpr[idx[0]]) if len(idx) else float("nan")
    return out


def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 15) -> float:
    """
    Standard ECE over all (case, class) pairs, pooled. Treats the multi-label
    problem as a set of independent binary predictions.
    """
    y_true = y_true.ravel().astype(float)
    y_prob = y_prob.ravel().astype(float)
    if y_true.size == 0:
        return float("nan")

    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
        in_bin = (y_prob > lo) & (y_prob <= hi)
        if not np.any(in_bin):
            continue
        avg_conf = float(np.mean(y_prob[in_bin]))
        avg_acc = float(np.mean(y_true[in_bin]))
        ece += (np.sum(in_bin) / y_true.size) * abs(avg_acc - avg_conf)
    return float(ece)


def reliability_curve(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 15,
) -> tuple[list[float], list[float], list[int]]:
    """Return (mean_predicted, fraction_positive, count) per bin — for the diagram."""
    y_true = y_true.ravel().astype(float)
    y_prob = y_prob.ravel().astype(float)

    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    mean_pred, frac_pos, counts = [], [], []
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
        in_bin = (y_prob > lo) & (y_prob <= hi)
        n = int(np.sum(in_bin))
        counts.append(n)
        if n == 0:
            mean_pred.append(float("nan"))
            frac_pos.append(float("nan"))
        else:
            mean_pred.append(float(np.mean(y_prob[in_bin])))
            frac_pos.append(float(np.mean(y_true[in_bin])))
    return mean_pred, frac_pos, counts


def mean_brier_score(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """Mean Brier score across labels. Lower is better; 0.25 is the trivial baseline."""
    scores = []
    for i in range(y_true.shape[1]):
        col = y_true[:, i]
        if len(np.unique(col)) < 2:
            continue
        scores.append(brier_score_loss(col, y_prob[:, i]))
    return float(np.mean(scores)) if scores else float("nan")


def subgroup_auc(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    labels: tuple[str, ...],
    subgroup_mask: np.ndarray,
    subgroup_name: str = "subgroup",
) -> dict[str, dict[str, float]]:
    """
    Per-class AUC restricted to a subgroup slice (e.g. one sex, one age band).

    subgroup_mask is a boolean array of length n_samples. Groups smaller than
    10 samples are skipped rather than reported as a misleading number.
    """
    result: dict[str, dict[str, float]] = {}
    if int(subgroup_mask.sum()) < 10:
        return result

    result[subgroup_name] = per_class_roc_auc(
        y_true[subgroup_mask], y_prob[subgroup_mask], labels
    )
    return result


def format_report(
    labels: tuple[str, ...],
    auc: dict[str, float],
    ap: dict[str, float],
    sens: dict[str, float],
    positives: np.ndarray,
    target_specificity: float = 0.90,
) -> str:
    """
    Render the per-class table you paste into the Progress Review Report.
    """
    mean = mean_roc_auc(auc)
    lines = [
        "",
        "Per-class performance (validation)",
        "-" * 78,
        f"{'Label':<22}{'Pos':>8}{'ROC-AUC':>10}{'AP':>10}{f'Sens@{target_specificity:.2f}':>16}",
        "-" * 78,
    ]
    for i, name in enumerate(labels):
        a = auc.get(name, float("nan"))
        p = ap.get(name, float("nan"))
        s = sens.get(name, float("nan"))
        a_s = "n/a" if not np.isfinite(a) else f"{a:.3f}"
        p_s = "n/a" if not np.isfinite(p) else f"{p:.3f}"
        s_s = "n/a" if not np.isfinite(s) else f"{s:.3f}"
        lines.append(f"{name:<22}{int(positives[i]):>8}{a_s:>10}{p_s:>10}{s_s:>16}")
    lines.append("-" * 78)
    lines.append(f"{'MEAN ROC-AUC':<22}{'':>8}{mean:>10.3f}")
    lines.append("-" * 78)
    lines.append("")
    return "\n".join(lines)
