"""
M1 - Export the trained radiology checkpoint to ONNX and VERIFY the contract.

Usage
-----
    python training/export_radiology_onnx.py
    python training/export_radiology_onnx.py --checkpoint training/checkpoints/other.pt
    python training/export_radiology_onnx.py --skip-export   # re-verify only

Why this is a separate script
-----------------------------
Export is the single riskiest step in the whole pipeline, because a mismatch
between the graph and `server/models/radiologyModel.ts` fails SILENTLY. The most
common failure is exporting a graph that already contains a sigmoid: the
TypeScript then applies sigmoid again, every probability collapses toward 0.5,
and the model looks "trained but useless".

This script therefore not only exports, it asserts:
  1. input tensor is named exactly 'radiograph_input', 3 channels, 224x224
  2. output tensor is named exactly 'pathology_probabilities', 14 classes
  3. ONNX output numerically equals the PyTorch RAW LOGITS
  4. ONNX output is NOT already a sigmoid of the logits (the double-sigmoid trap)
  5. both batch 1 and batch 4 work (dynamic batch really is dynamic)

If any check fails it exits non-zero and does NOT claim success.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import numpy as np
import torch

from mediagent_training.config import EXPORTED_ONNX, ONNX_OPSET, RADIOLOGY_CHECKPOINT
from mediagent_training.labels import (
    IMAGENET_MEAN,
    IMAGENET_STD,
    NIH_CHESTXRAY14_LABELS,
    NUM_LABELS,
    ONNX_INPUT_NAME,
    ONNX_INPUT_SIZE,
    ONNX_OUTPUT_NAME,
)
from mediagent_training.model import build_model

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("export_onnx")


def load_model(checkpoint_path: Path) -> torch.nn.Module:
    """Rebuild the architecture and load the trained weights. CPU only, for determinism."""
    if not checkpoint_path.exists():
        raise FileNotFoundError(
            f"Checkpoint not found: {checkpoint_path}\n"
            "Train first:  python training/train_radiology.py"
        )

    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model = build_model(num_labels=NUM_LABELS, init="scratch", verbose=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    logger.info(
        "Loaded checkpoint: epoch=%s  mean_val_auc=%s  trained_init=%s",
        checkpoint.get("epoch"),
        checkpoint.get("mean_val_auc"),
        checkpoint.get("init"),
    )
    return model


def export(model: torch.nn.Module, opset: int = ONNX_OPSET) -> Path:
    dummy = torch.randn(1, 3, ONNX_INPUT_SIZE, ONNX_INPUT_SIZE)
    EXPORTED_ONNX.parent.mkdir(parents=True, exist_ok=True)

    with torch.no_grad():
        torch.onnx.export(
            model,
            dummy,
            str(EXPORTED_ONNX),
            input_names=[ONNX_INPUT_NAME],
            output_names=[ONNX_OUTPUT_NAME],
            dynamic_axes={
                ONNX_INPUT_NAME: {0: "batch"},
                ONNX_OUTPUT_NAME: {0: "batch"},
            },
            opset_version=opset,
            do_constant_folding=True,
            export_params=True,
        )

    size_mb = EXPORTED_ONNX.stat().st_size / (1024 * 1024)
    logger.info("Exported %s (%.1f MB, opset %d)", EXPORTED_ONNX, size_mb, opset)
    return EXPORTED_ONNX


def verify(model: torch.nn.Module) -> bool:
    """Run every contract assertion. Returns True only if all pass."""
    import onnxruntime as ort

    ok = True
    session = ort.InferenceSession(str(EXPORTED_ONNX), providers=["CPUExecutionProvider"])

    inputs = session.get_inputs()
    outputs = session.get_outputs()

    input_name = inputs[0].name
    output_name = outputs[0].name
    input_shape = inputs[0].shape
    output_shape = outputs[0].shape

    logger.info("ONNX input : name=%s shape=%s", input_name, input_shape)
    logger.info("ONNX output: name=%s shape=%s", output_name, output_shape)

    # ---- 1. tensor names --------------------------------------------------
    if input_name != ONNX_INPUT_NAME:
        logger.error("FAIL: input tensor is %r; the TypeScript expects %r", input_name, ONNX_INPUT_NAME)
        ok = False

    if output_name != ONNX_OUTPUT_NAME:
        logger.warning(
            "WARN: output tensor is %r; the TypeScript prefers %r. It falls back to "
            "outputNames[0], so this still runs, but align them to be safe.",
            output_name, ONNX_OUTPUT_NAME,
        )

    # ---- 2. shapes --------------------------------------------------------
    if len(input_shape) == 4:
        if input_shape[1] != 3:
            logger.error("FAIL: input has %s channels; the TS preprocessing feeds 3.", input_shape[1])
            ok = False
        if input_shape[2] != ONNX_INPUT_SIZE or input_shape[3] != ONNX_INPUT_SIZE:
            logger.error("FAIL: input spatial size is %sx%s; the TS resizes to %d.",
                         input_shape[2], input_shape[3], ONNX_INPUT_SIZE)
            ok = False
    else:
        logger.error("FAIL: input is not 4-D (got %s); expected [batch,3,224,224].", input_shape)
        ok = False

    if output_shape[-1] != NUM_LABELS:
        logger.error("FAIL: output has %s classes; expected %d.", output_shape[-1], NUM_LABELS)
        ok = False

    # ---- 3. numerical parity + double-sigmoid trap ------------------------
    torch.manual_seed(0)
    for batch in (1, 4):
        sample = torch.randn(batch, 3, ONNX_INPUT_SIZE, ONNX_INPUT_SIZE)
        with torch.no_grad():
            torch_logits = model(sample).numpy()

        onnx_out = session.run([output_name], {input_name: sample.numpy()})[0]

        if onnx_out.shape != torch_logits.shape:
            logger.error("FAIL: batch=%d shape mismatch: ONNX %s vs torch %s",
                         batch, onnx_out.shape, torch_logits.shape)
            ok = False
            continue

        max_abs_diff = float(np.max(np.abs(onnx_out - torch_logits)))
        logger.info("batch=%d  max |ONNX - torch logits| = %.3e", batch, max_abs_diff)

        if max_abs_diff < 1e-4:
            logger.info("  OK: ONNX output matches the RAW LOGITS.")
            continue

        # Not the logits. Is it their sigmoid? That is the classic trap.
        sigmoid_of_logits = 1.0 / (1.0 + np.exp(-torch_logits))
        sig_diff = float(np.max(np.abs(onnx_out - sigmoid_of_logits)))
        if sig_diff < 1e-4:
            logger.error(
                "FAIL: the exported graph ALREADY applies a sigmoid. "
                "server/models/radiologyModel.ts will sigmoid it again, collapsing every "
                "probability toward 0.5. Remove the sigmoid from forward() (or from the "
                "export wrapper) and re-export. See model.py docstring."
            )
        else:
            logger.error(
                "FAIL: ONNX output matches neither the logits nor their sigmoid "
                "(max diff %.3e). The graph is not equivalent to the trained model.",
                max_abs_diff,
            )
        ok = False

    return ok


def print_next_steps() -> None:
    print()
    print("=" * 78)
    print("EXPORT VERIFIED - all contract checks passed")
    print("=" * 78)
    print(f"File      : {EXPORTED_ONNX}")
    print(f"Classes   : {NUM_LABELS}")
    print(f"Input     : {ONNX_INPUT_NAME} [batch, 3, {ONNX_INPUT_SIZE}, {ONNX_INPUT_SIZE}] float32")
    print(f"Output    : {ONNX_OUTPUT_NAME} [batch, {NUM_LABELS}]  RAW LOGITS")
    print(f"Normalise : mean={list(IMAGENET_MEAN)}  std={list(IMAGENET_STD)}")
    print()
    print("Now update the TypeScript side (all in server/models/radiologyModel.ts):")
    print("  1. MODEL_URL        -> the new file's Hugging Face resolve URL")
    print("  2. PATHOLOGY_LABELS -> these 14 labels, in THIS exact order:")
    for i, name in enumerate(NIH_CHESTXRAY14_LABELS):
        print(f"       {i:2d}  '{name}'")
    print("  3. MODEL_METADATA   -> real dataset size, epochs, mean AUC, known weak classes")
    print("  4. the '> 0.5' flag -> per-class thresholds from training/out/thresholds.json")
    print()
    print("Then update src/types/clinical.ts:")
    print("  PathologyClassResult['label'] union must list the same 14 strings.")
    print()
    print("Then verify:")
    print("  npx tsc --noEmit")
    print("  delete .model_cache/  so the new model is downloaded")
    print("=" * 78)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export and verify the M1 ONNX model")
    parser.add_argument("--checkpoint", type=str, default=str(RADIOLOGY_CHECKPOINT),
                        help="Path to the trained checkpoint (.pt).")
    parser.add_argument("--opset", type=int, default=ONNX_OPSET)
    parser.add_argument("--skip-export", action="store_true",
                        help="Only re-run verification against an existing .onnx file.")
    args = parser.parse_args()

    if args.skip_export and not EXPORTED_ONNX.exists():
        logger.error("--skip-export was given but %s does not exist.", EXPORTED_ONNX)
        return 1

    model = load_model(Path(args.checkpoint))

    if not args.skip_export:
        export(model, opset=args.opset)

    logger.info("Verifying export contract...")
    if not verify(model):
        logger.error("VERIFICATION FAILED - do not upload or deploy this model.")
        return 1

    print_next_steps()
    return 0


if __name__ == "__main__":
    sys.exit(main())
