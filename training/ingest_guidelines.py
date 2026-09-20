"""
M2 - Build the RAG corpus from clinical guideline documents.

Usage
-----
    # a folder of PDFs
    python training/ingest_guidelines.py --dir training/data/raw/guidelines

    # a single document with explicit provenance
    python training/ingest_guidelines.py --file nice_ng158.pdf --source "NICE" --title "NICE NG158 VTE"

    # plain-text sources (e.g. scraped WHO pages)
    python training/ingest_guidelines.py --dir training/data/raw/text --ext .txt

Output
------
    training/data/corpus/chunks.jsonl         one JSON object per chunk
    training/data/corpus/corpus_stats.json    chunk counts, token histogram, source coverage

Chunk record schema (this is the contract the Node retriever relies on)
----------------------------------------------------------------------
    {
      "chunk_id":  "nice-ng158::p12::s3::c007",
      "doc_id":    "nice-ng158",
      "title":     "NICE NG158 VTE",
      "source":    "NICE",
      "section":   "1.4 Diagnosis",
      "page_start": 12,
      "page_end":   12,
      "char_start": 4821,
      "char_end":   6834,
      "text":      "..."
    }

Why the metadata matters
------------------------
served/rag/guidelines.ts currently returns a title plus a blob, so the Doctor
agent cannot give an auditable citation. With {section, page_start, page_end} it
can say "NICE NG158 section 1.4, p.12" - which is what the synopsis promises when
it says the output includes "retrieved references".

Licensing warning
-----------------
Guideline PDFs are copyright their publishers. Do NOT commit them, and do NOT
commit the generated corpus if the source licence forbids redistribution. Both
paths are already in .gitignore. Check each publisher's reuse terms before
shipping any derived text publicly.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
from pathlib import Path

from mediagent_training.config import CHUNK_OVERLAP_TOKENS, CHUNK_TOKENS, CORPUS_DIR

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("ingest")

# Rough token estimate. English clinical prose runs ~1.30 tokens per whitespace
# word with a BERT-family tokenizer. Using this avoids loading a tokenizer just
# to chunk, at the cost of a few percent imprecision in chunk size - which is
# entirely acceptable here.
TOKENS_PER_WORD = 1.30

# Sentence boundary: terminator followed by whitespace and a capital/quote/digit,
# or end of string. Deliberately conservative - clinical abbreviations such as
# "e.g." and "i.e." are handled by the abbreviation guard below.
_SENTENCE_END = re.compile(r'(?<=[.!?])\s+(?=[A-Z"\'(\[0-9])')
_ABBREVIATIONS = (
    "e.g.", "i.e.", "cf.", "vs.", "etc.", "approx.", "no.", "fig.", "figs.",
    "dr.", "mr.", "mrs.", "ms.", "prof.", "ref.", "refs.", "eq.", "vol.",
    "p.", "pp.", "sec.", "sect.", "table.", "tab.", "min.", "max.", "mg.",
)

# A heading-ish line: short, no terminal punctuation, and either numbered
# ("1.4 Diagnosis") or Title Case. Good enough for section labelling, which is a
# nicety, not a correctness requirement.
_HEADING = re.compile(r"^(\d+(?:\.\d+)*)[.)]?\s+(.{0,80})$")


def estimate_tokens(text: str) -> int:
    return int(len(text.split()) * TOKENS_PER_WORD)


def split_sentences(text: str) -> list[str]:
    """Split into sentences, protecting common clinical abbreviations."""
    protected = text
    for i, abbr in enumerate(_ABBREVIATIONS):
        protected = protected.replace(abbr, f"\x00{i}\x00")

    parts = _SENTENCE_END.split(protected)

    restored: list[str] = []
    for part in parts:
        for i, abbr in enumerate(_ABBREVIATIONS):
            part = part.replace(f"\x00{i}\x00", abbr)
        # Guard against a blank sentence left by a dangling terminator.
        if part.strip():
            restored.append(part.strip())
    return restored


def chunk_sentences(sentences: list[str], max_tokens: int, overlap_tokens: int) -> list[str]:
    """
    Greedily pack sentences into chunks of at most max_tokens, with a trailing
    overlap of whole sentences.

    Overlapping by SENTENCES rather than by characters is the important detail:
    a character-level overlap can cut a sentence in half, which produces chunks
    that embed badly and read worse.
    """
    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        sentence_tokens = estimate_tokens(sentence)

        # A single sentence longer than the budget: emit it alone rather than
        # dropping it. Rare, and truncating clinical text is worse than a big chunk.
        if sentence_tokens >= max_tokens:
            if current:
                chunks.append(" ".join(current))
                current, current_tokens = [], 0
            chunks.append(sentence)
            continue

        if current_tokens + sentence_tokens > max_tokens and current:
            chunks.append(" ".join(current))

            # Build the overlap tail from the end of the chunk we just closed.
            overlap: list[str] = []
            overlap_count = 0
            for prev in reversed(current):
                prev_tokens = estimate_tokens(prev)
                if overlap_count + prev_tokens > overlap_tokens:
                    break
                overlap.insert(0, prev)
                overlap_count += prev_tokens

            current = overlap
            current_tokens = overlap_count

        current.append(sentence)
        current_tokens += sentence_tokens

    if current:
        chunks.append(" ".join(current))

    return chunks


def detect_section(line: str) -> str | None:
    """Return a section label if the line looks like a heading."""
    stripped = line.strip()
    if not stripped or len(stripped) > 90:
        return None
    if stripped.endswith((".", ",", ";", ":")) and not _HEADING.match(stripped):
        return None
    match = _HEADING.match(stripped)
    if match:
        return stripped
    return None


def extract_pdf_pages(path: Path) -> list[tuple[int, str]]:
    """
    Extract text per page, preserving page numbers for citations.

    PyMuPDF is AGPL-licensed. If that is a problem for your institution, swap in
    pdf2image + pytesseract (or pypdf) - the rest of this function's contract
    (a list of (page_number, text)) stays identical.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ImportError(
            "PyMuPDF is required for PDF ingestion.\n"
            "Install it with:  pip install PyMuPDF\n"
            "PyMuPDF is AGPL - check the licence fit for your institution. "
            "pdf2image + pytesseract is a permissively-licensed alternative."
        ) from exc

    pages: list[tuple[int, str]] = []
    with fitz.open(path) as doc:
        for page_number, page in enumerate(doc, start=1):
            pages.append((page_number, page.get_text("text")))
    return pages


def extract_text_pages(path: Path) -> list[tuple[int, str]]:
    """Treat a plain-text file as a single 'page'."""
    return [(1, path.read_text(encoding="utf-8", errors="ignore"))]


def make_doc_id(title: str) -> str:
    """Stable, filesystem-safe document id derived from the title."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or hashlib.md5(title.encode("utf-8")).hexdigest()[:12]


def chunk_document(
    pages: list[tuple[int, str]],
    doc_id: str,
    title: str,
    source: str,
    max_tokens: int,
    overlap_tokens: int,
) -> list[dict]:
    """Chunk one document, carrying section and page metadata into every chunk."""
    chunks: list[dict] = []
    current_section = "Preamble"
    chunk_counter = 0
    char_cursor = 0

    for page_number, page_text in pages:
        if not page_text or not page_text.strip():
            continue

        # Refresh the section label from any heading on this page.
        for line in page_text.splitlines():
            heading = detect_section(line)
            if heading:
                current_section = heading
                break

        sentences = split_sentences(page_text)
        for chunk_text in chunk_sentences(sentences, max_tokens, overlap_tokens):
            if len(chunk_text.strip()) < 80:
                # Skip fragments too short to retrieve meaningfully.
                continue

            chunk_counter += 1
            chunks.append({
                "chunk_id": f"{doc_id}::p{page_number}::c{chunk_counter:04d}",
                "doc_id": doc_id,
                "title": title,
                "source": source,
                "section": current_section,
                "page_start": page_number,
                "page_end": page_number,
                "char_start": char_cursor,
                "char_end": char_cursor + len(chunk_text),
                "text": chunk_text,
            })
            char_cursor += len(chunk_text)

    return chunks


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the MediAgent RAG corpus")
    parser.add_argument("--dir", type=str, help="Directory of documents.")
    parser.add_argument("--file", type=str, help="A single document.")
    parser.add_argument("--ext", type=str, default=".pdf",
                        help="Extension to pick up in --dir mode (default .pdf).")
    parser.add_argument("--title", type=str, default=None,
                        help="Document title (required with --file; else the stem is used).")
    parser.add_argument("--source", type=str, default="Unknown",
                        help="Publisher, e.g. NICE / WHO / CDC / ICMR / BTS / GOLD.")
    parser.add_argument("--chunk-tokens", type=int, default=CHUNK_TOKENS)
    parser.add_argument("--overlap-tokens", type=int, default=CHUNK_OVERLAP_TOKENS)
    parser.add_argument("--out", type=str, default=str(CORPUS_DIR / "chunks.jsonl"))
    parser.add_argument("--append", action="store_true",
                        help="Append to an existing chunks.jsonl instead of overwriting.")
    args = parser.parse_args()

    if not args.dir and not args.file:
        parser.error("Provide either --dir or --file")

    # ---- collect input documents -----------------------------------------
    documents: list[Path] = []
    if args.file:
        documents = [Path(args.file)]
    else:
        root = Path(args.dir)
        documents = sorted(p for p in root.rglob(f"*{args.ext}") if p.is_file())

    if not documents:
        logger.error("No documents found (ext=%s).", args.ext)
        return 1

    logger.info("Ingesting %d document(s)", len(documents))

    # ---- chunk -------------------------------------------------------------
    all_chunks: list[dict] = []
    per_source: dict[str, int] = {}

    for path in documents:
        title = args.title if args.title else path.stem.replace("_", " ").replace("-", " ")
        doc_id = make_doc_id(title)

        try:
            if path.suffix.lower() == ".pdf":
                pages = extract_pdf_pages(path)
            else:
                pages = extract_text_pages(path)
        except Exception as exc:
            logger.error("Failed to read %s: %s", path.name, exc)
            continue

        chunks = chunk_document(
            pages, doc_id, title, args.source,
            max_tokens=args.chunk_tokens,
            overlap_tokens=args.overlap_tokens,
        )

        if not chunks:
            logger.warning("No usable text extracted from %s", path.name)
            continue

        all_chunks.extend(chunks)
        per_source[args.source] = per_source.get(args.source, 0) + len(chunks)
        logger.info("  %-55s %4d chunks from %d pages",
                    path.name[:55], len(chunks), len(pages))

    if not all_chunks:
        logger.error("No chunks produced. Nothing written.")
        return 1

    # ---- write -------------------------------------------------------------
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    mode = "a" if args.append and out_path.exists() else "w"
    with out_path.open(mode, encoding="utf-8") as fh:
        for chunk in all_chunks:
            fh.write(json.dumps(chunk, ensure_ascii=False) + "\n")

    token_counts = [estimate_tokens(c["text"]) for c in all_chunks]
    token_counts.sort()
    stats = {
        "documents": len(documents),
        "chunks": len(all_chunks),
        "chunks_per_source": per_source,
        "chunk_tokens_target": args.chunk_tokens,
        "chunk_overlap_tokens": args.overlap_tokens,
        "token_stats": {
            "min": token_counts[0],
            "median": token_counts[len(token_counts) // 2],
            "p90": token_counts[int(len(token_counts) * 0.9)],
            "max": token_counts[-1],
        },
        "total_estimated_tokens": int(sum(token_counts)),
        "unique_doc_ids": sorted({c["doc_id"] for c in all_chunks}),
    }

    stats_path = out_path.parent / "corpus_stats.json"
    stats_path.write_text(json.dumps(stats, indent=2), encoding="utf-8")

    print()
    print("=" * 78)
    print("Corpus built")
    print("=" * 78)
    print(f"Chunks written      : {len(all_chunks)}  ->  {out_path}")
    print(f"Unique documents    : {len(stats['unique_doc_ids'])}")
    print(f"Total est. tokens   : {stats['total_estimated_tokens']:,}")
    print(f"Chunk tokens        : min={stats['token_stats']['min']}  "
          f"median={stats['token_stats']['median']}  "
          f"p90={stats['token_stats']['p90']}  max={stats['token_stats']['max']}")
    print(f"Stats               : {stats_path}")
    print()
    print("Next steps:")
    print("  1. Generate retrieval training pairs:")
    print("       python training/train_retriever.py --bootstrap-queries")
    print("  2. Fine-tune the encoder:")
    print("       python training/train_retriever.py")
    print()
    print("NOTE: check each publisher's reuse terms before redistributing any")
    print("      derived corpus text. chunks.jsonl is gitignored for this reason.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
