/**
 * Thin client for the FastAPI Python microservice (python_service/app.py).
 *
 * The service exposes:
 *   GET  /health               → readiness of ChromaDB, calibrator, urgency models
 *   POST /rag/search           → ChromaDB guideline vector search
 *   POST /ocr/extract-lab      → PyMuPDF lab-report parsing
 *   POST /calibrator/predict   → M5 confidence calibration + urgency cross-check
 *
 * Design goal: NEVER let a down/missing Python service crash the Node app.
 * Every method returns `null` (and logs a warning) when the service is
 * unreachable, so callers can degrade to their in-process fallback path.
 */

const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Cache the last health probe so we don't hammer /health on every request.
const HEALTH_TTL_MS = 10_000;
let lastHealthAt = 0;
let lastHealth: PythonHealth | null = null;

export interface PythonHealth {
  status: string;
  chromadb_ready: boolean;
  calibrator_ready: boolean;
  urgency_ready: boolean;
}

export interface RagSearchResult {
  chunkId: string;
  title: string;
  source: string;
  section: string;
  snippet: string;
}

export interface CalibrationPrediction {
  calibrated_probability: number; // 0-100
  urgency_cross_check: string | null;
}

function log(...args: unknown[]): void {
  console.warn('[PythonService]', ...args);
}

async function postJson<T>(path: string, body: unknown, timeoutMs = 15000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      log(`${path} returned ${res.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log(`${path} request failed (${PYTHON_SERVICE_URL}):`, (err as Error)?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe service health, cached for HEALTH_TTL_MS. Returns null when down.
 */
export async function checkPythonHealth(force = false): Promise<PythonHealth | null> {
  const now = Date.now();
  if (!force && now - lastHealthAt < HEALTH_TTL_MS && lastHealth) {
    return lastHealth;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${PYTHON_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      lastHealthAt = now;
      lastHealth = null;
      return null;
    }
    lastHealth = (await res.json()) as PythonHealth;
    lastHealthAt = now;
    return lastHealth;
  } catch (err) {
    lastHealthAt = now;
    lastHealth = null;
    log(`Service unreachable at ${PYTHON_SERVICE_URL}:`, (err as Error)?.message);
    return null;
  }
}

/** True when the Python service is reachable and ChromaDB is loaded. */
export async function isRagAvailable(): Promise<boolean> {
  const health = await checkPythonHealth();
  return !!health && health.chromadb_ready;
}

/** True when the Python service is reachable and the calibrator is loaded. */
export async function isCalibratorAvailable(): Promise<boolean> {
  const health = await checkPythonHealth();
  return !!health && health.calibrator_ready;
}

/**
 * ChromaDB guideline vector search. Returns null when unavailable so the
 * caller can fall back to the in-memory Gemini embedding path.
 */
export async function ragSearch(query: string, topK = 3): Promise<RagSearchResult[] | null> {
  const res = await postJson<{ results: RagSearchResult[] }>('/rag/search', {
    query,
    top_k: topK,
  });
  return res?.results ?? null;
}

/**
 * M5 confidence calibration. Returns null when the calibrator isn't loaded,
 * so the caller keeps its deterministic confidence score.
 */
export async function calibrateConfidence(
  features: Record<string, unknown>
): Promise<CalibrationPrediction | null> {
  return postJson<CalibrationPrediction>('/calibrator/predict', { features });
}

export function getPythonServiceUrl(): string {
  return PYTHON_SERVICE_URL;
}
