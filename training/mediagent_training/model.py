"""
DenseNet-121 multi-label model builder for MediAgent M1.

THE INPUT-CONTRACT PROBLEM (read this before changing anything)
--------------------------------------------------------------
There are two incompatible chest-X-ray preprocessing conventions in play:

  (a) The DEPLOYED contract, in server/models/radiologyModel.ts:
        input [1, 3, 224, 224] float32, RGB, ImageNet normalisation
        (pixel/255 - [0.485,0.456,0.406]) / [0.229,0.224,0.225]

  (b) The torchxrayvision (xrv) convention:
        1-channel grayscale, normalised to roughly [-1024, 1024]

Feeding ImageNet-scaled input (~[-2.1, 2.6]) into an xrv-trained conv0 whose
weights were learned for ~[-1024, 1024] input destroys the pretrained stem:
activations are ~1000x too small.

Resolution used here, and why
----------------------------
We keep contract (a) untouched — so the ONNX model really is a drop-in for the
TypeScript code, as the roadmap claims — and we transfer xrv's weights only to
the layers that are scale-agnostic with respect to the stem output, i.e. every
block AFTER the first convolution. The stem conv0 is left at torchvision
ImageNet initialisation, which was trained for exactly the input distribution
we will feed it.

This is a deliberate, documented compromise:
  * pro: the deployed TypeScript preprocessing needs no change; the transfer
    still gains us xrv's radiograph-specific deep features (blocks 1-4), which
    is where most of the representational value sits.
  * con: we do not inherit xrv's stem.

If you would rather inherit the stem as well, you must change BOTH sides:
retrain with xrv 1-channel preprocessing AND rewrite preprocessRadiograph()
plus ONNX_INPUT_CHANNELS in labels.py. Do not change only one side.
"""

from __future__ import annotations

import logging

import torch
import torch.nn as nn
import torchvision

from .labels import NUM_LABELS

logger = logging.getLogger(__name__)

# xrv DenseNet-121 classifier input width and torchvision's are both 1024.
_DENSENET121_FEATURE_DIM = 1024


class DenseNet121MultiLabel(nn.Module):
    """
    DenseNet-121 with a linear multi-label head emitting RAW LOGITS.

    There is deliberately NO sigmoid here. The TypeScript inference code in
    server/models/radiologyModel.ts applies the sigmoid itself:

        probability = 1 / (1 + exp(-logit))

    Adding a sigmoid would double-apply it and collapse every probability
    toward 0.5. Keep this module logits-only.
    """

    def __init__(self, num_labels: int = NUM_LABELS, dropout: float = 0.0) -> None:
        super().__init__()
        self.num_labels = num_labels

        backbone = torchvision.models.densenet121(weights=None)
        self.features = backbone.features
        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()
        self.classifier = nn.Linear(_DENSENET121_FEATURE_DIM, num_labels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Mirrors torchvision's DenseNet.forward, which is the graph xrv uses too.
        x = self.features(x)
        x = torch.relu(x)
        x = torch.nn.functional.adaptive_avg_pool2d(x, (1, 1))
        x = torch.flatten(x, 1)
        x = self.dropout(x)
        return self.classifier(x)   # raw logits


def _load_state_dict_flexible(model: nn.Module, state_dict: dict) -> tuple[list[str], list[str]]:
    """
    Load whatever tensors match in shape and report what was skipped.

    Returns (loaded_keys, skipped_keys). Skipping instead of raising is
    deliberate: xrv checkpoint key names and shapes only partially line up with
    a torchvision backbone, and a partial transfer is still valuable.
    """
    model_sd = model.state_dict()
    loadable = {}
    skipped: list[str] = []

    for key, tensor in state_dict.items():
        # xrv stores the backbone under "features."; strip any extra prefixes.
        candidate = key
        for prefix in ("module.", "model.", "densenet."):
            if candidate.startswith(prefix):
                candidate = candidate[len(prefix):]

        if candidate in model_sd and model_sd[candidate].shape == tensor.shape:
            loadable[candidate] = tensor
        else:
            skipped.append(key)

    model_sd.update(loadable)
    model.load_state_dict(model_sd)
    return sorted(loadable.keys()), skipped


def _strip_xrv_only_buffers(state_dict: dict) -> dict:
    """
    xrv DenseNet carries an `op_threshs` buffer (CheXpert competition
    thresholds) shaped [1, num_classes]. It is irrelevant to us and would be
    baked into the ONNX graph as a dead constant.
    """
    return {
        k: v
        for k, v in state_dict.items()
        if not k.endswith("op_threshs") and "op_threshs" not in k
    }


def build_model(
    num_labels: int = NUM_LABELS,
    init: str = "xrv",
    dropout: float = 0.0,
    verbose: bool = True,
) -> DenseNet121MultiLabel:
    """
    Build the M1 classifier.

    init:
      "xrv"      transfer torchxrayvision radiograph weights into blocks 1-4,
                 keeping a torchvision ImageNet stem (see module docstring).
      "imagenet" pure torchvision ImageNet initialisation. Use this as an
                 ablation baseline — it is what an uninformed team would do.
      "scratch"  random weights. Only useful to prove the value of pretraining.

    The classifier head is ALWAYS freshly initialised, because neither source
    has our 14-label output space.
    """
    model = DenseNet121MultiLabel(num_labels=num_labels, dropout=dropout)

    # Head is always fresh.
    nn.init.normal_(model.classifier.weight, mean=0.0, std=0.01)
    nn.init.constant_(model.classifier.bias, 0.0)

    if init == "scratch":
        if verbose:
            logger.info("Initialised DenseNet-121 from scratch (random weights).")
        return model

    if init == "imagenet":
        backbone = torchvision.models.densenet121(
            weights=torchvision.models.DenseNet121_Weights.IMAGENET1K_V1
        )
        model.features.load_state_dict(backbone.features.state_dict())
        if verbose:
            logger.info("Initialised DenseNet-121 features from torchvision ImageNet weights.")
        return model

    if init != "xrv":
        raise ValueError(f"init must be one of 'xrv', 'imagenet', 'scratch'; got {init!r}")

    # --- init == "xrv" -----------------------------------------------------
    # 1. Start from ImageNet so the stem (conv0 + norm0) matches our 3-channel
    #    ImageNet-normalised input.
    backbone = torchvision.models.densenet121(
        weights=torchvision.models.DenseNet121_Weights.IMAGENET1K_V1
    )
    model.features.load_state_dict(backbone.features.state_dict())

    # 2. Overwrite every layer we can with xrv's radiograph-trained tensors.
    try:
        import torchxrayvision as xrv  # noqa: PLC0415  (optional heavy import)

        xrv_model = xrv.models.DenseNet(weights="densenet121-res224-all")
        xrv_sd = _strip_xrv_only_buffers(xrv_model.state_dict())
        loaded, skipped = _load_state_dict_flexible(model, xrv_sd)

        if verbose:
            logger.info(
                "xrv transfer: loaded %d tensors, skipped %d (including the stem conv0, "
                "which must stay ImageNet-initialised for our 3-channel contract).",
                len(loaded),
                len(skipped),
            )
            stem_skipped = [k for k in skipped if "conv0" in k or "norm0" in k]
            if not stem_skipped:
                logger.warning(
                    "Expected the xrv stem (conv0/norm0) to be skipped for shape or naming "
                    "reasons, but it was not. Verify the input contract assumption in "
                    "model.py's module docstring before training."
                )
        return model

    except ImportError:
        logger.warning(
            "torchxrayvision is not installed — falling back to ImageNet initialisation. "
            "Install it with: pip install torchxrayvision"
        )
        return model


def count_parameters(model: nn.Module) -> tuple[int, int]:
    """Return (trainable, total) parameter counts."""
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    return trainable, total
