"""
M1 - Evaluate the trained radiology model on the held-out TEST split.

Usage
-----
    python training/evaluate_radiology.py
    python training/evaluate_radiology.py --split test --target-specificity 0.90
    python training/evaluate_radiology.py --onnx training/exports/mediagent_radiology_densenet121.onnx

Outputs
-------
    training/out/evaluation_test.txt         per-class table, ready to paste into the report
    training/out/evaluation_test.json        machine-readable metrics
    training/out/subgroup_test.json          AUC by sex and age band
    training/out/onnx_parity.json            PyTorch vs ONNX agreement on real images

The ONNX parity check is the important one
------------------------------------------
Everything else measures the PyTorch checkpoint. The ONNX parity check measures
the artefact that ACTUALLY RUNS IN PRODUCTION. It pushes real radiographs through
the exported graph and compares the probabilities against PyTorch. If those
disagree, the deployment is broken regardless of how good the AUC looks.

This is the check that catches a double-sigmoid, a wrong channel order, a
normalisation mismatch, or a stale export.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import torch

from mediagent_training.config import (
    EXPORTED_ONNX,
    OUT_DIR,
    RADIOLOGY_CHECKPOINT,
)
from mediagent_training.dataset import (
    NIHChestXrayDataset,
    build_dataloaders,
    build_eval_transform,
    load_nih_dataframe,
)
from mediagent_training.labels import NIH_CHESTXRAY14_LABELS, NUM_LABELS
from mediagent_training.metrics import (
    expected_calibration_error,
    format_report,
    mean_brier_score,
    mean_roc_auc,
    per_class_average_precision,
    per_class_roc_auc,
    sensitivity_at_specificity,
    subgroup_auc,
)
from mediagent_training.model import build_model

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("evaluate")


@torch.no_grad()
def collect(model: torch.nn.Module, loader, device) -> tuple[np.ndarray, np.ndarray]:
    targets_all, probs_all = [], []
    for images, targets, _ in loader:
        logits = model(images.to(device, non_blocking=True))
        targets_all.append(targets.numpy())
        probs_all.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(targets_all, axis=0), np.concatenate(probs_all, axis=0)


def check_onnx_parity(
    model: torch.nn.Module,
    df,
    device: torch.device,
    n_images: int = 64,
) -> dict:
    """
    Push real preprocessed radiographs through both the PyTorch model and the
    exported ONNX graph and compare probabilities.

    This is the end-to-end deployment check. It is deliberately run on REAL
    images from the split, not synthetic noise, because a synthetic tensor can
    accidentally pass while the real preprocessing path is wrong.
    """
    if not EXPORTED_ONNX.exists():
        return {"skipped": True, "reason": f"{EXPORTED_ONNX} not found"}

    import onnxruntime as ort

    session = ort.InferenceSession(str(EXPORTED_ONNX), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name

    subset = df[df["split"] == "test"].head(n_images)
    if subset.empty:
        subset = df.head(n_images)

    dataset = NIHChestXrayDataset(subset, Path("."), build_eval_transform())

    diffs = []
    for i in range(min(n_images, len(dataset))):
        images, _, _ = dataset[i]
        batch = images.unsqueeze(0)

        with torch.no_grad():
            torch_probs = torch.sigmoid(model(batch.to(device))).cpu().numpy()[0]

        onnx_logits = session.run(None, {input_name: batch.numpy()})[0][0]
        onnx_probs = 1.0 / (1.0 + np.exp(-onnx_logits))

        diffs.append(float(np.max(np.abs(torch_probs - onnx_probs))))

    max_diff = float(np.max(diffs)) if diffs else float("nan")
    mean_diff = float(np.mean(diffs)) if diffs else float("nan")
    passed = bool(np.isfinite(max_diff) and max_diff < 1e-3)

    result = {
        "images_compared": len(diffs),
        "onnx_input_name": input_name,
        "max_abs_probability_difference": max_diff,
        "mean_abs_probability_difference": mean_diff,
        "passed": passed,
        "threshold": 1e-3,
    }

    if passed:
        logger.info("ONNX parity PASSED: max |Δp| = %.2e over %d real images", max_diff, len(diffs))
    else:
        logger.error(
            "ONNX parity FAILED: max |Δp| = %.2e. The deployed artefact does not match the "
            "trained model. Check for a double-sigmoid, channel-order mismatch, or a stale export.",
            max_diff,
        )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate M1 on the held-out test split")
    parser.add_argument("--split", choices=["val", "test"], default="test")
    parser.add_argument("--target-specificity", type=float, default=0.90)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--skip-onnx-parity", action="store_true")
    args = parser.parse_args()

    if not RADIOLOGY_CHECKPOINT.exists():
        logger.error("No checkpoint at %s. Train first.", RADIOLOGY_CHECKPOINT)
        return 1

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    checkpoint = torch.load(RADIOLOGY_CHECKPOINT, map_location=device, weights_only=False)
    model = build_model(num_labels=NUM_LABELS, init="scratch", verbose=False).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    df = load_nih_dataframe()
    loaders = build_dataloaders(df, batch_size=args.batch_size, num_workers=args.num_workers)
    if args.split not in loaders:
        logger.error("Split %r unavailable. Have: %s", args.split, sorted(loaders))
        return 1

    targets, probs = collect(model, loaders[args.split], device)
    logger.info("Evaluated %d images on the %s split", len(targets), args.split)

    auc = per_class_roc_auc(targets, probs, NIH_CHESTXRAY14_LABELS)
    ap = per_class_average_precision(targets, probs, NIH_CHESTXRAY14_LABELS)
    sens = sensitivity_at_specificity(
        targets, probs, NIH_CHESTXRAY14_LABELS, args.target_specificity
    )
    positives = targets.sum(axis=0)

    table = format_report(
        NIH_CHESTXRAY14_LABELS, auc, ap, sens, positives, args.target_specificity
    )

    ece = expected_calibration_error(targets, probs)
    brier = mean_brier_score(targets, probs)
    mean_auc = mean_roc_auc(auc)

    print(table)
    print(f"Mean ROC-AUC        : {mean_auc:.4f}")
    print(f"Expected Calib. Err : {ece:.4f}")
    print(f"Mean Brier score    : {brier:.4f}")

    # ---- subgroup analysis -----------------------------------------------
    subgroup_results: dict = {}
    if "patient_gender" in df.columns:
        test_df = df[df["split"] == args.split]
        genders = test_df["patient_gender"].fillna("Unknown").to_numpy()
        for value in ("M", "F"):
            mask = genders == value
            if mask.shape[0] == targets.shape[0] and mask.sum() >= 10:
                subgroup_results[f"gender_{value}"] = subgroup_auc(
                    targets, probs, NIH_CHESTXRAY14_LABELS, mask, f"gender_{value}"
                )

    if "patient_age" in df.columns:
        test_df = df[df["split"] == args.split]
        ages = test_df["patient_age"].to_numpy()
        if ages.shape[0] == targets.shape[0]:
            young = ages < 50
            older = ages >= 50
            subgroup_results["age_under_50"] = subgroup_auc(
                targets, probs, NIH_CHESTXRAY14_LABELS, young, "age_under_50"
            )
            subgroup_results["age_50_plus"] = subgroup_auc(
                targets, probs, NIH_CHESTXRAY14_LABELS, older, "age_50_plus"
            )

    if subgroup_results:
        logger.info("Subgroup AUC computed for %d slices", len(subgroup_results))
        for slice_name, payload in subgroup_results.items():
            for label, per_class in payload.items():
                mean = mean_roc_auc(per_class)
                print(f"  {slice_name:<16} mean AUC = {mean:.4f}")

    # ---- ONNX parity ------------------------------------------------------
    onnx_result: dict = {"skipped": True, "reason": "--skip-onnx-parity"}
    if not args.skip_onnx_parity:
        logger.info("Checking PyTorch vs ONNX parity on real images...")
        onnx_result = check_onnx_parity(model, df, device)

    # ---- write artefacts --------------------------------------------------
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    text_report = (
        f"MediAgent M1 evaluation - {args.split} split\n"
        f"{'=' * 78}\n"
        f"Checkpoint        : {RADIOLOGY_CHECKPOINT}\n"
        f"Checkpoint epoch  : {checkpoint.get('epoch')}\n"
        f"Training init     : {checkpoint.get('init')}\n"
        f"Images evaluated  : {len(targets)}\n"
        f"Target specificity: {args.target_specificity}\n\n"
        f"{table}\n"
        f"Overall\n{'-' * 78}\n"
        f"  Mean ROC-AUC          : {mean_auc:.4f}\n"
        f"  Expected Calib. Error : {ece:.4f}\n"
        f"  Mean Brier score      : {brier:.4f}\n"
        f"  ONNX parity           : "
        f"{'PASSED' if onnx_result.get('passed') else 'NOT VERIFIED'}\n"
    )
    (OUT_DIR / f"evaluation_{args.split}.txt").write_text(text_report, encoding="utf-8")

    (OUT_DIR / f"evaluation_{args.split}.json").write_text(
        json.dumps(
            {
                "split": args.split,
                "images": int(len(targets)),
                "per_class_roc_auc": auc,
                "per_class_average_precision": ap,
                "sensitivity_at_specificity": sens,
                "target_specificity": args.target_specificity,
                "positives": positives.tolist(),
                "mean_roc_auc": mean_auc,
                "expected_calibration_error": ece,
                "mean_brier_score": brier,
                "onnx_parity": onnx_result,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    (OUT_DIR / f"subgroup_{args.split}.json").write_text(
        json.dumps(subgroup_results, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "onnx_parity.json").write_text(
        json.dumps(onnx_result, indent=2), encoding="utf-8"
    )

    logger.info("Wrote evaluation artefacts to %s", OUT_DIR)

    if onnx_result.get("skipped"):
        logger.info("Next: python training/export_radiology_onnx.py  then re-run to check parity.")
    elif not onnx_result.get("passed"):
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
