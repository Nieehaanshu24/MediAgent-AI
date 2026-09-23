/**
 * End-to-end smoke test for the MediAgent AI pipeline.
 *
 * Asserts that a full triage run (React → Express → 5 agents → Python ChromaDB
 * RAG + M5 calibrator → Firestore) returns a completed case with:
 *   1. Real ChromaDB retrieval citations (corpus chunk IDs, not the 10 hardcoded guides)
 *   2. A calibrated doctor probabilityScore (M5-blended)
 *   3. A 4-pillar confidence breakdown on the primary condition
 *
 * Usage:
 *   node scripts/smoke-e2e.mjs [baseUrl] [payloadJson]
 * Defaults: baseUrl=http://localhost:3000, payload=scripts/smoke-payload.json
 */
import { readFileSync } from 'fs';

const baseUrl = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const payloadPath = process.argv[3] || 'scripts/smoke-payload.json';

let failures = 0;
function check(name, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`[${mark}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log(`Smoke target: ${baseUrl}`);

  // 1. Health
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  check('server /api/health online', health.status === 'online', `appName=${health.appName}`);

  // 2. RAG search returns corpus-backed results
  const rag = await (
    await fetch(`${baseUrl}/api/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'community acquired pneumonia CURB-65 triage', topK: 3 }),
    })
  ).json();
  const ragIds = (rag.results || []).map((r) => r.id || '');
  const looksLikeCorpus = ragIds.some((id) => id.includes('::'));
  check('RAG returns ChromaDB corpus chunks', (rag.results || []).length > 0 && looksLikeCorpus, ragIds[0] || 'none');

  // 3. Full triage
  const payload = JSON.parse(readFileSync(payloadPath, 'utf-8'));
  const triageRes = await fetch(`${baseUrl}/api/triage/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  check('triage/run HTTP 200', triageRes.status === 200, `status=${triageRes.status}`);
  const kase = await triageRes.json();
  check('case completed', kase.status === 'completed', `status=${kase.status}`);

  const doctor = kase.agentResults?.doctor || {};
  const conditions = doctor.probableConditions || [];
  check('doctor produced conditions', conditions.length > 0, `count=${conditions.length}`);

  const primary = conditions[0] || {};
  check(
    'primary probabilityScore is a finite 0-100 number',
    typeof primary.probabilityScore === 'number' && primary.probabilityScore >= 0 && primary.probabilityScore <= 100,
    `score=${primary.probabilityScore}`
  );

  const pillars = primary.confidencePillars || [];
  check('primary has 4-pillar confidence breakdown', pillars.length === 4, `pillars=${pillars.length}`);

  const retrieved = kase.agentResults?.retrievedGuidelines || [];
  const retrievedFromCorpus = retrieved.some((g) => (g.id || '').includes('::'));
  check('triage used ChromaDB retrieval', retrieved.length > 0 && retrievedFromCorpus, `retrieved=${retrieved.length}`);

  // 4. Calibration marker present in rationale when Python service is up
  const rationale = primary.rationale || '';
  const calibrated = /Calibrated confidence/i.test(rationale);
  check('M5 calibration applied to primary condition', calibrated, calibrated ? 'M5-blended' : 'calibrator offline (fallback ok)');

  console.log('');
  if (failures === 0) {
    console.log('SMOKE RESULT: ALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log(`SMOKE RESULT: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  process.exit(1);
});
