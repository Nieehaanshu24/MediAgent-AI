"""
M2 - Build (query, positive chunk) training pairs for the bi-encoder retriever.

Usage
-----
    python training/build_retrieval_pairs.py --strategy template
    python training/build_retrieval_pairs.py --strategy gemini --per-chunk 3
    python training/build_retrieval_pairs.py --strategy template --add-pubmedqa

Output
------
    training/data/corpus/pairs.jsonl      {query, chunk_id, doc_id, title, section, text}
    training/data/corpus/pairs_stats.json

Why synthetic queries are legitimate here
-----------------------------------------
You have thousands of guideline chunks and no query log. Generating queries from
a passage is standard, documented practice for bootstrapping a retriever
(Instructor, E5 and the Sentence-Transformers docs all describe variants of it).
The discipline is to LABEL THEM AS SYNTHETIC in your report and to hold out a
real, hand-written evaluation set. Never report Recall@k measured only on
synthetic queries - that is the trap.

The template strategy needs no API key and no network access. It is lower quality
than LLM-generated queries, but it is honest, reproducible, and enough to train a
useful first retriever.
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import re
import sys
from pathlib import Path

from mediagent_training.config import CORPUS_DIR, SEED

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("pairs")

CHUNKS_PATH = CORPUS_DIR / "chunks.jsonl"
PAIRS_PATH = CORPUS_DIR / "pairs.jsonl"

TEMPLATES = (
    "What are the guideline criteria for {topic}?",
    "How should {topic} be managed?",
    "What is the recommended approach to {topic}?",
    "When should {topic} be suspected in a triage setting?",
    "What are the red flags for {topic}?",
    "What investigations are indicated for {topic}?",
)

_STOPWORDS = frozenset("""
a an the and or but if then than that this these those of in on at to for from by with without
is are was were be been being do does did have has had will would shall should may might can could
we you they it he she his her its their our your as not no nor so such also more most less least
may must see table figure section chapter page patient patients clinical clinically
""".split())

_GUIDELINE_TERMS = (
    "pneumonia", "sepsis", "pneumothorax", "effusion", "consolidation", "atelectasis",
    "pulmonary embolism", "deep vein thrombosis", "stroke", "myocardial infarction",
    "acute coronary syndrome", "troponin", "heart failure", "pulmonary edema",
    "copd", "asthma", "exacerbation", "diabetic ketoacidosis", "dka", "hypoglycemia",
    "hyperglycemia", "appendicitis", "acute abdomen", "pancreatitis", "cholecystitis",
    "acute kidney injury", "hyperkalemia", "hyponatremia", "acidosis",
    "community-acquired pneumonia", "ards", "respiratory failure", "meningitis",
    "urinary tract infection", "atrial fibrillation", "hypertensive emergency",
    "curb-65", "qsofa", "wells score", "alvarado score",
)


def load_chunks(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"No corpus at {path}\n"
            "Build it first:  python training/ingest_guidelines.py --dir <your_pdfs>"
        )
    chunks: list[dict] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    return chunks


def guess_topic(chunk: dict) -> str:
    """
    Pick a short clinical topic phrase for a chunk.

    Prefers a known guideline term genuinely present in the text (so the query is
    grounded), then falls back to the section heading, then to a salient term.
    """
    text_lower = chunk["text"].lower()

    present = [term for term in _GUIDELINE_TERMS if term in text_lower]
    if present:
        # Longest match is usually the most specific.
        return max(present, key=len)

    section = str(chunk.get("section", "")).strip()
    section = re.sub(r"^\d+(?:\.\d+)*[.)]?\s*", "", section)
    words = [
        w for w in re.findall(r"[A-Za-z][A-Za-z\-]{2,}", section)
        if w.lower() not in _STOPWORDS
    ]
    if 1 <= len(words) <= 6:
        return " ".join(words).lower()

    head = " ".join(chunk["text"].split()[:40])
    candidates = [
        w for w in re.findall(r"[A-Za-z][A-Za-z\-]{4,}", head)
        if w.lower() not in _STOPWORDS
    ]
    return candidates[0].lower() if candidates else "this clinical presentation"


def template_queries(chunk: dict, per_chunk: int, rng: random.Random) -> list[str]:
    topic = guess_topic(chunk)
    templates = list(TEMPLATES)
    rng.shuffle(templates)
    return [templates[i % len(templates)].format(topic=topic) for i in range(per_chunk)]


def gemini_queries(chunk: dict, per_chunk: int, model: str) -> list[str]:
    """
    Ask Gemini to write clinician questions that this passage answers.

    Requires the optional google-genai package and GEMINI_API_KEY:
        pip install google-genai
    """
    try:
        from google import genai  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "The gemini strategy needs the optional package:\n"
            "  pip install google-genai\n"
            "and GEMINI_API_KEY to be set. Use --strategy template to avoid this."
        ) from exc

    client = genai.Client()
    prompt = (
        "You are building a retrieval training set for a medical triage system.\n"
        f"Read this clinical guideline passage and write exactly {per_chunk} distinct "
        "questions that a triaging physician would ask, such that this passage is the "
        "correct source to answer them.\n\n"
        "Rules:\n"
        "- One question per line, no numbering, no preamble, no explanations.\n"
        "- Use clinical terminology a physician would actually use.\n"
        "- Make each question answerable from THIS passage specifically.\n\n"
        f"Passage:\n{chunk['text'][:2000]}\n"
    )
    response = client.models.generate_content(model=model, contents=prompt)
    lines = [line.strip(" -\t") for line in (response.text or "").splitlines()]
    return [line for line in lines if len(line) > 12][:per_chunk]


def load_pubmedqa() -> list[dict]:
    """
    Load the PubMedQA 'pqa_labeled' split as (query, context) pairs.

    PubMedQA contexts are biomedical abstracts, so these pairs are genuinely
    useful for medical retrieval - unlike general QA datasets, which mostly teach
    generic phrasing.
    """
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise ImportError("Install the datasets library: pip install datasets") from exc

    dataset = load_dataset("qiaojin/PubMedQA", "pqa_labeled", split="train")

    pairs: list[dict] = []
    for row in dataset:
        question = row.get("question")
        context = row.get("context")
        contexts = context.get("contexts", []) if isinstance(context, dict) else []
        for index, passage in enumerate(contexts):
            if question and passage and len(passage) > 200:
                pairs.append({
                    "query": question,
                    "chunk_id": f"pubmedqa::{row.get('pubid', 'unknown')}::{index}",
                    "doc_id": f"pubmedqa-{row.get('pubid', 'unknown')}",
                    "title": "PubMedQA abstract",
                    "section": "Abstract",
                    "text": passage,
                    "source_dataset": "PubMedQA",
                })
    return pairs


def main() -> int:
    parser = argparse.ArgumentParser(description="Build retrieval training pairs")
    parser.add_argument("--strategy", choices=["template", "gemini"], default="template")
    parser.add_argument("--per-chunk", type=int, default=3)
    parser.add_argument("--limit", type=int, default=0, help="Cap the number of chunks processed.")
    parser.add_argument("--gemini-model", type=str, default="gemini-2.5-flash",
                        help="Model used with --strategy gemini.")
    parser.add_argument("--add-pubmedqa", action="store_true",
                        help="Also pull in PubMedQA (question, abstract) pairs.")
    parser.add_argument("--chunks", type=str, default=str(CHUNKS_PATH))
    parser.add_argument("--out", type=str, default=str(PAIRS_PATH))
    args = parser.parse_args()

    rng = random.Random(SEED)
    chunks = load_chunks(Path(args.chunks))
    if args.limit:
        chunks = chunks[: args.limit]
    logger.info("Loaded %d chunks", len(chunks))

    pairs: list[dict] = []
    failures = 0

    for i, chunk in enumerate(chunks, start=1):
        if i % 50 == 0 or i == len(chunks):
            logger.info("  %d/%d chunks processed (%d pairs so far)", i, len(chunks), len(pairs))

        try:
            if args.strategy == "gemini":
                queries = gemini_queries(chunk, args.per_chunk, args.gemini_model)
            else:
                queries = template_queries(chunk, args.per_chunk, rng)
        except Exception as exc:
            logger.warning("Query generation failed on chunk %s: %s", chunk.get("chunk_id"), exc)
            queries = template_queries(chunk, args.per_chunk, rng)
            failures += 1

        for query in queries:
            pairs.append({
                "query": query,
                "chunk_id": chunk["chunk_id"],
                "doc_id": chunk["doc_id"],
                "title": chunk["title"],
                "section": chunk.get("section", ""),
                "text": chunk["text"],
                "source_dataset": "synthetic",
            })

    if args.add_pubmedqa:
        try:
            pubmed_pairs = load_pubmedqa()
            logger.info("Added %d PubMedQA pairs", len(pubmed_pairs))
            pairs.extend(pubmed_pairs)
        except Exception as exc:
            logger.error("Could not load PubMedQA: %s", exc)

    if not pairs:
        logger.error("No pairs generated. Nothing written.")
        return 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        for pair in pairs:
            fh.write(json.dumps(pair, ensure_ascii=False) + "\n")

    unique_queries = len({p["query"] for p in pairs})
    unique_chunks = len({p["chunk_id"] for p in pairs})

    stats = {
        "strategy": args.strategy,
        "per_chunk": args.per_chunk,
        "chunks_processed": len(chunks),
        "pairs": len(pairs),
        "unique_queries": unique_queries,
        "unique_chunks": unique_chunks,
        "generation_failures_fell_back_to_template": failures,
        "synthetic_disclaimer": (
            "Queries generated from the chunks themselves. These are SYNTHETIC. "
            "Report them as such, and evaluate on a separate hand-written query set."
        ),
    }
    (out_path.parent / "pairs_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

    print()
    print("=" * 78)
    print("Retrieval training pairs built")
    print("=" * 78)
    print(f"Strategy       : {args.strategy}")
    print(f"Pairs          : {len(pairs):,}  ->  {out_path}")
    print(f"Unique queries : {unique_queries:,}")
    print(f"Unique chunks  : {unique_chunks:,}")
    if failures:
        print(f"Fallbacks      : {failures} (LLM generation failed, template used)")
    print()
    print("IMPORTANT: these queries are SYNTHETIC. Label them as such in your report,")
    print("and evaluate on a separately written, hand-curated query set.")
    print()
    print("Next: python training/train_retriever.py")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
