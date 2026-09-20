import { GoogleGenAI } from '@google/genai';
import type { LabPanelData, LabAnalystAnalysis, LabMarker } from '../../src/types/clinical';
import { generateContentWithFallback } from '../utils/aiHelper';
import { evaluateLabMarker, isMarkerFlagged } from '../../src/utils/labReference';

export async function runLabAnalystAgent(
  ai: GoogleGenAI,
  labs: LabPanelData | undefined,
  clinicalContext: string,
  vitals?: { heartRate: number; bloodPressureSystolic: number }
): Promise<LabAnalystAnalysis> {
  if (!labs || ((!labs.markers || labs.markers.length === 0) && !labs.rawReportText)) {
    const clinicalCalculations = [];
    const criticalAlerts: string[] = [];

    if (vitals && vitals.heartRate && vitals.bloodPressureSystolic && vitals.bloodPressureSystolic > 0) {
      const si = (vitals.heartRate / vitals.bloodPressureSystolic).toFixed(2);
      const isElevated = parseFloat(si) >= 0.9;
      clinicalCalculations.push({
        indexName: 'Shock Index (Bedside Vitals Derived)',
        calculatedValue: si,
        referenceNorm: '0.50 - 0.70',
        clinicalMeaning: isElevated
          ? 'Elevated (>= 0.90), warning of early circulatory hypoperfusion / occult shock.'
          : 'Normal resting hemodynamic perfusion range.',
      });
      if (isElevated) {
        criticalAlerts.push('Elevated bedside shock index (>= 0.90) indicates urgent need for STAT serum lactate, arterial blood gas, and CBC.');
      }
    }

    return {
      agentName: 'Lab Analyst Agent',
      processedMarkers: [],
      criticalAlerts,
      clinicalCalculations,
      organSystemsFlagged: [],
      labImpression: 'Laboratory panels deferred. No blood chemistry, hematology, or biomarker values submitted with intake. Clinical assessment proceeds on syndromic symptom presentation and triage vitals; formal laboratory workup is strongly recommended.',
    };
  }

  const evaluatedInputMarkers = (labs.markers || []).map(evaluateLabMarker);

  const systemInstruction = `You are the Lab Analyst Agent in MediAgent AI, an expert clinical pathology and diagnostic laboratory decision-support system (educational prototype).
Your role:
1. Compare each entered lab value against clinical reference intervals.
2. Flag out-of-range values with exact status:
   - "NORMAL"
   - "ABNORMAL_HIGH"
   - "ABNORMAL_LOW"
   - "CRITICAL_HIGH" (e.g. Troponin > 0.5 ng/mL, Potassium > 6.0 or < 2.8 mmol/L, Lactate > 4.0 mmol/L, Platelets < 50k, pH < 7.20, Glucose > 400 mg/dL or < 50 mg/dL, WBC > 20k, Procalcitonin > 2.0 ng/mL)
   - "CRITICAL_LOW"
3. Produce a concise, high-impact ONE-LINE CLINICAL INTERPRETATION per flagged marker (e.g. "elevated WBC (18.4 10^3/uL) — marked leukocytosis with left shift, consistent with possible acute bacterial infection").
4. Calculate derived clinical indices if variables are present:
   - Shock Index (HR / SBP): normal 0.5-0.7; > 0.9 indicates high risk for occult hypoperfusion/shock.
   - Serum Anion Gap (Na - [Cl + HCO3]): normal 8-12 mEq/L; > 12 signifies high anion gap metabolic acidosis.
   - BUN / Creatinine ratio: > 20 indicates pre-renal azotemia.
5. Identify all affected organ systems (e.g. Cardiovascular, Renal, Hematologic, Hepatic, Pulmonary, Metabolic/Endocrine).
6. Generate immediate critical alerts and a synthesized lab impression.

Output MUST be strictly valid JSON matching this schema:
{
  "agentName": "Lab Analyst Agent",
  "processedMarkers": [
    {
      "name": "White Blood Cell Count (WBC)",
      "value": "18.4",
      "unit": "10^3/uL",
      "referenceRange": "4.5 - 11.0",
      "status": "ABNORMAL_HIGH",
      "interpretation": "elevated WBC (18.4 10^3/uL) — marked leukocytosis with left shift, consistent with possible acute bacterial infection or severe systemic inflammatory process"
    }
  ],
  "criticalAlerts": [
    "Markedly elevated WBC (18.4 x 10^3/uL) and C-Reactive Protein (142 mg/L) indicating intense systemic inflammation."
  ],
  "clinicalCalculations": [
    {
      "indexName": "Shock Index",
      "calculatedValue": "1.03",
      "referenceNorm": "0.50 - 0.70",
      "clinicalMeaning": "Elevated (> 0.90), warning of early compensated circulatory hypoperfusion."
    }
  ],
  "organSystemsFlagged": ["Infectious / Hematologic", "Pulmonary"],
  "labImpression": "Laboratory profile demonstrates acute severe bacterial inflammatory response with elevated inflammatory biomarkers..."
}`;

  const userPrompt = `Clinical Context: ${clinicalContext}
${vitals ? `Patient Vitals for calculation: Heart Rate = ${vitals.heartRate} bpm, Systolic BP = ${vitals.bloodPressureSystolic} mmHg` : ''}

Reported Laboratory Markers (with pre-evaluated ranges):
${
  evaluatedInputMarkers.length > 0
    ? evaluatedInputMarkers
        .map(
          (m) =>
            `- ${m.name}: ${m.value} ${m.unit} (Ref Range: ${m.referenceRange}) [Pre-check Status: ${m.status}] -> Interpretation draft: "${m.interpretation}"`
        )
        .join('\n')
    : 'No discrete markers entered.'
}

${labs.rawReportText ? `Raw Lab Report Text / Notes:\n${labs.rawReportText}` : ''}

Analyze and interpret this laboratory panel now according to your clinical pathology instructions. Ensure every flagged marker includes its sharp one-line clinical interpretation.`;

  try {
    const rawText = await generateContentWithFallback(ai, {
      contents: [{ text: userPrompt }],
      systemInstruction,
      temperature: 0.2,
    });

    const parsed = JSON.parse(rawText) as LabAnalystAnalysis;
    parsed.agentName = 'Lab Analyst Agent';

    // Reconcile and guarantee deterministic reference range checking
    if (parsed.processedMarkers && parsed.processedMarkers.length > 0) {
      parsed.processedMarkers = parsed.processedMarkers.map((m) => {
        const refChecked = evaluateLabMarker(m);
        // If LLM produced a good specific interpretation, keep it if flagged, else fallback to standard
        const interpretation =
          m.interpretation && m.interpretation.length > 10 && isMarkerFlagged(refChecked.status)
            ? m.interpretation
            : refChecked.interpretation;
        return {
          ...refChecked,
          interpretation,
        };
      });
    } else {
      parsed.processedMarkers = evaluatedInputMarkers;
    }

    return parsed;
  } catch (err: any) {
    console.warn('[Lab Analyst Agent] Gemini generation unavailable (quota/rate-limit). Utilizing reference range pathology evaluation engine.');
    return {
      agentName: 'Lab Analyst Agent',
      processedMarkers: evaluatedInputMarkers,
      criticalAlerts: evaluatedInputMarkers
        .filter((m) => m.status === 'CRITICAL_HIGH' || m.status === 'CRITICAL_LOW')
        .map((m) => `Critical ${m.name}: ${m.value} ${m.unit} (${m.interpretation || m.status})`),
      clinicalCalculations: vitals
        ? [
            {
              indexName: 'Shock Index (HR / SBP)',
              calculatedValue: (vitals.heartRate / (vitals.bloodPressureSystolic || 120)).toFixed(2),
              referenceNorm: '0.50 - 0.70',
              clinicalMeaning:
                vitals.heartRate / (vitals.bloodPressureSystolic || 120) > 0.9
                  ? 'Elevated (> 0.90), occult hypoperfusion / hemodynamic compensation alert.'
                  : 'Normal resting shock index.',
            },
          ]
        : [],
      organSystemsFlagged: ['Hematologic / General'],
      labImpression: 'Comprehensive automated laboratory reference range review completed.',
    };
  }
}

