"""
M1 - Train the MediAgent chest X-ray multi-label classifier.

Usage
-----
    python training/train_radiology.py                      # default: xrv transfer
    python training/train_radiology.py --init imagenet      # ablation baseline
    python training/train_radiology.py --init scratch       # proves pretraining matters
    python training/train_radiology.py --epochs 5 --limit 2000   # smoke test

Outputs (all under training/out/ and training/checkpoints/)
    checkpoints/radiology_densenet121_best.pt   best checkpoint by mean val AUC
    out/radiology_history_{init}.json           per-epoch metrics
    out/radiology_report_{init}.txt             per-class table for the report
    out/split_prevalence.txt                    class counts per split
    runs/                                       TensorBoard event files

What this script deliberately does NOT do
    * It does not export ONNX. Use export_radiology_onnx.py so export is a
      separate, verifiable step.
    * It does not pick decision thresholds. Use calibrate_thresholds.py, which
      fits them on the validation split.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from mediagent_training.config import (
    BATCH_SIZE,
    EARLY_STOP_MIN_DELTA,
    EARLY_STOP_PATIENCE,
    LEARNING_RATE,
    NUM_EPOCHS,
    OUT_DIR,
    RADIOLOGY_CHECKPOINT,
    RUNS_DIR,
    SEED,
    USE_AMP,
    USE_FOCAL_LOSS,
    FOCAL_ALPHA,
    FOCAL_GAMMA,
    WEIGHT_DECAY,
)
from mediagent_training.dataset import (
    build_dataloaders,
    compute_pos_weight,
    describe_split,
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
)
from mediagent_training.model import build_model, count_parameters

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("train_radiology")


class FocalLoss(nn.Module):
    """
    Binary focal loss for multi-label classification.

    Only used when USE_FOCAL_LOSS is set. Kept alongside BCE-with-pos_weight
    because focal loss is the better tool for the extreme rare classes (Hernia,
    Fibrosis) once the easy classes have saturated.
    """

    def __init__(self, gamma: float = 2.0, alpha: float = 0.25, pos_weight: torch.Tensor | None = None):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha
        self.register_buffer("pos_weight", pos_weight if pos_weight is not None else None)

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        bce = nn.functional.binary_cross_entropy_with_logits(
            logits, targets, reduction="none",
            pos_weight=self.pos_weight if self.pos_weight is not None else None,
        )
        probs = torch.sigmoid(logits)
        p_t = targets * probs + (1 - targets) * (1 - probs)
        alpha_t = targets * self.alpha + (1 - targets) * (1 - self.alpha)
        loss = alpha_t * (1 - p_t).pow(self.gamma) * bce
        return loss.mean()


def set_seeds(seed: int) -> None:
    import random
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader,
    device: torch.device,
    criterion: nn.Module | None = None,
) -> tuple[np.ndarray, np.ndarray, float]:
    """Return (targets, probabilities, mean loss) for one split."""
    model.eval()
    all_targets, all_probs = [], []
    total_loss, n_batches = 0.0, 0

    for images, targets, _ in loader:
        images = images.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        with torch.amp.autocast("cuda", enabled=USE_AMP and device.type == "cuda"):
            logits = model(images)
        logits = logits.float()

        if criterion is not None:
            total_loss += float(criterion(logits, targets).item())
            n_batches += 1

        all_targets.append(targets.cpu().numpy())
        all_probs.append(torch.sigmoid(logits).cpu().numpy())

    targets_np = np.concatenate(all_targets, axis=0)
    probs_np = np.concatenate(all_probs, axis=0)
    mean_loss = total_loss / max(n_batches, 1)
    return targets_np, probs_np, mean_loss


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the MediAgent M1 radiology classifier")
    parser.add_argument("--init", choices=["xrv", "imagenet", "scratch"], default="xrv")
    parser.add_argument("--epochs", type=int, default=NUM_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=LEARNING_RATE)
    parser.add_argument("--limit", type=int, default=0,
                        help="Smoke test: use only the first N rows of each split.")
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--reset-head-only", action="store_true",
                        help="Freeze the backbone and train only the classifier head "
                             "(useful as a first warm-up epoch on a small GPU).")
    args = parser.parse_args()

    set_seeds(SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Device: %s", device)
    if device.type == "cuda":
        logger.info("GPU: %s", torch.cuda.get_device_name(0))

    # ---- data -------------------------------------------------------------
    df = load_nih_dataframe()
    if args.limit:
        parts = [df[df["split"] == s].head(args.limit) for s in ("train", "val", "test")]
        df = __import__("pandas").concat(parts, ignore_index=True)
        logger.warning("SMOKE TEST MODE: limited to %d rows per split.", args.limit)

    prevalence = describe_split(df)
    (OUT_DIR / "split_prevalence.txt").write_text(prevalence, encoding="utf-8")
    logger.info("Class prevalence written to %s", OUT_DIR / "split_prevalence.txt")

    loaders = build_dataloaders(df, batch_size=args.batch_size, num_workers=args.num_workers)
    if "train" not in loaders or "val" not in loaders:
        logger.error("Both train and val splits are required. Check your split files.")
        return 1

    pos_weight = compute_pos_weight(df).to(device)

    # ---- model ------------------------------------------------------------
    model = build_model(num_labels=NUM_LABELS, init=args.init).to(device)
    trainable, total = count_parameters(model)
    logger.info("Model initialisation: %s  |  parameters: %s trainable / %s total",
                args.init, f"{trainable:,}", f"{total:,}")

    if args.reset_head_only:
        for name, param in model.named_parameters():
            param.requires_grad = name.startswith("classifier")
        logger.info("Frozen backbone: training classifier head only.")

    # ---- loss / optimiser -------------------------------------------------
    if USE_FOCAL_LOSS:
        criterion = FocalLoss(gamma=FOCAL_GAMMA, alpha=FOCAL_ALPHA, pos_weight=pos_weight).to(device)
        logger.info("Loss: FocalLoss(gamma=%.2f, alpha=%.2f) + pos_weight", FOCAL_GAMMA, FOCAL_ALPHA)
    else:
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        logger.info("Loss: BCEWithLogitsLoss + per-class pos_weight")

    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(params, lr=args.lr, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(args.epochs, 1))

    scaler = torch.amp.GradScaler("cuda", enabled=USE_AMP and device.type == "cuda")

    try:
        from torch.utils.tensorboard import SummaryWriter
        writer = SummaryWriter(log_dir=str(RUNS_DIR / f"radiology_{args.init}"))
    except Exception:
        writer = None
        logger.info("TensorBoard not available - skipping event logging.")

    # ---- training loop ----------------------------------------------------
    history: list[dict] = []
    best_mean_auc = -1.0
    best_epoch = -1
    epochs_without_improvement = 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_start = time.time()
        running_loss = 0.0
        n_batches = 0

        for images, targets, _ in loaders["train"]:
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=USE_AMP and device.type == "cuda"):
                logits = model(images)
                loss = criterion(logits, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            running_loss += float(loss.item())
            n_batches += 1

        train_loss = running_loss / max(n_batches, 1)

        # ---- validation ----
        val_targets, val_probs, val_loss = evaluate(model, loaders["val"], device, criterion)
        auc = per_class_roc_auc(val_targets, val_probs, NIH_CHESTXRAY14_LABELS)
        mean_auc = mean_roc_auc(auc)

        epoch_seconds = time.time() - epoch_start
        current_lr = optimizer.param_groups[0]["lr"]

        logger.info(
            "epoch %2d/%d  train_loss=%.4f  val_loss=%.4f  mean_auc=%.4f  lr=%.2e  (%.0fs)",
            epoch, args.epochs, train_loss, val_loss, mean_auc, current_lr, epoch_seconds,
        )

        history.append({
            "epoch": epoch,
            "train_loss": train_loss,
            "val_loss": val_loss,
            "mean_val_auc": mean_auc,
            "per_class_val_auc": auc,
            "lr": current_lr,
            "epoch_seconds": epoch_seconds,
        })

        if writer is not None:
            writer.add_scalar("loss/train", train_loss, epoch)
            writer.add_scalar("loss/val", val_loss, epoch)
            writer.add_scalar("auc/mean_val", mean_auc, epoch)
            writer.add_scalar("lr", current_lr, epoch)
            for name, value in auc.items():
                if np.isfinite(value):
                    writer.add_scalar(f"auc/{name}", value, epoch)

        # ---- checkpointing / early stopping ----
        if np.isfinite(mean_auc) and mean_auc > best_mean_auc + EARLY_STOP_MIN_DELTA:
            best_mean_auc = mean_auc
            best_epoch = epoch
            epochs_without_improvement = 0

            RADIOLOGY_CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "init": args.init,
                    "labels": list(NIH_CHESTXRAY14_LABELS),
                    "epoch": epoch,
                    "mean_val_auc": best_mean_auc,
                    "per_class_val_auc": auc,
                    "image_size_eval": 224,
                    "onnx_input_name": "radiograph_input",
                    "onnx_output_name": "pathology_probabilities",
                    "output_is_logits": True,
                },
                RADIOLOGY_CHECKPOINT,
            )
            logger.info("  -> new best mean AUC %.4f; checkpoint saved", best_mean_auc)
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= EARLY_STOP_PATIENCE:
                logger.info(
                    "Early stopping: no improvement for %d epochs.", EARLY_STOP_PATIENCE
                )
                break

        scheduler.step()

    if writer is not None:
        writer.close()

    # ---- final report on the best checkpoint ------------------------------
    if not RADIOLOGY_CHECKPOINT.exists():
        logger.error("No checkpoint was written - training did not improve at all.")
        return 1

    checkpoint = torch.load(RADIOLOGY_CHECKPOINT, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])

    val_targets, val_probs, _ = evaluate(model, loaders["val"], device)
    auc = per_class_roc_auc(val_targets, val_probs, NIH_CHESTXRAY14_LABELS)
    ap = per_class_average_precision(val_targets, val_probs, NIH_CHESTXRAY14_LABELS)
    sens = sensitivity_at_specificity(val_targets, val_probs, NIH_CHESTXRAY14_LABELS, 0.90)
    positives = val_targets.sum(axis=0)

    report = format_report(NIH_CHESTXRAY14_LABELS, auc, ap, sens, positives, 0.90)
    ece = expected_calibration_error(val_targets, val_probs)
    brier = mean_brier_score(val_targets, val_probs)

    summary = (
        f"{report}\n"
        f"Calibration (validation):\n"
        f"  Expected Calibration Error : {ece:.4f}\n"
        f"  Mean Brier score           : {brier:.4f}\n"
        f"  Best epoch                 : {best_epoch}\n"
        f"  Best mean ROC-AUC          : {best_mean_auc:.4f}\n"
    )
    print(summary)

    (OUT_DIR / f"radiology_report_{args.init}.txt").write_text(summary, encoding="utf-8")
    (OUT_DIR / f"radiology_history_{args.init}.json").write_text(
        json.dumps(history, indent=2), encoding="utf-8"
    )
    logger.info("Report written to %s", OUT_DIR / f"radiology_report_{args.init}.txt")
    logger.info("Next step: python training/calibrate_thresholds.py")

    return 0


if __name__ == "__main__":
    sys.exit(main())
