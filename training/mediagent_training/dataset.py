"""
NIH ChestX-ray14 dataset with patient-level splitting and preprocessing that
EXACTLY matches what the deployed TypeScript does at inference time.

Why the preprocessing must match
--------------------------------
server/models/radiologyModel.ts calls:

    sharp(buf).resize(224, 224, { fit: 'fill' }).removeAlpha().raw()

`fit: 'fill'` means NON-UNIFORM resize - the image is stretched to exactly
224x224 with no aspect-ratio preservation and no cropping. If training used
RandomResizedCrop (aspect-preserving), the model would see a different geometry
at train and serve time. That is a real accuracy leak and an easy one to miss.

So this module uses:
  * eval  -> plain non-uniform Resize((224, 224))
  * train -> non-uniform Resize((320, 320)) followed by aspect-agnostic
             augmentation (flip, small affine, colour jitter)

RandomResizedCrop is deliberately NOT used for that reason. Mild scale jitter
is achieved with RandomAffine instead.

Channel handling: NIH images are single-channel PNGs. The TypeScript path calls
removeAlpha() and reads 3 channels, so a grayscale image becomes three
identical channels. `convert("RGB")` reproduces that exactly.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

from .config import (
    BATCH_SIZE,
    IMAGE_SIZE_EVAL,
    IMAGE_SIZE_TRAIN,
    NIH_ENTRY_CSV,
    NIH_IMAGES_DIR,
    NIH_TEST_LIST,
    NIH_TRAINVAL_LIST,
    NUM_WORKERS,
    SEED,
    USE_OFFICIAL_SPLIT,
    VAL_FRACTION,
)
from .labels import IMAGENET_MEAN, IMAGENET_STD, NIH_CHESTXRAY14_LABELS, NUM_LABELS

logger = logging.getLogger(__name__)

# NIH label strings as they appear in Data_Entry_2017.csv.
_NIH_CSV_LABEL_TO_INDEX: dict[str, int] = {
    name: idx for idx, name in enumerate(NIH_CHESTXRAY14_LABELS)
}


# ---------------------------------------------------------------------------
# Index building
# ---------------------------------------------------------------------------
def _build_image_index(images_dir: Path) -> dict[str, Path]:
    """
    Map 'Image Index' (e.g. '00000001_000.png') -> absolute path.

    Accepts either a single flat directory or the original 12-folder layout
    (images_001/images .. images_012/images), so you can point it at whatever
    you extracted.
    """
    index: dict[str, Path] = {}
    if not images_dir.exists():
        return index

    for png in images_dir.rglob("*.png"):
        index[png.name] = png
    return index


def _read_id_list(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open("r", encoding="utf-8") as fh:
        return {line.strip() for line in fh if line.strip()}


def _multi_hot(label_field: str) -> np.ndarray:
    """
    Convert the '|'-separated Finding Labels field into a 14-dim multi-hot vector.

    'No Finding' rows become an all-zero vector, which is correct: 'No Finding'
    is not a ChestX-ray14 column, it is the state of all-14-negative. Those rows
    are kept because they are legitimate negatives for every class.
    """
    vec = np.zeros(NUM_LABELS, dtype=np.float32)
    for token in str(label_field).split("|"):
        token = token.strip()
        if not token or token == "No Finding":
            continue
        idx = _NIH_CSV_LABEL_TO_INDEX.get(token)
        if idx is None:
            # Unknown token: trace it rather than silently dropping.
            logger.debug("Unmapped NIH finding label token: %r", token)
            continue
        vec[idx] = 1.0
    return vec


def load_nih_dataframe() -> pd.DataFrame:
    """
    Load Data_Entry_2017.csv and attach the patient-level split assignment.

    Columns used: 'Image Index', 'Finding Labels', 'Patient ID',
                  'Patient Age', 'Patient Gender', 'View Position'.
    """
    if not NIH_ENTRY_CSV.exists():
        raise FileNotFoundError(
            f"Missing {NIH_ENTRY_CSV}.\n"
            "Download the NIH ChestX-ray14 metadata from:\n"
            "  https://nihcc.app.box.com/v/ChestXray-NIHCC\n"
            "and place Data_Entry_2017.csv, train_val_list.txt and test_list.txt\n"
            f"in {NIH_ENTRY_CSV.parent}"
        )

    df = pd.read_csv(NIH_ENTRY_CSV)

    # The official CSV column names have varied slightly between releases.
    rename = {}
    for col in df.columns:
        low = col.strip().lower().replace(" ", "_")
        if low == "image_index":
            rename[col] = "image_index"
        elif low == "finding_labels":
            rename[col] = "finding_labels"
        elif low == "patient_id":
            rename[col] = "patient_id"
        elif low == "patient_age":
            rename[col] = "patient_age"
        elif low == "patient_gender":
            rename[col] = "patient_gender"
        elif low == "view_position":
            rename[col] = "view_position"
    df = df.rename(columns=rename)

    required = {"image_index", "finding_labels", "patient_id"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Data_Entry_2017.csv is missing expected columns {sorted(missing)}. "
            f"Found: {sorted(df.columns)}"
        )

    # ---- split assignment -------------------------------------------------
    if USE_OFFICIAL_SPLIT and NIH_TRAINVAL_LIST.exists() and NIH_TEST_LIST.exists():
        trainval_ids = _read_id_list(NIH_TRAINVAL_LIST)
        test_ids = _read_id_list(NIH_TEST_LIST)

        df["split"] = np.where(
            df["image_index"].isin(test_ids),
            "test",
            np.where(df["image_index"].isin(trainval_ids), "trainval", "unassigned"),
        )
        n_unassigned = int((df["split"] == "unassigned").sum())
        if n_unassigned:
            logger.warning(
                "%d images were in neither official list and will be dropped.", n_unassigned
            )
            df = df[df["split"] != "unassigned"].copy()

        # Carve a PATIENT-level validation set out of train_val. Splitting by
        # patient (not by image) is what prevents the leakage that makes
        # coursework AUC numbers meaningless.
        trainval_patients = df.loc[df["split"] == "trainval", "patient_id"].unique()
        rng = np.random.default_rng(SEED)
        shuffled = rng.permutation(trainval_patients)
        n_val = int(len(shuffled) * VAL_FRACTION)
        val_patients = set(shuffled[:n_val].tolist())

        df.loc[df["patient_id"].isin(val_patients), "split"] = "val"
        df.loc[df["split"] == "trainval", "split"] = "train"

        logger.info(
            "Official patient-level split: train=%d val=%d test=%d (val carved from "
            "%d train_val patients)",
            int((df["split"] == "train").sum()),
            int((df["split"] == "val").sum()),
            int((df["split"] == "test").sum()),
            len(trainval_patients),
        )
    else:
        # Fallback: patient-level random split. Never image-level.
        logger.warning(
            "Official split files not found at %s / %s - falling back to a "
            "patient-level random split. Prefer the official lists for "
            "comparability with published results.",
            NIH_TRAINVAL_LIST,
            NIH_TEST_LIST,
        )
        patients = df["patient_id"].unique()
        rng = np.random.default_rng(SEED)
        shuffled = rng.permutation(patients)
        n_test = int(len(shuffled) * 0.15)
        n_val = int(len(shuffled) * VAL_FRACTION)
        test_p = set(shuffled[:n_test].tolist())
        val_p = set(shuffled[n_test:n_test + n_val].tolist())

        df["split"] = "train"
        df.loc[df["patient_id"].isin(val_p), "split"] = "val"
        df.loc[df["patient_id"].isin(test_p), "split"] = "test"

    # ---- multi-hot labels -------------------------------------------------
    label_matrix = np.stack([_multi_hot(v) for v in df["finding_labels"].tolist()])
    df["labels"] = list(label_matrix)

    return df


def compute_pos_weight(df: pd.DataFrame) -> torch.Tensor:
    """
    Per-class pos_weight = negatives / positives, for BCEWithLogitsLoss.

    ChestX-ray14 is severely imbalanced (Hernia ~227 positives vs Infiltration
    ~19,894). Without this, rare classes are ignored by the optimiser and score
    near-chance AUC.
    """
    train_labels = np.stack(df.loc[df["split"] == "train", "labels"].tolist())
    positives = train_labels.sum(axis=0)
    negatives = len(train_labels) - positives

    # Guard against a class with zero positives in the training split.
    positives = np.clip(positives, 1.0, None)
    weights = negatives / positives

    for name, pos, w in zip(NIH_CHESTXRAY14_LABELS, positives, weights):
        logger.info("pos_weight %-20s positives=%6d  weight=%8.2f", name, int(pos), w)
    return torch.tensor(weights, dtype=torch.float32)


def describe_split(df: pd.DataFrame) -> str:
    """Human-readable class-prevalence table - paste this into the report."""
    lines = [
        "", "Class prevalence by split", "-" * 74,
        f"{'Label':<22}{'train':>12}{'val':>12}{'test':>12}{'total':>14}", "-" * 74,
    ]
    for i, name in enumerate(NIH_CHESTXRAY14_LABELS):
        counts = []
        for split in ("train", "val", "test"):
            subset = df[df["split"] == split]
            counts.append(int(sum(int(vec[i]) for vec in subset["labels"])))
        lines.append(
            f"{name:<22}{counts[0]:>12}{counts[1]:>12}{counts[2]:>12}{sum(counts):>14}"
        )
    lines.append("-" * 74)
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Transforms - must mirror the TypeScript inference pipeline
# ---------------------------------------------------------------------------
def build_train_transform(image_size: int = IMAGE_SIZE_TRAIN) -> transforms.Compose:
    """
    Non-uniform resize (matches `fit: 'fill'`) plus aspect-agnostic augmentation.

    Augmentation policy rationale:
      * horizontal flip is safe: none of the 14 NIH labels encode laterality.
        Do NOT use it if you extend to left/right-specific CheXpert labels.
      * small affine only: rotation beyond ~10 degrees produces anatomically
        impossible films that teach the model nothing useful.
      * CutMix / MixUp are deliberately excluded - blending two chest films
        produces an image that corresponds to no real pathology, and it measurably
        hurts medical multi-label performance.
    """
    return transforms.Compose([
        transforms.Grayscale(num_output_channels=3),
        transforms.Resize((image_size, image_size)),    # non-uniform, like sharp fit:'fill'
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomAffine(
            degrees=10,
            translate=(0.05, 0.05),
            scale=(0.92, 1.08),
            fill=0,
        ),
        transforms.ColorJitter(brightness=0.10, contrast=0.10),
        transforms.ToTensor(),
        transforms.Normalize(mean=list(IMAGENET_MEAN), std=list(IMAGENET_STD)),
    ])


def build_eval_transform(image_size: int = IMAGE_SIZE_EVAL) -> transforms.Compose:
    """
    Deterministic, and equivalent to what the TS pipeline feeds the ONNX session:
    convert to 3 channels, non-uniform resize to 224x224, scale to [0,1],
    ImageNet-normalise.
    """
    return transforms.Compose([
        transforms.Grayscale(num_output_channels=3),
        transforms.Resize((image_size, image_size)),    # non-uniform
        transforms.ToTensor(),
        transforms.Normalize(mean=list(IMAGENET_MEAN), std=list(IMAGENET_STD)),
    ])


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
class NIHChestXrayDataset(Dataset):
    """One row per radiograph; returns (image_tensor, multi_hot_label, index)."""

    def __init__(
        self,
        df: pd.DataFrame,
        images_dir: Path,
        transform: transforms.Compose,
        image_index: dict[str, Path] | None = None,
    ) -> None:
        self.df = df.reset_index(drop=True)
        self.transform = transform
        self.image_index = (
            image_index if image_index is not None else _build_image_index(images_dir)
        )

        if not self.image_index:
            raise FileNotFoundError(
                f"No images found under {images_dir}.\n"
                "Extract images_001.tar.gz .. images_012.tar.gz and point NIH_IMAGES_DIR "
                "at the directory containing the .png files (nested folders are fine)."
            )

        # Drop rows whose image file is missing, and say so loudly.
        before = len(self.df)
        mask = [name in self.image_index for name in self.df["image_index"].tolist()]
        self.df = self.df[mask].reset_index(drop=True)
        missing = before - len(self.df)
        if missing:
            logger.warning(
                "%d of %d rows had no image file on disk and were skipped.",
                missing, before,
            )

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        path = self.image_index[row["image_index"]]

        with Image.open(path) as img:
            image = img.convert("RGB")

        tensor = self.transform(image)
        label = torch.tensor(np.asarray(row["labels"], dtype=np.float32))
        return tensor, label, idx

    def labels_matrix(self) -> np.ndarray:
        """All labels as a dense array - used for pos_weight and threshold fitting."""
        return np.stack(self.df["labels"].tolist()).astype(np.float32)


def build_dataloaders(
    df: pd.DataFrame,
    images_dir: Path = NIH_IMAGES_DIR,
    batch_size: int = BATCH_SIZE,
    num_workers: int = NUM_WORKERS,
) -> dict[str, DataLoader]:
    """Return {'train','val','test'} DataLoaders. Test is not shuffled."""
    image_index = _build_image_index(images_dir)
    train_tf = build_train_transform()
    eval_tf = build_eval_transform()

    loaders: dict[str, DataLoader] = {}
    for split in ("train", "val", "test"):
        subset = df[df["split"] == split]
        if subset.empty:
            continue
        is_train = split == "train"
        dataset = NIHChestXrayDataset(
            subset,
            images_dir,
            train_tf if is_train else eval_tf,
            image_index=image_index,
        )
        loaders[split] = DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=is_train,
            num_workers=num_workers,
            pin_memory=torch.cuda.is_available(),
            drop_last=is_train,
            persistent_workers=num_workers > 0,
        )
        logger.info("Loaded %s split: %d images", split, len(dataset))

    return loaders
