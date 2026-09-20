"""
M1 - Grad-CAM explainability for the radiologist agent.

Usage
-----
    python training/gradcam.py --image path/to/cxr.png
    python training/gradcam.py --image path/to/cxr.png --label Pneumothorax
    python training/gradcam.py --image path/to/cxr.png --all-flagged
    python training/gradcam.py --dir training/data/demo_cxr --out training/out/gradcam_gallery

Outputs
-------
    training/out/gradcam/<name>_<label>.png   original | heatmap | overlay, side by side
    training/out/gradcam/gradcam_summary.json per-label probabilities and flagged set

Why this exists
---------------
The synopsis promises Explainable AI for medical image analysis. Text-only
explanations ("right lower lobe consolidation") do not show WHERE the model
looked. A Grad-CAM overlay does, and it is the single most persuasive thing you
can put in front of a reviewer - especially when the model is wrong, because the
heatmap usually shows you exactly why.

Architecture note for production
--------------------------------
Do NOT try to run gradients inside onnxruntime-node. The right shape is this
script's logic behind a tiny FastAPI sidecar that the Node code calls, returning
a base64 PNG. See docs/CODEBASE_VS_SYNOPSIS_AND_TRAINING_ROADMAP.md section 6.7.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from mediagent_training.config import OUT_DIR, RADIOLOGY_CHECKPOINT
from mediagent_training.dataset import build_eval_transform
from mediagent_training.labels import NIH_CHESTXRAY14_LABELS, NUM_LABELS, label_index
from mediagent_training.model import build_model

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("gradcam")

GRADCAM_OUT = OUT_DIR / "gradcam"


def load_model(device: torch.device) -> torch.nn.Module:
    if not RADIOLOGY_CHECKPOINT.exists():
        raise FileNotFoundError(
            f"No checkpoint at {RADIOLOGY_CHECKPOINT}.\n"
            "Train first:  python training/train_radiology.py"
        )
    checkpoint = torch.load(RADIOLOGY_CHECKPOINT, map_location=device, weights_only=False)
    model = build_model(num_labels=NUM_LABELS, init="scratch", verbose=False).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    logger.info("Loaded checkpoint (epoch %s, mean val AUC %.4f)",
                checkpoint.get("epoch"), float(checkpoint.get("mean_val_auc", float("nan"))))
    return model


def make_cam_engine(model: torch.nn.Module):
    """
    Build a GradCAM engine targeting the last dense block.

    DenseNet-121's final convolutional stage is model.features.denseblock4. The
    norm5 + relu that follow are normalisation and non-linearity - standard
    Grad-CAM practice is to hook the last block that still has spatial structure.
    """
    try:
        from pytorch_grad_cam import GradCAM
    except ImportError as exc:
        raise ImportError(
            "pytorch-grad-cam is required for Grad-CAM.\n"
            "Install it with:  pip install pytorch-grad-cam opencv-python-headless"
        ) from exc

    target_layers = [model.features.denseblock4]
    return GradCAM(model=model, target_layers=target_layers)


def preprocess(image_path: Path, device: torch.device) -> tuple[torch.Tensor, np.ndarray]:
    """
    Load with the SAME transform used for evaluation, and also return a float RGB
    copy in [0,1] for the overlay rendering.
    """
    transform = build_eval_transform()
    with Image.open(image_path) as img:
        rgb = img.convert("RGB")

    display = np.asarray(rgb.resize((224, 224))).astype(np.float32) / 255.0
    tensor = transform(rgb).unsqueeze(0).to(device)
    return tensor, display


def predict(model: torch.nn.Module, tensor: torch.Tensor) -> dict[str, float]:
    with torch.no_grad():
        logits = model(tensor).cpu().numpy()[0]
    probs = 1.0 / (1.0 + np.exp(-logits))
    return {name: float(probs[i]) for i, name in enumerate(NIH_CHESTXRAY14_LABELS)}


def render_overlay(display_rgb: np.ndarray, grayscale_cam: np.ndarray, out_path: Path) -> None:
    from pytorch_grad_cam.utils.image import show_cam_on_image

    overlay = show_cam_on_image(display_rgb, grayscale_cam, use_rgb=True)

    # Side-by-side: original | heatmap | overlay. Easier to read in a report than
    # the overlay alone.
    heatmap_rgb = (np.stack([grayscale_cam] * 3, axis=-1) * 255).astype(np.uint8)
    original_rgb = (display_rgb * 255).astype(np.uint8)
    combined = np.concatenate([original_rgb, heatmap_rgb, overlay], axis=1)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(combined).save(out_path)


def explain_labels(
    engine,
    tensor: torch.Tensor,
    display_rgb: np.ndarray,
    probabilities: dict[str, float],
    labels_to_explain: list[str],
    out_stem: Path,
) -> list[str]:
    from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

    written: list[str] = []
    for name in labels_to_explain:
        idx = label_index(name)
        targets = [ClassifierOutputTarget(idx)]   # multi-label: score at column idx
        grayscale_cam = engine(input_tensor=tensor, targets=targets)[0, :]

        out_path = out_stem.parent / f"{out_stem.name}_{name}.png"
        render_overlay(display_rgb, grayscale_cam, out_path)
        written.append(str(out_path))
        logger.info("  %-22s p=%.3f  ->  %s", name, probabilities[name], out_path.name)
    return written


def process_image(
    model: torch.nn.Module,
    engine,
    image_path: Path,
    device: torch.device,
    out_dir: Path,
    only_label: str | None,
    all_flagged: bool,
    threshold: float,
) -> dict:
    tensor, display_rgb = preprocess(image_path, device)
    probabilities = predict(model, tensor)

    if only_label:
        labels_to_explain = [only_label]
    elif all_flagged:
        labels_to_explain = [n for n, p in probabilities.items() if p > threshold]
    else:
        labels_to_explain = [max(probabilities.items(), key=lambda kv: kv[1])[0]]

    if not labels_to_explain:
        logger.warning("No label exceeded %.2f for %s - explaining the argmax instead.",
                       threshold, image_path.name)
        labels_to_explain = [max(probabilities.items(), key=lambda kv: kv[1])[0]]

    logger.info("%s", image_path.name)
    out_stem = out_dir / image_path.stem
    written = explain_labels(engine, tensor, display_rgb, probabilities, labels_to_explain, out_stem)

    return {
        "image": str(image_path),
        "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
        "flagged_above_threshold": [n for n, p in probabilities.items() if p > threshold],
        "explained_labels": labels_to_explain,
        "overlays": written,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Grad-CAM explainability for M1")
    parser.add_argument("--image", type=str, help="Single image file.")
    parser.add_argument("--dir", type=str, help="Directory of images (gallery mode).")
    parser.add_argument("--label", type=str, default=None,
                        help="Explain this specific finding by name.")
    parser.add_argument("--all-flagged", action="store_true",
                        help="Explain every finding above --threshold.")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--out", type=str, default=str(GRADCAM_OUT))
    args = parser.parse_args()

    if not args.image and not args.dir:
        parser.error("Provide either --image or --dir")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_model(device)
    engine = make_cam_engine(model)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.image:
        image_paths = [Path(args.image)]
    else:
        directory = Path(args.dir)
        image_paths = sorted(
            p for p in directory.rglob("*") if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
        )
        if not image_paths:
            logger.error("No images found under %s", directory)
            return 1

    summaries = []
    for image_path in image_paths:
        try:
            summaries.append(
                process_image(
                    model, engine, image_path, device,
                    out_dir, args.label, args.all_flagged, args.threshold,
                )
            )
        except Exception as exc:  # keep going through a gallery
            logger.error("Failed on %s: %s", image_path, exc)

    summary_path = out_dir / "gradcam_summary.json"
    summary_path.write_text(json.dumps(summaries, indent=2), encoding="utf-8")

    print()
    print("=" * 78)
    print(f"Grad-CAM complete: {len(summaries)} image(s) explained")
    print(f"Overlays : {out_dir}")
    print(f"Summary  : {summary_path}")
    print()
    print("For the review, put these next to the radiologist agent's text findings:")
    print("the heatmap shows WHERE the model looked, the agent explains WHAT it means.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
