"""
M2 - Fine-tune the medical bi-encoder retriever, then evaluate it.

Usage
-----
    # Baseline only: how good is the off-the-shelf model on YOUR corpus?
    python training/train_retriever.py --baseline-only

    # Full run: baseline -> hard-negative mining -> fine-tune -> re-evaluate
    python training/train_retriever.py

    # Skip the hard-negative round (faster, lower quality)
    python training/train_retriever.py --skip-hard-negatives

Outputs
-------
    training/exports/mediagent-retriever/           the fine-tuned SentenceTransformer
    training/out/retriever_ablation.json            the comparison table for your report
    training/out/retriever_predictions.jsonl        per-query top-10, for error analysis

Why baseline-first matters
--------------------------
Most students fine-tune and report the fine-tuned number with nothing to compare
it to, which proves nothing. This script measures the off-the-shelf model on the
SAME query set first, so the ablation table in your report has a real baseline
row rather than an assumption.

Metrics
-------
InformationRetrievalEvaluator gives Recall@k, MRR@k and nDCG@k in the standard
formulation, so the numbers are comparable to published work. Recall@k is
derived from precision_recall_at_k: at each k, per-query recall is
|retrieved_k ∩ relevant| / |relevant|.
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
from collections import defaultdict
from pathlib import Path

from mediagent_training.config import (
    CORPUS_DIR,
    RETRIEVER_BASE_MODEL,
    RETRIEVER_BATCH_SIZE,
    RETRIEVER_EPOCHS,
    RETRIEVER_LR,
    RETRIEVER_OUTPUT_DIR,
    OUT_DIR,
    SEED,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("retriever")

PAIRS_PATH = CORPUS_DIR / "pairs.jsonl"

# Held-out fraction of QUERIES (not pairs) reserved for evaluation, so the
# encoder is never evaluated on a query it was trained on.
EVAL_QUERY_FRACTION = 0.20


def load_pairs(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"No training pairs at {path}\n"
            "Build them first:  python training/build_retrieval_pairs.py"
        )
    pairs: list[dict] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                pairs.append(json.loads(line))
    return pairs


def build_corpus(pairs: list[dict]) -> dict[str, str]:
    """chunk_id -> text, deduplicated."""
    corpus: dict[str, str] = {}
    for pair in pairs:
        corpus.setdefault(pair["chunk_id"], pair["text"])
    return corpus


def split_queries(pairs: list[dict], rng: random.Random) -> tuple[list[dict], list[dict]]:
    """
    Split by QUERY, not by pair.

    If the same query appeared in both train and eval, Recall@k would be
    measuring memorisation. Splitting on the query string is what prevents that.
    """
    by_query: dict[str, list[dict]] = defaultdict(list)
    for pair in pairs:
        by_query[pair["query"]].append(pair)

    queries = sorted(by_query.keys())
    rng.shuffle(queries)

    n_eval = max(1, int(len(queries) * EVAL_QUERY_FRACTION))
    eval_queries = set(queries[:n_eval])

    train_pairs: list[dict] = []
    eval_pairs: list[dict] = []
    for query, group in by_query.items():
        (eval_pairs if query in eval_queries else train_pairs).extend(group)

    logger.info(
        "Split by query: %d train queries / %d eval queries (%d train pairs, %d eval pairs)",
        len(queries) - n_eval, n_eval, len(train_pairs), len(eval_pairs),
    )
    return train_pairs, eval_pairs


def make_evaluator(eval_pairs: list[dict], corpus: dict[str, str], name: str):
    from sentence_transformers.evaluation import InformationRetrievalEvaluator

    queries: dict[str, str] = {}
    relevant: dict[str, set[str]] = defaultdict(set)

    for index, pair in enumerate(eval_pairs):
        query_id = f"q{index}"
        queries[query_id] = pair["query"]
        relevant[query_id].add(pair["chunk_id"])

    return InformationRetrievalEvaluator(
        queries=queries,
        corpus=corpus,
        relevant_docs=relevant,
        name=name,
        show_progress_bar=False,
        accuracy_at_k=[1, 5, 10],
        precision_recall_at_k=[1, 5, 10],
        mrr_at_k=[10],
        ndcg_at_k=[10],
    )


def extract_metrics(raw: dict, prefix: str) -> dict[str, float]:
    """
    Pull the numbers we care about out of the evaluator's flat result dict.

    Keys look like 'cosine_recall@5', 'cosine_mrr@10', 'cosine_ndcg@10'.
    """
    wanted: dict[str, float] = {}
    for key, value in raw.items():
        if not isinstance(value, (int, float)):
            continue
        for metric in ("recall@1", "recall@5", "recall@10", "mrr@10", "ndcg@10"):
            if key.endswith(metric):
                wanted[f"{prefix}{metric}"] = float(value)
    return wanted


def train(args, pairs: list[dict], corpus: dict[str, str], rng: random.Random) -> dict:
    from sentence_transformers import InputExample, SentenceTransformer, losses
    from torch.utils.data import DataLoader

    train_pairs, eval_pairs = split_queries(pairs, rng)
    evaluator = make_evaluator(eval_pairs, corpus, name="mediagent-retriever-eval")

    ablation: dict[str, dict[str, float]] = {}

    # ---- 1. baseline: off-the-shelf model on the same evaluation set --------
    logger.info("=" * 70)
    logger.info("BASELINE: %s (no fine-tuning)", RETRIEVER_BASE_MODEL)
    logger.info("=" * 70)
    model = SentenceTransformer(RETRIEVER_BASE_MODEL)
    baseline_scores = evaluator(model, output_path=str(OUT_DIR / "retriever_eval_baseline"))
    ablation["baseline_off_the_shelf"] = extract_metrics(baseline_scores, "baseline_")
    logger.info("Baseline metrics: %s", ablation["baseline_off_the_shelf"])

    if args.baseline_only:
        return ablation

    # ---- 2. build training examples ---------------------------------------
    examples = [InputExample(texts=[pair["query"], pair["text"]]) for pair in train_pairs]
    logger.info("Training examples: %d", len(examples))

    dataloader = DataLoader(examples, shuffle=True, batch_size=RETRIEVER_BATCH_SIZE)
    train_loss = losses.MultipleNegativesRankingLoss(model)

    # ---- 3. round 1: in-batch negatives -----------------------------------
    logger.info("=" * 70)
    logger.info("ROUND 1: in-batch negatives")
    logger.info("=" * 70)
    model.fit(
        train_objectives=[(dataloader, train_loss)],
        epochs=RETRIEVER_EPOCHS,
        warmup_steps=max(1, int(0.1 * len(dataloader) * RETRIEVER_EPOCHS)),
        optimizer_params={"lr": RETRIEVER_LR},
        show_progress_bar=True,
    )
    round1_scores = evaluator(model, output_path=str(OUT_DIR / "retriever_eval_round1"))
    ablation["round1_in_batch_negatives"] = extract_metrics(round1_scores, "round1_")
    logger.info("Round 1 metrics: %s", ablation["round1_in_batch_negatives"])

    # ---- 4. hard-negative mining and round 2 ------------------------------
    if not args.skip_hard_negatives:
        logger.info("=" * 70)
        logger.info("ROUND 2: hard negatives (top-%d, similarity %.2f-%.2f)",
                    args.hard_negative_top, args.hard_negative_min, args.hard_negative_max)
        logger.info("=" * 70)

        chunk_ids = list(corpus.keys())
        chunk_texts = [corpus[cid] for cid in chunk_ids]
        chunk_id_to_position = {cid: i for i, cid in enumerate(chunk_ids)}

        corpus_embeddings = model.encode(
            chunk_texts, batch_size=64, show_progress_bar=True, convert_to_tensor=True
        )

        triples: list[InputExample] = []
        mined = 0

        for pair in train_pairs:
            query_embedding = model.encode(pair["query"], convert_to_tensor=True)
            similarities = model.similarity(query_embedding, corpus_embeddings)[0]

            positive_position = chunk_id_to_position.get(pair["chunk_id"])
            if positive_position is None:
                continue

            top = similarities.topk(k=min(args.hard_negative_top, len(chunk_ids)))
            hard_negatives: list[str] = []
            for score, position in zip(top.values.tolist(), top.indices.tolist()):
                if position == positive_position:
                    continue
                if args.hard_negative_min <= score <= args.hard_negative_max:
                    hard_negatives.append(chunk_texts[position])
                if len(hard_negatives) >= args.hard_negatives_per_query:
                    break

            if hard_negatives:
                triples.append(InputExample(texts=[pair["query"], pair["text"], *hard_negatives]))
                mined += 1

        logger.info("Mined hard negatives for %d / %d training pairs", mined, len(train_pairs))

        if triples:
            triple_loader = DataLoader(triples, shuffle=True, batch_size=RETRIEVER_BATCH_SIZE)
            model.fit(
                train_objectives=[(triple_loader, losses.MultipleNegativesRankingLoss(model))],
                epochs=max(1, RETRIEVER_EPOCHS - 1),
                warmup_steps=max(1, int(0.1 * len(triple_loader))),
                optimizer_params={"lr": RETRIEVER_LR / 2},
                show_progress_bar=True,
            )

            round2_scores = evaluator(model, output_path=str(OUT_DIR / "retriever_eval_round2"))
            ablation["round2_plus_hard_negatives"] = extract_metrics(round2_scores, "round2_")
            logger.info("Round 2 metrics: %s", ablation["round2_plus_hard_negatives"])
        else:
            logger.warning("No hard negatives mined; skipping round 2.")

    # ---- 5. save ----------------------------------------------------------
    RETRIEVER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model.save(str(RETRIEVER_OUTPUT_DIR))
    logger.info("Saved fine-tuned retriever to %s", RETRIEVER_OUTPUT_DIR)

    # ---- 6. per-query predictions for error analysis ----------------------
    predictions = []
    chunk_texts = [corpus[cid] for cid in corpus]
    chunk_ids = list(corpus.keys())
    corpus_embeddings = model.encode(chunk_texts, batch_size=64, convert_to_tensor=True)

    for index, pair in enumerate(eval_pairs[:200]):
        query_embedding = model.encode(pair["query"], convert_to_tensor=True)
        similarities = model.similarity(query_embedding, corpus_embeddings)[0]
        top = similarities.topk(k=min(10, len(chunk_ids)))
        retrieved = [chunk_ids[position] for position in top.indices.tolist()]

        predictions.append({
            "query": pair["query"],
            "gold_chunk_id": pair["chunk_id"],
            "rank_of_gold": (retrieved.index(pair["chunk_id"]) + 1) if pair["chunk_id"] in retrieved else None,
            "top_10_chunk_ids": retrieved,
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with (OUT_DIR / "retriever_predictions.jsonl").open("w", encoding="utf-8") as fh:
        for row in predictions:
            fh.write(json.dumps(row) + "\n")

    return ablation


def evaluate_hybrid_and_rerank(model, eval_pairs: list[dict], corpus: dict[str, str]) -> dict:
    """
    Optional stage: measure what a reranker is worth.

    Deliberately optional, because the cross-encoder is an extra ~1 GB of weights
    and runs only over the top-N candidates. Report the lift separately and let
    the reader decide whether it justifies the cost in the serving path.
    """
    try:
        from sentence_transformers import CrossEncoder
    except ImportError:
        return {"reranker": "sentence-transformers CrossEncoder unavailable"}

    from mediagent_training.config import RERANKER_MODEL, RERANK_TOP_N

    try:
        cross_encoder = CrossEncoder(RERANKER_MODEL)
    except Exception as exc:
        return {"reranker": f"could not load {RERANKER_MODEL}: {exc}"}

    chunk_ids = list(corpus.keys())
    chunk_texts = [corpus[cid] for cid in chunk_ids]
    corpus_embeddings = model.encode(chunk_texts, batch_size=64, convert_to_tensor=True)

    hits_at_1 = 0
    hits_at_4 = 0
    total = 0

    for pair in eval_pairs[:200]:
        query_embedding = model.encode(pair["query"], convert_to_tensor=True)
        similarities = model.similarity(query_embedding, corpus_embeddings)[0]
        top = similarities.topk(k=min(RERANK_TOP_N, len(chunk_ids)))

        candidate_ids = [chunk_ids[position] for position in top.indices.tolist()]
        candidate_texts = [corpus[cid] for cid in candidate_ids]

        pairs = [[pair["query"], text] for text in candidate_texts]
        scores = cross_encoder.predict(pairs)
        order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        reranked = [candidate_ids[i] for i in order]

        total += 1
        if pair["chunk_id"] in reranked[:1]:
            hits_at_1 += 1
        if pair["chunk_id"] in reranked[:4]:
            hits_at_4 += 1

    if not total:
        return {"reranker": "no evaluation pairs"}

    return {
        "reranker_model": RERANKER_MODEL,
        "reranked_recall@1": round(hits_at_1 / total, 4),
        "reranked_recall@4": round(hits_at_4 / total, 4),
        "note_reranker_runs_over_top_n": RERANK_TOP_N,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the MediAgent retriever (M2)")
    parser.add_argument("--baseline-only", action="store_true",
                        help="Only measure the off-the-shelf model. No training.")
    parser.add_argument("--skip-hard-negatives", action="store_true")
    parser.add_argument("--hard-negative-top", type=int, default=50)
    parser.add_argument("--hard-negatives-per-query", type=int, default=3)
    parser.add_argument("--hard-negative-min", type=float, default=0.60)
    parser.add_argument("--hard-negative-max", type=float, default=0.90)
    parser.add_argument("--with-reranker-eval", action="store_true",
                        help="Also measure cross-encoder reranking lift (downloads ~1 GB).")
    parser.add_argument("--pairs", type=str, default=str(PAIRS_PATH))
    args = parser.parse_args()

    rng = random.Random(SEED)

    pairs = load_pairs(Path(args.pairs))
    corpus = build_corpus(pairs)
    logger.info("Loaded %d pairs covering %d unique chunks", len(pairs), len(corpus))

    ablation = train(args, pairs, corpus, rng)

    if not args.baseline_only:
        model = model_handle = None
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(str(RETRIEVER_OUTPUT_DIR))
        except Exception as exc:
            logger.warning("Could not reload fine-tuned model for reranker eval: %s", exc)

        if model is not None and args.with_reranker_eval:
            _, eval_pairs = split_queries(pairs, random.Random(SEED))
            ablation["reranker"] = evaluate_hybrid_and_rerank(model, eval_pairs, corpus)

    # ---- report -----------------------------------------------------------
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "retriever_ablation.json").write_text(
        json.dumps(ablation, indent=2), encoding="utf-8"
    )

    print()
    print("=" * 90)
    print("Retriever ablation (evaluation queries held out by query, not by pair)")
    print("=" * 90)
    metric_keys = ["recall@1", "recall@5", "recall@10", "mrr@10", "ndcg@10"]
    header = f"{'Configuration':<34}" + "".join(f"{k:>12}" for k in metric_keys)
    print(header)
    print("-" * 90)
    for config_name, metrics in ablation.items():
        if not isinstance(metrics, dict):
            continue
        row = f"{config_name:<34}"
        for key in metric_keys:
            value = None
            for candidate_key, candidate_value in metrics.items():
                if candidate_key.endswith(key):
                    value = candidate_value
                    break
            row += f"{value:>12.4f}" if isinstance(value, float) else f"{'--':>12}"
        print(row)
    print("-" * 90)
    print()
    print(f"Full ablation written to {OUT_DIR / 'retriever_ablation.json'}")
    print()
    print("Next steps:")
    print("  1. Export the encoder for the Node runtime:")
    print("       python training/export_retriever_onnx.py")
    print("  2. Build the corpus embeddings the Node retriever loads:")
    print("       python training/export_retriever_onnx.py --build-embeddings")
    print("=" * 90)
    return 0


if __name__ == "__main__":
    sys.exit(main())
