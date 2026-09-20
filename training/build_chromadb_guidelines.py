"""
Build persistent ChromaDB vector store for MediAgent clinical guidelines.
Satisfies FF No. 180 "Vector Database: ChromaDB / FAISS".
"""
import json
import logging
from pathlib import Path
import chromadb
from chromadb.config import Settings

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
logger = logging.getLogger("chromadb_build")

CORPUS_PATH = Path("training/data/corpus/chunks.jsonl")
CHROMA_DIR = Path("training/data/chroma_db")
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

def main():
    if not CORPUS_PATH.exists():
        logger.error(f"Corpus chunks not found at {CORPUS_PATH}")
        return 1

    chunks = []
    with CORPUS_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                chunks.append(json.loads(line.strip()))

    logger.info(f"Loaded {len(chunks)} chunks from {CORPUS_PATH}")

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = client.get_or_create_collection(
        name="clinical_guidelines",
        metadata={"description": "MediAgent AI Evidence-Based Guidelines Vector Store"}
    )

    ids = [c["chunk_id"] for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [{
        "title": c.get("title", ""),
        "source": c.get("source", ""),
        "section": c.get("section", ""),
        "doc_id": c.get("doc_id", "")
    } for c in chunks]

    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )

    logger.info(f"Successfully upserted {len(chunks)} guideline records into ChromaDB at {CHROMA_DIR}")

    # Test query
    results = collection.query(
        query_texts=["CURB-65 criteria for community acquired pneumonia triage"],
        n_results=2
    )
    logger.info("ChromaDB Test Query Result:")
    for i, (doc, meta) in enumerate(zip(results["documents"][0], results["metadatas"][0])):
        logger.info(f"  [{i+1}] {meta.get('title')} (Doc ID: {meta.get('doc_id')})")

    print("\nChromaDB persistent vector database initialized successfully.")
    return 0

if __name__ == "__main__":
    main()
