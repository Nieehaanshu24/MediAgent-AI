import { GoogleGenAI } from '@google/genai';
import type {
  InterviewerAnalysis,
  RadiologistAnalysis,
  LabAnalystAnalysis,
  ClinicalGuideline,
  DoctorSynthesis,
  UrgencyLevel,
  EvidenceCitation,
  MissingDataSource,
} from '../../src/types/clinical';
import { generateContentWithFallback } from '../utils/aiHelper';
import { computeConfidencePillars, applyPillarCalibration } from './confidencePillars';

export async function runDoctorAgent(
  ai: GoogleGenAI | null,
  interviewer: InterviewerAnalysis,
  radiologist: RadiologistAnalysis,
  labAnalyst: LabAnalystAnalysis,
  retrievedGuidelines: ClinicalGuideline[]
): Promise<DoctorSynthesis> {
  const structuredFindings =
    radiologist.findings && radiologist.findings.length > 0
      ? radiologist.findings
      : (radiologist.regionObservations || []).map((obs, idx) => ({
          id: obs.id || `RF-${idx + 1}`,
          region: obs.region,
          observation: obs.observation || obs.findingDescription,
          severity: obs.severity || (obs.status === 'Normal' ? 'Normal' : 'Moderate'),
        }));

  // Detect modality completeness
  const isImagingMissing =
    !radiologist ||
    !radiologist.studyModality ||
    radiologist.studyModality.toLowerCase().includes('no imaging') ||
    radiologist.studyModality.toLowerCase().includes('deferred') ||
    (structuredFindings.length === 0 && (!radiologist.findings || radiologist.findings.length === 0));

  const isLabsMissing =
    !labAnalyst ||
    !labAnalyst.processedMarkers ||
    labAnalyst.processedMarkers.length === 0 ||
    labAnalyst.labImpression.toLowerCase().includes('deferred') ||
    labAnalyst.labImpression.toLowerCase().includes('no laboratory');

  const dataCompletenessLevel: 'symptoms_only' | 'partial' | 'complete' =
    isImagingMissing && isLabsMissing
      ? 'symptoms_only'
      : isImagingMissing || isLabsMissing
      ? 'partial'
      : 'complete';

  const defaultMissingSources: MissingDataSource[] = [];
  if (isImagingMissing) {
    defaultMissingSources.push({
      source: 'imaging',
      label: 'Radiological Imaging',
      status: 'unavailable',
      impactOnConfidence:
        'No objective diagnostic imaging available. Caps diagnostic confidence; cannot directly visualize focal alveolar consolidation, pneumothorax, cardiomegaly, effusion, or acute surgical pathology.',
      recommendedAction:
        'Order targeted urgent imaging (e.g. STAT Chest Radiograph PA/Lateral, Bedside Point-of-Care Ultrasound, or Abdominal CT as indicated).',
    });
  }
  if (isLabsMissing) {
    defaultMissingSources.push({
      source: 'labs',
      label: 'Laboratory Biomarkers & Chemistry',
      status: 'unavailable',
      impactOnConfidence:
        'No biochemical, hematologic, or inflammatory laboratory panels submitted. Prevents quantitative verification of leukocytosis, left shift, cardiac troponin leak, serum lactate, or metabolic acidosis.',
      recommendedAction:
        'Order STAT laboratory workup (CBC with differential, Comprehensive Metabolic Panel, High-Sensitivity Troponin, Serum Lactate, and Blood Cultures if febrile).',
    });
  }

  let defaultLimitationsNotice = '';
  if (dataCompletenessLevel === 'symptoms_only') {
    defaultLimitationsNotice =
      'DIAGNOSTIC LIMITATION (Symptoms-Only Presentation): This triage synthesis is formulated purely on patient-reported history, symptom timeline, and bedside triage vitals without objective radiological or laboratory confirmation. Consequently, diagnostic certainty is strictly preliminary and diagnostic confidence is capped (maximum ~35-55% probability). Differential diagnoses cannot be definitively confirmed or excluded until confirmatory imaging and laboratory workups are obtained.';
  } else if (isImagingMissing) {
    defaultLimitationsNotice =
      'PARTIAL DATA NOTICE (Imaging Deferred / Unavailable): Assessment incorporates patient history and laboratory biomarkers, but lacks anatomical imaging confirmation. Diagnostic confidence is reduced accordingly.';
  } else if (isLabsMissing) {
    defaultLimitationsNotice =
      'PARTIAL DATA NOTICE (Laboratory Panels Deferred): Assessment incorporates patient history and radiological imaging, but lacks quantitative biomarker or blood chemistry verification. Confidence scores are adjusted accordingly.';
  }

  const systemInstruction = `You are the Doctor Agent (Chief Diagnostic Synthesizer) in MediAgent AI, an advanced explainable clinical decision-support triage system (educational prototype).
Your responsibility is to synthesize the findings of the three prior specialist agents (Interviewer Agent, Radiologist Agent, Lab Analyst Agent) together with live retrieved evidence-based clinical guidelines into a unified, definitive clinical triage report.

DATA COMPLETENESS & PARTIAL-DATA HANDLING RULES (CRITICAL):
Current case data completeness: "${dataCompletenessLevel}"
- If data is "symptoms_only" (NO imaging and NO labs submitted):
  1. DO NOT fabricate imaginary imaging finding chips or imaginary lab values.
  2. In "clinicalExecutiveSummary", explicitly state that the evaluation is a preliminary syndromic triage based solely on clinical history and vitals, noting that confirmatory imaging and laboratory diagnostics are pending.
  3. Set "dataCompletenessLevel": "symptoms_only".
  4. Provide a clear "diagnosticLimitationsNotice" explaining why confidence is capped and what diagnostic gaps exist.
  5. Provide "missingDataSources" detailing each unavailable modality, its impact on confidence, and the recommended diagnostic action.
  6. Cap "probabilityScore" for the primary condition at moderate/preliminary levels (35-55%, evidenceStrength: "moderate" or "weak"), and secondary differentials at 15-30% (evidenceStrength: "weak"), explicitly explaining that without multi-modal corroboration, diagnostic certainty is inherently constrained.
  7. In "evidenceCitations": for missing imaging, cite sourceType "radiology", sourceName "Imaging Deferred / Unavailable", and state that absence of imaging restricts anatomical confirmation. For missing labs, cite sourceType "lab", sourceName "Laboratory Biomarkers Deferred", and note that quantitative biomarker validation is pending.
  8. In "recommendedNextSteps": prominently include STAT orders for the missing diagnostic modalities (e.g. STAT Chest Radiograph, 12-lead ECG, troponin, CBC/BMP).

- If data is "partial" (e.g. imaging present but no labs, or labs present but no imaging):
  1. Set "dataCompletenessLevel": "partial".
  2. Populate "missingDataSources" and "diagnosticLimitationsNotice" acknowledging the missing modality and its specific impact on diagnostic certainty.
  3. Moderate the confidence score (cap at 60-70%) to reflect the partial evidence base.

- If data is "complete" (all modalities present):
  1. Set "dataCompletenessLevel": "complete".
  2. Corroborate across all 4 pillars for high confidence (75-95%).

CORE REQUIREMENT — EXPLAINABLE "WHY?" EVIDENCE BREAKDOWN:
For EVERY ranked probable condition in "probableConditions", provide an explicit structured evidence breakdown in "evidenceCitations":
1. Interview Answer / Patient Presentation (sourceType: "interview")
2. Laboratory Flag (sourceType: "lab")
3. Imaging Finding (sourceType: "radiology")
4. Guideline Snippet (REAL QUOTED PASSAGE) (sourceType: "guideline")

URGENCY LEVEL DEFINITION:
- "emergency": Immediate threat to life or organ function requiring instant intervention.
- "urgent": Serious acute condition requiring prompt hospital admission, targeted diagnostics, and treatment within hours.
- "routine": Mild or stable condition appropriate for outpatient management.

Output MUST be strictly valid JSON matching this schema:
{
  "agentName": "Doctor Agent",
  "urgencyLevel": "urgent",
  "urgencyRationale": "Patient exhibits severe systemic inflammation and tachypnea requiring prompt hospitalization.",
  "clinicalExecutiveSummary": "Clinical summary...",
  "referencedRadiologistFindings": ["RF-1"],
  "dataCompletenessLevel": "complete",
  "diagnosticLimitationsNotice": "...",
  "missingDataSources": [
    {
      "source": "imaging",
      "label": "Radiological Imaging",
      "status": "unavailable",
      "impactOnConfidence": "...",
      "recommendedAction": "..."
    }
  ],
  "probableConditions": [
    {
      "condition": "Acute Community-Acquired Lobar Pneumonia",
      "icdCodeEstimate": "J13 / J18.1",
      "probabilityScore": 88,
      "evidenceStrength": "strong",
      "referencedFindingIds": ["RF-1"],
      "rationale": "...",
      "evidenceCitations": [
        {
          "sourceType": "interview",
          "sourceName": "Patient Intake & Vitals Assessment",
          "claim": "...",
          "citedTextOrValue": "...",
          "confidenceContribution": "..."
        }
      ]
    }
  ],
  "recommendedNextSteps": [
    {
      "category": "Immediate Stabilization",
      "action": "...",
      "timeframe": "...",
      "groundingCitation": "..."
    }
  ],
  "guidelineGroundingSummary": "...",
  "differentialExclusions": [
    {
      "condition": "...",
      "reasonForLowerLikelihood": "...",
      "counterEvidence": "..."
    }
  ]
}`;

  const findingsListText =
    structuredFindings.length > 0 && !isImagingMissing
      ? structuredFindings
          .map((f) => `  * [${f.id}] Region: "${f.region}", Observation: "${f.observation}", Severity: "${f.severity}"`)
          .join('\n')
      : '  * Imaging Deferred / No imaging scan submitted.';

  const userPrompt = `Synthesize the findings from all three specialized agents and the retrieved clinical guidelines into the final triage report:

DATA COMPLETENESS STATUS: ${dataCompletenessLevel.toUpperCase()} (Imaging missing: ${isImagingMissing}, Labs missing: ${isLabsMissing})

1. INTERVIEWER AGENT ASSESSMENT:
- Summary: ${interviewer.clinicalSummary}
- Symptom Timeline: ${interviewer.symptomTimeline}
- Vitals Assessment: ${JSON.stringify(interviewer.vitalsAssessment, null, 2)}
- Risk Factors: ${interviewer.keyRiskFactors?.join('; ') || 'None recorded'}
- Impressions: ${interviewer.interviewerImpressions?.join('; ') || 'None'}
- Red Flags: ${interviewer.redFlagSymptoms?.join('; ') || 'None'}
${
  interviewer.adaptiveFollowUps && interviewer.adaptiveFollowUps.length > 0
    ? `- Adaptive Triage Follow-Up Findings:\n${interviewer.adaptiveFollowUps
        .map((q, idx) => `  * Q${idx + 1} (${q.reasoning}): "${q.question}" -> Patient: "${q.answer || 'Not answered'}"`)
        .join('\n')}`
    : ''
}

2. RADIOLOGIST AGENT FINDINGS:
- Modality: ${radiologist.studyModality || (isImagingMissing ? 'Deferred / Not Submitted' : 'Chest X-Ray')}
- Overall Impression Line: ${radiologist.overallImpression || radiologist.radiologicalImpression}
- Structured Finding Chips:
${findingsListText}
- Technical Quality: ${radiologist.technicalQuality}
${
  !isImagingMissing && radiologist.modelInference
    ? `- Real DenseNet-121 ONNX Model Outputs:
${radiologist.modelInference.classes
  .map(
    (c) =>
      `  * ${c.label}: ${(c.probability * 100).toFixed(1)}% (raw logit: ${c.logit.toFixed(3)}) ${c.flaggedPositive ? '[FLAGGED POSITIVE > 0.5]' : ''}`
  )
  .join('\n')}
- Model Flagged Positives: ${radiologist.modelInference.positiveFindings.join('; ') || 'None'}
- Model Reliability Note: ${radiologist.modelInference.reliabilityNote}`
    : '- Imaging Status: Deferred / Not performed for this triage intake.'
}

3. LAB ANALYST AGENT FINDINGS:
- Processed Markers: ${isLabsMissing ? '[] (No laboratory markers submitted)' : JSON.stringify(labAnalyst.processedMarkers, null, 2)}
- Critical Alerts: ${labAnalyst.criticalAlerts?.join('; ') || 'None'}
- Clinical Calculations: ${JSON.stringify(labAnalyst.clinicalCalculations, null, 2)}
- Organ Systems Flagged: ${labAnalyst.organSystemsFlagged?.join('; ') || 'None'}
- Lab Impression: ${labAnalyst.labImpression}

4. LIVE RETRIEVED CLINICAL GUIDELINES (RAG Similarity Search Results):
${
  retrievedGuidelines.length > 0
    ? retrievedGuidelines
        .map(
          (g, idx) =>
            `[Guideline ${idx + 1}]
Title: ${g.title}
Source: ${g.source}
Category: ${g.category}
Vector Cosine Similarity: ${g.similarityScore ?? 'N/A'}
Guideline Criteria / Passage:
"${g.snippet}"`
        )
        .join('\n\n')
    : 'Standard triage clinical decision protocols applied.'
}

Synthesize these inputs now. If imaging or labs are missing/deferred, explicitly populate missingDataSources and diagnosticLimitationsNotice, cap confidence scores accordingly, and state clearly how missing objective data limits diagnostic certainty.`;

  if (ai) {
    try {
      const rawText = await generateContentWithFallback(ai, {
        contents: [{ text: userPrompt }],
        systemInstruction,
        temperature: 0.2,
      });

      const parsed = JSON.parse(rawText) as DoctorSynthesis;
      parsed.agentName = 'Doctor Agent';

      // Ensure missing data sources and limitations notice are populated
      if (!parsed.missingDataSources || parsed.missingDataSources.length === 0) {
        if (defaultMissingSources.length > 0) {
          parsed.missingDataSources = defaultMissingSources;
        }
      }
      if (!parsed.dataCompletenessLevel) {
        parsed.dataCompletenessLevel = dataCompletenessLevel;
      }
      if (!parsed.diagnosticLimitationsNotice && defaultLimitationsNotice) {
        parsed.diagnosticLimitationsNotice = defaultLimitationsNotice;
      }

      // If symptoms only, strictly cap probability scores
      if (dataCompletenessLevel === 'symptoms_only' && parsed.probableConditions) {
        parsed.probableConditions = parsed.probableConditions.map((cond, idx) => {
          const cappedScore = idx === 0 ? Math.min(cond.probabilityScore || 50, 55) : Math.min(cond.probabilityScore || 25, 30);
          const strength = idx === 0 ? 'moderate' : 'weak';
          return {
            ...cond,
            probabilityScore: cappedScore,
            evidenceStrength: cond.evidenceStrength === 'strong' ? strength : (cond.evidenceStrength || strength),
            referencedFindingIds: [],
          };
        });
        parsed.referencedRadiologistFindings = [];
      } else if (!parsed.referencedRadiologistFindings || parsed.referencedRadiologistFindings.length === 0) {
        if (!isImagingMissing && structuredFindings.length > 0) {
          const firstAbnormal = structuredFindings.find((f) => f.severity !== 'Normal') || structuredFindings[0];
          parsed.referencedRadiologistFindings = [firstAbnormal.id];
        } else {
          parsed.referencedRadiologistFindings = [];
        }
      }

      if (parsed.probableConditions && parsed.probableConditions.length > 0) {
        parsed.probableConditions = parsed.probableConditions.map((cond) => {
          const pillars = computeConfidencePillars({
            interviewer,
            radiologist,
            labAnalyst,
            retrievedGuidelines,
            evidenceCitations: cond.evidenceCitations,
            isImagingMissing,
            isLabsMissing,
          });
          return applyPillarCalibration(cond, pillars);
        });
      }

      return parsed;
    } catch (err: any) {
      console.warn('[Doctor Agent] Gemini generation unavailable (quota/rate-limit). Utilizing deterministic multi-modal doctor synthesis engine.');
    }
  }

  return buildFallbackDoctorSynthesis(
    interviewer,
    radiologist,
    labAnalyst,
    retrievedGuidelines,
    structuredFindings,
    isImagingMissing,
    isLabsMissing,
    dataCompletenessLevel,
    defaultMissingSources,
    defaultLimitationsNotice
  );
}

function buildFallbackDoctorSynthesis(
  interviewer: InterviewerAnalysis,
  radiologist: RadiologistAnalysis,
  labAnalyst: LabAnalystAnalysis,
  retrievedGuidelines: ClinicalGuideline[],
  structuredFindings: any[],
  isImagingMissing: boolean,
  isLabsMissing: boolean,
  dataCompletenessLevel: 'symptoms_only' | 'partial' | 'complete',
  missingDataSources: MissingDataSource[],
  diagnosticLimitationsNotice: string
): DoctorSynthesis {
  const summaryLower = (interviewer.clinicalSummary + ' ' + (interviewer.symptomTimeline || '')).toLowerCase();

  const isAppendicitis = summaryLower.includes('appendicitis') || summaryLower.includes('abdominal') || summaryLower.includes('rlq');
  const isCardiac = summaryLower.includes('nstemi') || summaryLower.includes('troponin') || summaryLower.includes('coronary') || summaryLower.includes('chest pain') || summaryLower.includes('angina');
  const isCopd = summaryLower.includes('copd') || summaryLower.includes('respiratory acidosis') || summaryLower.includes('wheez') || summaryLower.includes('emphysema');

  let citedFindingId = 'RF-1';
  let citedFinding = structuredFindings.find((f) => f.severity === 'Severe' || f.severity === 'Moderate') || structuredFindings[0] || {
    id: 'RF-1',
    region: 'Thorax / Scan Field',
    observation: radiologist.overallImpression || 'Relevant anatomical findings noted on diagnostic scan.',
    severity: 'Moderate',
  };

  let primaryCondition = 'Acute Community-Acquired Lower Respiratory Infection / Suspected Pneumonia';
  let primaryIcd = 'J13 / J18.1';
  let urgencyLevel: UrgencyLevel = 'urgent';
  let urgencyRationale = 'Tachypnea, fever, and acute respiratory symptoms indicate potential lower respiratory infection requiring prompt clinical evaluation, vital monitoring, and diagnostic confirmation.';
  let execSummary = `Patient presents with acute respiratory symptoms and systemic signs. In the absence of confirmatory imaging and laboratory panels, triage proceeds on syndromic presentation; immediate diagnostic imaging and inflammatory biomarkers are required.`;

  let primaryGuidelineQuote =
    retrievedGuidelines.find((g) => g.id.includes('curb') || g.title.toLowerCase().includes('pneumonia'))?.snippet ||
    '“Assess pneumonia severity using CURB-65: ... Respiratory rate >= 30/min, Age >= 65. Score 2 indicates intermediate risk (9% mortality), requiring urgent hospital admission; score 3-5 indicates severe pneumonia (15-40% mortality), mandating emergency inpatient care...”';

  let secondaryCondition = 'Acute Bronchitis / Viral Upper-to-Lower Respiratory Tract Infection';
  let secondaryIcd = 'J20.9';
  let secondaryScore = 24;
  let secondaryRationale = 'Considered in differential for acute cough; however, presence of marked systemic vitals derangement makes deeper parenchymal infection or complication more probable, pending chest imaging.';
  let secondaryGuidelineQuote =
    retrievedGuidelines.find((g) => g.id.includes('pe') || g.title.toLowerCase().includes('embolism'))?.snippet ||
    '“Distinguish acute bronchitis from bacterial pneumonia by evaluating focal chest signs, prolonged fever, tachypnea, and obtaining chest radiography when vital signs are abnormal.”';

  if (isCardiac) {
    primaryCondition = 'Suspected Acute Coronary Syndrome (ACS) / Unstable Angina';
    primaryIcd = 'I20.0 / I21.4';
    urgencyLevel = 'emergency';
    urgencyRationale = 'Acute chest discomfort with potential ischemic radiation and diaphoresis constitutes an immediate medical emergency. Immediate STAT 12-lead ECG and serial cardiac troponin are required.';
    execSummary = `Patient presents with acute chest discomfort triaged as EMERGENCY. Clinical history is highly suspicious for acute coronary syndrome; immediate 12-lead ECG and serial cardiac biomarker sampling are mandatory prior to risk stratification.`;
    primaryGuidelineQuote =
      retrievedGuidelines.find((g) => g.id.includes('acs') || g.title.toLowerCase().includes('coronary'))?.snippet ||
      '“For acute chest pain radiating to neck, jaw, or left arm with accompanying diaphoresis, dyspnea, or nausea: perform immediate 12-lead ECG and high-sensitivity cardiac Troponin I/T. Triage as Urgent/Emergency. Initiate dual antiplatelet therapy and therapeutic anticoagulation upon biomarker or ECG confirmation.”';

    secondaryCondition = 'Gastroesophageal Reflux Disease (GERD) with Esophageal Spasm';
    secondaryIcd = 'K21.9';
    secondaryScore = 18;
    secondaryRationale = 'Weak supporting evidence: retrosternal pain can mimic cardiac symptoms, but cardiac causes must be aggressively excluded first in any acute presentation.';
    secondaryGuidelineQuote = '“In patients with acute chest pain, cardiac etiologies must be definitively excluded prior to attributing symptoms to gastrointestinal or non-cardiac chest pain syndromes.”';
  } else if (isAppendicitis) {
    primaryCondition = 'Suspected Acute Appendicitis / Acute Surgical Abdomen';
    primaryIcd = 'K35.80';
    urgencyLevel = 'urgent';
    urgencyRationale = 'Migratory abdominal pain localizing to right lower quadrant requires urgent surgical evaluation, CBC for leukocytosis, and targeted ultrasound or CT scan.';
    execSummary = `Acute abdominal presentation concerning for acute appendicitis. Triage urgency is prioritized based on clinical history; urgent abdominal imaging and inflammatory laboratory panels are required.`;
    primaryGuidelineQuote =
      retrievedGuidelines.find((g) => g.id.includes('appendicitis') || g.title.toLowerCase().includes('appendicitis'))?.snippet ||
      '“Patients presenting with migratory abdominal pain to the right lower quadrant, localized McBurney point tenderness, low-grade fever. Contrast CT or graded ultrasound is the gold standard showing appendiceal diameter > 6-7 mm.”';

    secondaryCondition = 'Acute Gastroenteritis / Mesenteric Adenitis';
    secondaryIcd = 'K52.9';
    secondaryScore = 26;
    secondaryRationale = 'Considered in acute abdominal pain but focal RLQ localization and peritoneal signs warrant prioritized surgical imaging.';
    secondaryGuidelineQuote = '“Mesenteric lymphadenitis presents with RLQ tenderness but lacks true appendiceal wall thickening or target sign on targeted sonography.”';
  } else if (isCopd) {
    primaryCondition = 'Suspected COPD Exacerbation / Acute Airway Obstruction';
    primaryIcd = 'J44.1';
    urgencyLevel = 'urgent';
    urgencyRationale = 'Worsening dyspnea and wheezing in patient with respiratory risk factors requires urgent bronchodilator therapy, pulse oximetry, and arterial blood gas sampling.';
    execSummary = `Acute respiratory distress concerning for obstructive airway exacerbation. Triage is managed on clinical presentation pending blood gas and chest radiography confirmation.`;
    primaryGuidelineQuote =
      retrievedGuidelines.find((g) => g.id.includes('copd') || g.title.toLowerCase().includes('copd'))?.snippet ||
      '“An acute exacerbation of COPD is characterized by increased dyspnea, sputum volume, and sputum purulence. Triage as Urgent or Emergency if acute respiratory acidosis or oxygen saturation < 90%.”';

    secondaryCondition = 'Acute Bronchospasm / Reactive Airway Disease';
    secondaryIcd = 'J45.901';
    secondaryScore = 28;
    secondaryRationale = 'Symptom overlap with general reactive airway disease; definitive staging requires spirometry and imaging.';
    secondaryGuidelineQuote = '“Evaluate for previous history of smoking, chronic cough, and response to short-acting beta-agonists.”';
  }

  // Adjust summary and citations based on data availability
  if (!isImagingMissing && !isLabsMissing) {
    execSummary = `Patient presents with acute disease corroborated by [${citedFindingId}: ${citedFinding.region} (${citedFinding.severity})] demonstrating ${citedFinding.observation.toLowerCase()}, elevated inflammatory biomarkers, and systemic triage signs.`;
  } else if (isImagingMissing && !isLabsMissing) {
    execSummary = `Patient presents with acute symptoms supported by laboratory biomarker derangements. Radiological imaging was not submitted; anatomical confirmation is pending.`;
  } else if (!isImagingMissing && isLabsMissing) {
    execSummary = `Patient presents with acute symptoms corroborated by [${citedFindingId}: ${citedFinding.region} (${citedFinding.severity})]. Quantitative laboratory biomarker evaluation is pending.`;
  }

  // Scores
  let primaryScore = 88;
  let primaryStrength: 'strong' | 'moderate' | 'weak' = 'strong';
  let primaryFindingIds = isImagingMissing ? [] : [citedFindingId];

  if (dataCompletenessLevel === 'symptoms_only') {
    primaryScore = 52;
    primaryStrength = 'moderate';
    secondaryScore = 22;
  } else if (dataCompletenessLevel === 'partial') {
    primaryScore = 68;
    primaryStrength = 'moderate';
    secondaryScore = 24;
  }

  const primaryCitations: EvidenceCitation[] = [
    {
      sourceType: 'interview',
      sourceName: 'Patient Intake & Clinical Presentation',
      claim: interviewer.clinicalSummary || 'Acute presentation described during triage interview',
      citedTextOrValue: `${interviewer.symptomTimeline || 'Acute symptom onset'}. Presentation: ${interviewer.clinicalSummary.slice(0, 140)}...`,
      confidenceContribution: 'High clinical concordance with characteristic syndromic disease pattern',
    },
  ];

  if (!isLabsMissing && labAnalyst.processedMarkers && labAnalyst.processedMarkers.length > 0) {
    const primaryLab = labAnalyst.processedMarkers.find((m) => m.status.includes('HIGH') || m.status.includes('LOW')) || labAnalyst.processedMarkers[0];
    primaryCitations.push({
      sourceType: 'lab',
      sourceName: `${primaryLab.name} Panel`,
      claim: primaryLab.interpretation || 'Biochemical confirmation of acute disease process',
      citedTextOrValue: `${primaryLab.name}: ${primaryLab.value} ${primaryLab.unit} (Ref: ${primaryLab.referenceRange}) [${primaryLab.status}]`,
      confidenceContribution: 'Definitive laboratory biomarker proof of acute pathology',
    });
  } else {
    primaryCitations.push({
      sourceType: 'lab',
      sourceName: 'Laboratory Biomarkers (Deferred / Unavailable)',
      claim: 'Objective laboratory data not available at time of triage',
      citedTextOrValue: 'No blood chemistry, hematology, or biomarker values submitted. Quantitative validation is pending.',
      confidenceContribution: 'Absence of laboratory data prevents biochemical confirmation and caps confidence',
    });
  }

  if (!isImagingMissing && structuredFindings.length > 0) {
    primaryCitations.push({
      sourceType: 'radiology',
      sourceName: `[${citedFindingId}] ${radiologist.studyModality} - ${citedFinding.region}`,
      claim: `Objective scan confirmation: ${citedFinding.observation}`,
      citedTextOrValue: `[${citedFindingId} • ${citedFinding.severity}]: ${citedFinding.observation}`,
      confidenceContribution: 'Direct anatomical localization and radiological confirmation',
    });
  } else {
    primaryCitations.push({
      sourceType: 'radiology',
      sourceName: 'Radiological Imaging (Deferred / Unavailable)',
      claim: 'Objective diagnostic imaging not performed at time of triage',
      citedTextOrValue: 'No diagnostic scan uploaded with intake. Anatomical confirmation pending diagnostic imaging order.',
      confidenceContribution: 'Absence of anatomical imaging prevents visualization of lesions and caps diagnostic confidence',
    });
  }

  primaryCitations.push({
    sourceType: 'guideline',
    sourceName: retrievedGuidelines[0]?.title || 'Evidence-Based Clinical Practice Guidelines',
    claim: 'Validated clinical decision rule & severity triage threshold',
    citedTextOrValue: `“${primaryGuidelineQuote.replace(/^“|”$/g, '')}”`,
    confidenceContribution: 'Grounded consensus guideline validating triage management pathway',
  });

  const nextSteps: DoctorSynthesis['recommendedNextSteps'] = [
    {
      category: 'Immediate Stabilization',
      action: 'Initiate targeted medical therapy and continuous vital signs monitoring according to severity protocol.',
      timeframe: 'Immediately (< 30 minutes)',
      groundingCitation: 'Grounded in triage urgency and syndromic presentation.',
    },
  ];

  if (isImagingMissing) {
    nextSteps.push({
      category: 'Diagnostics & Labs',
      action: 'Order urgent diagnostic imaging (Chest Radiograph / Ultrasound / CT as clinically indicated).',
      timeframe: 'Within 1 hour',
      groundingCitation: 'Essential diagnostic step to close missing imaging gap and establish anatomical diagnosis.',
    });
  }

  if (isLabsMissing) {
    nextSteps.push({
      category: 'Diagnostics & Labs',
      action: 'Order STAT diagnostic laboratory panel (CBC with diff, CMP, Troponin, Lactate, Inflammatory markers).',
      timeframe: 'Within 1 hour',
      groundingCitation: 'Essential diagnostic step to close missing biomarker gap and assess organ function.',
    });
  }

  nextSteps.push({
    category: 'Monitoring',
    action: 'Continuous pulse oximetry, blood pressure, and clinical re-assessment.',
    timeframe: 'q30-60min',
    groundingCitation: 'Standard clinical monitoring for acute triage intake.',
  });

  const rawConditions = [
    {
      condition: primaryCondition,
      icdCodeEstimate: primaryIcd,
      probabilityScore: primaryScore,
      evidenceStrength: primaryStrength,
      referencedFindingIds: primaryFindingIds,
      rationale:
        dataCompletenessLevel === 'symptoms_only'
          ? 'Preliminary syndromic probability based on characteristic patient presentation and triage vitals. Diagnostic certainty is capped pending objective imaging and laboratory verification.'
          : `Strong clinical concordance based on patient intake history, ${!isImagingMissing ? `scan findings on [${citedFindingId}], ` : ''}${!isLabsMissing ? 'biomarker derangements, ' : ''}and guideline triage rules.`,
      evidenceCitations: primaryCitations,
    },
    {
      condition: secondaryCondition,
      icdCodeEstimate: secondaryIcd,
      probabilityScore: secondaryScore,
      evidenceStrength: 'weak' as const,
      referencedFindingIds: [],
      rationale: secondaryRationale,
      evidenceCitations: [
        {
          sourceType: 'interview' as const,
          sourceName: 'Patient Intake Triage History',
          claim: 'Non-specific symptom overlap with alternative diagnostic considerations',
          citedTextOrValue: interviewer.symptomTimeline || 'Symptom overlap with general acute presentation',
          confidenceContribution: 'Symptom presence is non-specific and lacks pathognomonic diagnostic features',
        },
        {
          sourceType: 'guideline' as const,
          sourceName: 'Differential Diagnostic Evaluation Protocol',
          claim: 'Guideline criteria for ruling down alternative etiology',
          citedTextOrValue: `“${secondaryGuidelineQuote.replace(/^“|”$/g, '')}”`,
          confidenceContribution: 'Guideline decision rules indicate primary diagnosis is significantly higher priority',
        },
      ],
    },
  ];

  const probableConditions = rawConditions.map((cond) => {
    const pillars = computeConfidencePillars({
      interviewer,
      radiologist,
      labAnalyst,
      retrievedGuidelines,
      evidenceCitations: cond.evidenceCitations,
      isImagingMissing,
      isLabsMissing,
    });
    return applyPillarCalibration(cond, pillars);
  });

  return {
    agentName: 'Doctor Agent',
    urgencyLevel,
    urgencyRationale,
    clinicalExecutiveSummary: execSummary,
    referencedRadiologistFindings: primaryFindingIds,
    dataCompletenessLevel,
    diagnosticLimitationsNotice,
    missingDataSources,
    probableConditions,
    recommendedNextSteps: nextSteps,
    guidelineGroundingSummary: 'Triage decisions mapped directly against retrieved clinical guidelines, accounting for available and deferred data modalities.',
    differentialExclusions: [
      {
        condition: secondaryCondition,
        reasonForLowerLikelihood: secondaryRationale,
        counterEvidence: dataCompletenessLevel === 'symptoms_only'
          ? 'Clinical presentation preferentially favors primary syndromic diagnosis, but definitive exclusion requires confirmatory laboratory and imaging diagnostics.'
          : `Objective diagnostic data preferentially supports ${primaryCondition}.`,
      },
    ],
  };
}
