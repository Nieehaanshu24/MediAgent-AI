import type {
  ConfidencePillarScore,
  EvidenceCitation,
  InterviewerAnalysis,
  LabAnalystAnalysis,
  ProbableCondition,
  RadiologistAnalysis,
  ClinicalGuideline,
} from '../../src/types/clinical';

/**
 * Deterministic confidence decomposition for a probable condition.
 *
 * WHY THIS EXISTS
 * ---------------
 * `ProbableCondition.probabilityScore` is currently an integer the LLM writes
 * into JSON, constrained only by prompt instructions like "cap at 35-55%". That
 * is a prompted convention, not a measured probability.
 *
 * `ConfidencePillarScore` was already declared in src/types/clinical.ts but no
 * code path ever populated it. This module fills it in with plain arithmetic
 * over evidence the pipeline ALREADY produces, so every point of confidence
 * traces to a named source. That is strictly better explainability than an
 * LLM-supplied number, and it is reproducible.
 *
 * The weights must stay in sync with training/mediagent_training/config.py
 * (PILLAR_MAX_WEIGHTS) and training/out/pillar_weights.json.
 */

export const PILLAR_MAX_WEIGHTS = {
  interview: 25,
  radiology: 30,
  lab: 30,
  guideline: 15,
} as const;

export const PILLAR_LABELS: Record<ConfidencePillarScore['pillar'], string> = {
  interview: 'Patient History & Vitals',
  radiology: 'Radiological Imaging',
  lab: 'Laboratory Biomarkers',
  guideline: 'Retrieved Clinical Guidelines',
};

type PillarKey = ConfidencePillarScore['pillar'];

interface PillarInput {
  interviewer: InterviewerAnalysis;
  radiologist: RadiologistAnalysis;
  labAnalyst: LabAnalystAnalysis;
  retrievedGuidelines: ClinicalGuideline[];
  evidenceCitations?: EvidenceCitation[];
  isImagingMissing: boolean;
  isLabsMissing: boolean;
}

/**
 * How strongly each pillar is supported, in [0, 1].
 *
 * These rules are deliberately blunt. A pillar is either substantively present
 * or it is not; pretending to grade "how good" the interview was would smuggle
 * judgement back in and make the number unfalsifiable.
 */
function computeSupport(input: PillarInput): Record<PillarKey, { support: number; statusText: string }> {
  const {
    interviewer,
    radiologist,
    labAnalyst,
    retrievedGuidelines,
    isImagingMissing,
    isLabsMissing,
  } = input;

  // --- interview ---------------------------------------------------------
  const hasSummary = Boolean(interviewer?.clinicalSummary?.trim());
  const redFlagCount = interviewer?.redFlagSymptoms?.length ?? 0;
  let interviewSupport = 0;
  let interviewStatus = 'No structured history recorded.';
  if (hasSummary && redFlagCount >= 2) {
    interviewSupport = 1;
    interviewStatus = `Structured history with ${redFlagCount} red-flag symptoms identified.`;
  } else if (hasSummary) {
    interviewSupport = 0.7;
    interviewStatus = 'Structured history recorded without multiple red-flag indicators.';
  }

  // --- radiology ---------------------------------------------------------
  const positiveImagingCount = radiologist?.positiveFindings?.length ?? 0;
  const hasImagingFindings = (radiologist?.findings?.length ?? 0) > 0;
  let radiologySupport = 0;
  let radiologyStatus = 'No imaging submitted; anatomical confirmation unavailable.';
  if (!isImagingMissing && positiveImagingCount > 0) {
    radiologySupport = 1;
    radiologyStatus = `Imaging present with ${positiveImagingCount} positive finding(s).`;
  } else if (!isImagingMissing && hasImagingFindings) {
    radiologySupport = 0.6;
    radiologyStatus = 'Imaging present but no positive findings flagged.';
  }

  // --- lab ---------------------------------------------------------------
  const criticalCount = labAnalyst?.criticalAlerts?.length ?? 0;
  const flaggedCount =
    labAnalyst?.processedMarkers?.filter((marker) => marker.status !== 'NORMAL').length ?? 0;
  let labSupport = 0;
  let labStatus = 'No laboratory panel submitted; no biochemical verification.';
  if (!isLabsMissing && criticalCount > 0) {
    labSupport = 1;
    labStatus = `Laboratory panel present with ${criticalCount} critical alert(s).`;
  } else if (!isLabsMissing && flaggedCount > 0) {
    labSupport = 0.7;
    labStatus = `Laboratory panel present with ${flaggedCount} out-of-range marker(s).`;
  } else if (!isLabsMissing) {
    labSupport = 0.5;
    labStatus = 'Laboratory panel present; all markers within reference range.';
  }

  // --- guideline ---------------------------------------------------------
  const topSimilarity = retrievedGuidelines?.[0]?.similarityScore ?? 0;
  const guidelineSupport = Math.max(0, Math.min(1, topSimilarity));
  const guidelineStatus = retrievedGuidelines?.length
    ? `${retrievedGuidelines.length} guideline passage(s) retrieved; top similarity ${topSimilarity.toFixed(3)}.`
    : 'No guideline passages retrieved.';

  return {
    interview: { support: interviewSupport, statusText: interviewStatus },
    radiology: { support: radiologySupport, statusText: radiologyStatus },
    lab: { support: labSupport, statusText: labStatus },
    guideline: { support: guidelineSupport, statusText: guidelineStatus },
  };
}

/**
 * Build the per-pillar breakdown for one probable condition.
 */
export function computeConfidencePillars(input: PillarInput): ConfidencePillarScore[] {
  const support = computeSupport(input);
  const pillarOrder: PillarKey[] = ['interview', 'radiology', 'lab', 'guideline'];

  return pillarOrder.map((pillar) => {
    const maxWeight = PILLAR_MAX_WEIGHTS[pillar];
    const { support: level, statusText } = support[pillar];
    const citationCount =
      input.evidenceCitations?.filter((citation) => citation.sourceType === pillar).length ?? 0;

    return {
      pillar,
      label: PILLAR_LABELS[pillar],
      maxWeight,
      contributedScore: Math.round(maxWeight * level * 100) / 100,
      isSupported: level > 0,
      statusText,
      citationCount,
    };
  });
}

/**
 * Evidence ceiling: the highest probability the available pillars can justify.
 *
 * Weights of unsupported pillars are removed from BOTH the numerator and the
 * denominator, because a missing modality should not be scored as "zero
 * evidence" — it should simply not participate. Scoring it as zero would
 * conflate "we have no imaging" with "the imaging was negative", which are
 * clinically very different statements.
 */
export function pillarCeiling(pillars: ConfidencePillarScore[]): number {
  const supported = pillars.filter((pillar) => pillar.isSupported);
  if (supported.length === 0) return 0;

  const contributed = supported.reduce((sum, pillar) => sum + pillar.contributedScore, 0);
  const maxPossible = supported.reduce((sum, pillar) => sum + pillar.maxWeight, 0);
  if (maxPossible === 0) return 0;

  return Math.round((100 * contributed) / maxPossible);
}

/**
 * Attach the pillar breakdown to a condition and clamp its probability to the
 * evidence ceiling.
 *
 * Clamping rather than replacing is deliberate: the LLM's clinical judgement
 * about *relative* certainty between differentials is worth keeping, but it
 * must not exceed what the collected evidence can support. This is the same
 * principle the existing symptoms_only path already applies with its 55% cap —
 * this just makes the cap principled and uniform instead of hardcoded.
 */
export function applyPillarCalibration(
  condition: ProbableCondition,
  pillars: ConfidencePillarScore[]
): ProbableCondition {
  const ceiling = pillarCeiling(pillars);
  const original = condition.probabilityScore ?? 0;
  const clamped = Math.min(original, ceiling);

  return {
    ...condition,
    probabilityScore: Math.max(0, Math.min(100, Math.round(clamped))),
    confidencePillars: pillars,
  };
}

/**
 * Human-readable one-liner for the UI: which pillars drove the score and which
 * were missing.
 */
export function describeConfidence(pillars: ConfidencePillarScore[]): string {
  const supported = pillars.filter((pillar) => pillar.isSupported).map((pillar) => pillar.label);
  const missing = pillars.filter((pillar) => !pillar.isSupported).map((pillar) => pillar.label);

  const parts: string[] = [];
  if (supported.length) parts.push(`Supported by ${supported.join(', ')}.`);
  if (missing.length) parts.push(`Not supported by ${missing.join(', ')}.`);
  return parts.join(' ');
}
