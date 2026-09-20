"""
M2 - Export the fine-tuned retriever and precompute corpus embeddings.

Usage
-----
    python training/export_retriever_onnx.py                     # ONNX encoder + tokenizer
    python training/export_retriever_onnx.py --build-embeddings  # also precompute corpus vectors
    python training/export_retriever_onnx.py --verify            # check ONNX/torch parity

Outputs
-------
    training/exports/mediagent-retriever-onnx/model.onnx          the encoder graph
    training/exports/mediagent-retriever-onnx/tokenizer.json      WordPiece vocab + merges
    training/exports/mediagent-retriever-onnx/tokenizer_config.json
    training/exports/mediagent-retriever-onnx/manifest.json       dim, pooling, normalisation
    training/data/corpus/embeddings.f16.bin                       L2-normalised, float16, N x dim
    training/data/corpus/embeddings_index.json                    chunk_id order for the .bin

How the Node side uses this
---------------------------
1. Load embeddings.f16.bin into a Float32Array at boot (see server/rag/corpus.ts).
2. Encode the incoming query with the SAME encoder, mean-pool with the attention
   mask, L2-normalise.
3. Dot-product against every corpus vector and take the top-k.

At ~5,000 chunks x 768 dims that is ~7.7 MB and an exact scan takes ~1-3 ms in
Node - FAISS is unnecessary at this scale. Beyond ~50k chunks, switch to FAISS
HNSW in a sidecar.

Query encoding needs a tokenizer in Node. Two honest options:
  (a) Add `@huggingface/transformers` to package.json - it loads the tokenizer
      AND runs the ONNX graph, so you may not even need the exported .onnx.
  (b) Keep a small Python sidecar for /embed only, and do the dot products in Node.
Pick one deliberately and say which in your report. Do NOT hand-roll WordPiece
tokenisation unless you intend to test it against the reference output below.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np

from mediagent_training.config import (
    CORPUS_DIR,
    EMBEDDING_DIM,
    RETRIEVER_OUTPUT_DIR,
    SEED,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("export_retriever")

ONNX_DIR = RETRIEVER_OUTPUT_DIR.parent / "mediagent-retriever-onnx"
CHUNKS_PATH = CORPUS_DIR / "chunks.jsonl"
EMBEDDINGS_BIN = CORPUS_DIR / "embeddings.f16.bin"
EMBEDDINGS_INDEX = CORPUS_DIR / "embeddings_index.json"


def check_model_exists() -> None:
    if not RETRIEVER_OUTPUT_DIR.exists():
        raise FileNotFoundError(
            f"No fine-tuned retriever at {RETRIEVER_OUTPUT_DIR}\n"
            "Train it first:  python training/train_retriever.py"
        )


def export_onnx() -> Path:
    """Export via optimum, which handles the pooling layer correctly."""
    from optimum.onnxruntime import ORTModelForFeatureExtraction
    from transformers import AutoTokenizer

    check_model_exists()
    ONNX_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("Exporting %s to ONNX...", RETRIEVER_OUTPUT_DIR)
    model = ORTModelForFeatureExtraction.from_pretrained(str(RETRIEVER_OUTPUT_DIR), export=True)
    model.save_pretrained(str(ONNX_DIR))

    tokenizer = AutoTokenizer.from_pretrained(str(RETRIEVER_OUTPUT_DIR))
    tokenizer.save_pretrained(str(ONNX_DIR))

    model_path = ONNX_DIR / "model.onnx"
    if not model_path.exists():
        # optimum sometimes nests it; find whatever .onnx landed.
        candidates = list(ONNX_DIR.rglob("*.onnx"))
        if not candidates:
            raise RuntimeError(f"optimum produced no .onnx under {ONNX_DIR}")
        model_path = candidates[0]

    logger.info("Wrote %s (%.1f MB)", model_path, model_path.stat().st_size / (1024 * 1024))
    return model_path


def verify_onnx() -> bool:
    """
    Confirm the ONNX graph produces the same embeddings as the PyTorch model.

    Mean pooling with the attention mask is the step that is easy to get wrong -
    mean-pooling without masking averages in padding tokens and silently degrades
    every embedding. This check catches that.
    """
    from onnxruntime import InferenceSession
    from sentence_transformers import SentenceTransformer
    from transformers import AutoTokenizer

    check_model_exists()

    model = SentenceTransformer(str(RETRIEVER_OUTPUT_DIR))
    tokenizer = AutoTokenizer.from_pretrained(str(ONNX_DIR))

    model_path = ONNX_DIR / "model.onnx"
    if not model_path.exists():
        candidates = list(ONNX_DIR.rglob("*.onnx"))
        if not candidates:
            logger.error("No .onnx file to verify.")
            return False
        model_path = candidates[0]

    session = InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_names = {i.name for i in session.get_inputs()}

    sentences = [
        "How should community-acquired pneumonia be triaged?",
        "What is the Wells score for pulmonary embolism?",
        "When is dialysis indicated in acute kidney injury?",
    ]

    reference = model.encode(sentences, convert_to_numpy=True, normalize_embeddings=False)
    diffs = []

    for index, sentence in enumerate(sentences):
        encoded = tokenizer(sentence, return_tensors="np", padding=True, truncation=True)

        feeds = {}
        for name in ("input_ids", "attention_mask", "token_type_ids"):
            if name in input_names and name in encoded:
                feeds[name] = encoded[name].astype(np.int64)
        if "input_ids" not in feeds:
            logger.error("ONNX graph has no input_ids; cannot verify.")
            return False

        output = session.run(None, feeds)[0]                    # (batch, seq, hidden)

        mask = encoded["attention_mask"].astype(np.float32)[..., None]
        masked = output * mask
        pooled = masked.sum(axis=1) / np.clip(mask.sum(axis=1), 1e-9, None)

        diff = float(np.max(np.abs(pooled[0] - reference[index])))
        diffs.append(diff)

    max_diff = float(np.max(diffs))
    passed = max_diff < 1e-3

    if passed:
        logger.info("ONNX parity PASSED: max |Δembedding| = %.2e", max_diff)
    else:
        logger.error(
            "ONNX parity FAILED: max |Δembedding| = %.2e. The most likely cause is "
            "mean pooling that does not respect the attention mask.",
            max_diff,
        )
    return passed


def load_chunks() -> list[dict]:
    if not CHUNKS_PATH.exists():
        raise FileNotFoundError(
            f"No corpus at {CHUNKS_PATH}\n"
            "Build it:  python training/ingest_guidelines.py --dir <your_pdfs>"
        )
    chunks: list[dict] = []
    with CHUNKS_PATH.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    return chunks


def build_embeddings() -> None:
    """
    Encode every chunk once and write a float16 matrix the Node runtime can mmap.

    Each vector is L2-normalised, so the Node side only needs a dot product.
    float16 halves the file size for a negligible retrieval difference at this
    scale; cast back to float32 in Node when loading.
    """
    from sentence_transformers import SentenceTransformer

    chunks = load_chunks()
    logger.info("Encoding %d chunks...", len(chunks))

    model = SentenceTransformer(str(RETRIEVER_OUTPUT_DIR))
    dimension = model.get_sentence_embedding_dimension()

    texts = [chunk["text"] for chunk in chunks]
    embeddings = model.encode(
        texts,
        batch_size=64,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    ).astype(np.float16)

    EMBEDDINGS_BIN.parent.mkdir(parents=True, exist_ok=True)
    embeddings.tofile(str(EMBEDDINGS_BIN))

    index = {
        "dimension": int(dimension),
        "dtype": "float16",
        "normalized": True,
        "count": len(chunks),
        "layout": "row-major, count x dimension",
        "chunk_ids": [chunk["chunk_id"] for chunk in chunks],
        "note": (
            "Load with fs.readFileSync and new Float16Array/Uint16Array view, then "
            "cast to Float32Array. Rows are L2-normalised, so cosine == dot product."
        ),
    }
    EMBEDDINGS_INDEX.write_text(json.dumps(index, indent=2), encoding="utf-8")

    logger.info(
        "Wrote %s (%.1f MB, %d x %d)",
        EMBEDDINGS_BIN, EMBEDDINGS_BIN.stat().st_size / (1024 * 1024), len(chunks), dimension,
    )


def write_manifest() -> None:
    manifest = {
        "base_model": str(RETRIEVER_OUTPUT_DIR.name),
        "embedding_dimension": EMBEDDING_DIM,
        "pooling": "mean",
        "pooling_note": "mean pooling MUST use the attention mask; see export_retriever_onnx.py verify_onnx()",
        "normalize": True,
        "similarity": "cosine (equivalent to dot product on L2-normalised vectors)",
        "max_sequence_length": 512,
        "consumed_by": "server/rag/guidelines.ts -> searchClinicalGuidelines()",
    }
    ONNX_DIR.mkdir(parents=True, exist_ok=True)
    (ONNX_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> int:
    np.random.seed(SEED)

    parser = argparse.ArgumentParser(description="Export the M2 retriever for the Node runtime")
    parser.add_argument("--skip-onnx", action="store_true",
                        help="Only build corpus embeddings.")
    parser.add_argument("--build-embeddings", action="store_true")
    parser.add_argument("--verify", action="store_true",
                        help="Check ONNX vs PyTorch embedding parity.")
    args = parser.parse_args()

    check_model_exists()

    if not args.skip_onnx:
        export_onnx()
        write_manifest()

    if args.verify:
        if not verify_onnx():
            logger.error("VERIFICATION FAILED - do not deploy this encoder.")
            return 1

    if args.build_embeddings:
        build_embeddings()

    print()
    print("=" * 78)
    print("Retriever export complete")
    print("=" * 78)
    if not args.skip_onnx:
        print(f"ONNX encoder : {ONNX_DIR}")
    if args.build_embeddings:
        print(f"Corpus vectors: {EMBEDDINGS_BIN}")
        print(f"Index manifest: {EMBEDDINGS_INDEX}")
    print()
    print("Node integration (server/rag/guidelines.ts):")
    print("  - keep the signature:  searchClinicalGuidelines(ai, query, topK)")
    print("  - load embeddings.f16.bin once at boot into a Float32Array")
    print("  - encode the query with the SAME encoder + masked mean pooling")
    print("  - dot product against all rows, take top-k, then rerank to top-4")
    print("  - the existing cosineSimilarity() is already correct; reuse it")
    print()
    print("Decide and document ONE query-encoding path:")
    print("  (a) add @huggingface/transformers to package.json and run the encoder in Node")
    print("  (b) keep a small Python sidecar for query embedding only")
    print()
    print("Then: npx tsc --noEmit  and restart the server.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
