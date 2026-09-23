# Running MediAgent AI End-to-End

This project now runs end-to-end: **React UI → Express API → 5 agents → real
ChromaDB RAG + M5 confidence calibrator (FastAPI) → Firestore persistence**.

## Architecture

| Layer | Tech | Port | Notes |
|-------|------|------|-------|
| Frontend + API | React + Express (bundled by esbuild) | 3000 | serves `dist/` + `/api/*` |
| AI microservice | FastAPI (Python) | 8000 | `/rag/search`, `/calibrator/predict`, `/ocr/extract-lab` |
| Persistence | Firestore via **firebase-admin** | — | service-account / ADC / in-memory fallback |

## Option A — Docker Compose (one command)

Prereqs: Docker Desktop, a `.env` with `GEMINI_API_KEY` (optional) and
`FIREBASE_SERVICE_ACCOUNT_KEY` (optional).

```bash
docker-compose up --build
```

Then open http://localhost:3000. Compose starts both containers and injects
`PYTHON_SERVICE_URL=http://python_service:8000` so Express reaches FastAPI by
service name.

## Option B — Local dev (two terminals)

```bash
# Terminal 1 — Python AI microservice
python -m uvicorn python_service.app:app --host 0.0.0.0 --port 8000

# Terminal 2 — build + run the Node server
npm run build          # builds dist/ (frontend) AND server-dist/index.js (server)
npm start              # node server-dist/index.js on :3000
```

For hot-reload frontend work: `npm run dev` (Vite on :3000 with the API mounted).
For hot-reload server work: `npm run dev:server` (tsx watch).

## Verifying the pipeline

With the stack up, run the smoke test (asserts a completed, calibrated report
with real ChromaDB citations and a 4-pillar confidence breakdown):

```bash
npm run smoke                                                # symptoms+labs case
node scripts/smoke-e2e.mjs http://localhost:3000 scripts/smoke-payload-img.json  # + real chest X-ray
```

Expected: `SMOKE RESULT: ALL CHECKS PASSED`.

## What was fixed (2026-09-20)

- **Boot:** added `scripts/build-server.mjs` (esbuild) → `server-dist/index.js`;
  `Dockerfile` CMD now runs the real bundle. `npm run build` builds both ends.
- **Persistence:** `server/services/firestore.ts` migrated to **firebase-admin**
  with a credential chain (service-account env → ADC → in-memory fallback).
- **RAG:** `server/services/pythonService.ts` added; `retrieveGuidelines` in
  `server/api.ts` now queries ChromaDB (`/rag/search`) first, with graceful
  fallback to the in-memory Gemini path. No Gemini key required for retrieval.
- **Calibration:** `server/agents/doctor.ts` extracts the M5 feature vector and
  calls `/calibrator/predict`; the calibrated value is blended into the primary
  `probabilityScore`, and the urgency cross-check is surfaced as a WARNING on
  disagreement (never a silent override).
- **Demo inputs:** flagship scenarios now embed **real de-identified chest
  X-rays** (`src/data/realXrays.ts`, public COVID-19 Image Data Collection) so
  the DenseNet-121 ONNX model produces meaningful activations.

## Graceful degradation

Every Python-service call returns `null` when the service is down, so the app
still runs (with reduced intelligence) if FastAPI is unavailable. Firestore
falls back to in-memory storage when no credentials are present.
