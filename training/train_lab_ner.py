"""
M3 - Train a custom SpaCy Named Entity Recognition (NER) model on clinical lab reports.

Extracts:
  - TEST_NAME (e.g., WBC, Creatinine, Troponin I, Alanine Aminotransferase)
  - VALUE     (e.g., 5.1, 125.4, 21.7)
  - UNIT      (e.g., mg/dL, mmol/L, 10^3/uL, ng/mL)
  - REF_RANGE (e.g., 4.5-11, < 5.0, 7.35-7.45)
  - FLAG      (e.g., H, HH, L, CRITICAL)
"""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path
import spacy
from spacy.tokens import DocBin, Doc
from spacy.training import Example
from spacy.scorer import Scorer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("train_lab_ner")

DATA_FILE = Path("training/data/raw/lab_ner_synthetic.jsonl")
EXPORT_DIR = Path("training/exports/spacy_lab_ner")
OUT_DIR = Path("training/out")


def bio_to_entities(tokens: list[str], tags: list[str]) -> tuple[str, list[tuple[int, int, str]]]:
    """Convert token sequence + BIO tags into full text and (start, end, label) spans."""
    text_parts = []
    offsets = []
    current_pos = 0

    for tok in tokens:
        start = current_pos
        end = start + len(tok)
        offsets.append((start, end))
        text_parts.append(tok)
        current_pos = end + 1

    full_text = " ".join(text_parts)

    entities: list[tuple[int, int, str]] = []
    current_label: str | None = None
    ent_start: int | None = None
    ent_end: int | None = None

    for i, (tok, tag) in enumerate(zip(tokens, tags)):
        tok_start, tok_end = offsets[i]

        if tag.startswith("B-"):
            if current_label is not None and ent_start is not None and ent_end is not None:
                entities.append((ent_start, ent_end, current_label))
            current_label = tag[2:]
            ent_start = tok_start
            ent_end = tok_end
        elif tag.startswith("I-"):
            tag_label = tag[2:]
            if current_label == tag_label:
                ent_end = tok_end
            else:
                if current_label is not None and ent_start is not None and ent_end is not None:
                    entities.append((ent_start, ent_end, current_label))
                current_label = tag_label
                ent_start = tok_start
                ent_end = tok_end
        else:  # 'O'
            if current_label is not None and ent_start is not None and ent_end is not None:
                entities.append((ent_start, ent_end, current_label))
            current_label = None
            ent_start = None
            ent_end = None

    if current_label is not None and ent_start is not None and ent_end is not None:
        entities.append((ent_start, ent_end, current_label))

    return full_text, entities


def load_dataset() -> list[tuple[str, dict]]:
    """Load JSONL and convert to SpaCy format."""
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_FILE}")

    raw_examples = []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            tokens = rec["tokens"]
            tags = rec["tags"]
            text, ents = bio_to_entities(tokens, tags)
            raw_examples.append((text, {"entities": ents}))

    logger.info(f"Loaded {len(raw_examples)} clinical lab records from {DATA_FILE}")
    return raw_examples


def train():
    random.seed(42)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    data = load_dataset()
    random.shuffle(data)

    split_idx = int(0.8 * len(data))
    train_data = data[:split_idx]
    test_data = data[split_idx:]
    logger.info(f"Train split: {len(train_data)} | Test split: {len(test_data)}")

    # Initialize blank English model with NER pipeline
    nlp = spacy.blank("en")
    ner = nlp.add_pipe("ner", last=True)

    labels = set()
    for _, annot in data:
        for _, _, label in annot["entities"]:
            labels.add(label)

    for label in sorted(labels):
        ner.add_label(label)
        logger.info(f"Registered entity label: {label}")

    # Prepare training examples
    train_examples: list[Example] = []
    for text, annot in train_data:
        doc = nlp.make_doc(text)
        example = Example.from_dict(doc, annot)
        train_examples.append(example)

    test_examples: list[Example] = []
    for text, annot in test_data:
        doc = nlp.make_doc(text)
        example = Example.from_dict(doc, annot)
        test_examples.append(example)

    # Train loop
    optimizer = nlp.initialize(get_examples=lambda: train_examples)
    epochs = 25
    batch_size = 8

    logger.info(f"Starting NER training for {epochs} epochs...")
    history = []

    for epoch in range(1, epochs + 1):
        random.shuffle(train_examples)
        losses = {}
        for i in range(0, len(train_examples), batch_size):
            batch = train_examples[i:i + batch_size]
            nlp.update(batch, drop=0.2, sgd=optimizer, losses=losses)

        if epoch % 5 == 0 or epoch == epochs:
            # Evaluate on test split
            scorer = Scorer()
            eval_examples = []
            for text, annot in test_data:
                pred_doc = nlp(text)
                gold_doc = nlp.make_doc(text)
                eval_examples.append(Example.from_dict(pred_doc, annot))

            scores = scorer.score(eval_examples)
            ents_p = scores.get("ents_p", 0.0)
            ents_r = scores.get("ents_r", 0.0)
            ents_f = scores.get("ents_f", 0.0)

            logger.info(
                f"Epoch {epoch:2d}/{epochs} - Loss: {losses.get('ner', 0.0):.4f} "
                f"- Test P: {ents_p:.3f}, R: {ents_r:.3f}, F1: {ents_f:.3f}"
            )
            history.append({
                "epoch": epoch,
                "loss": float(losses.get("ner", 0.0)),
                "precision": float(ents_p),
                "recall": float(ents_r),
                "f1": float(ents_f),
            })

    # Final detailed per-entity evaluation
    final_scorer = Scorer()
    final_eval_examples = []
    for text, annot in test_data:
        pred_doc = nlp(text)
        final_eval_examples.append(Example.from_dict(pred_doc, annot))

    final_scores = final_scorer.score(final_eval_examples)

    # Save model
    nlp.to_disk(EXPORT_DIR)
    logger.info(f"Saved trained SpaCy model to {EXPORT_DIR}")

    # Save report
    report_file = OUT_DIR / "lab_ner_evaluation.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump({
            "overall": {
                "precision": final_scores.get("ents_p", 0.0),
                "recall": final_scores.get("ents_r", 0.0),
                "f1": final_scores.get("ents_f", 0.0),
            },
            "per_type": final_scores.get("ents_per_type", {}),
            "history": history,
        }, f, indent=2)

    logger.info(f"Evaluation report written to {report_file}")
    print("\n" + "=" * 60)
    print("M3 LAB NER MODEL TRAINING COMPLETE")
    print(f"Overall Precision: {final_scores.get('ents_p', 0.0):.4f}")
    print(f"Overall Recall:    {final_scores.get('ents_r', 0.0):.4f}")
    print(f"Overall F1-Score:  {final_scores.get('ents_f', 0.0):.4f}")
    print("Per-entity breakdown:")
    for ent_type, metrics in final_scores.get("ents_per_type", {}).items():
        print(f"  {ent_type:<15} P: {metrics.get('p', 0):.3f} | R: {metrics.get('r', 0):.3f} | F1: {metrics.get('f', 0):.3f}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    train()
