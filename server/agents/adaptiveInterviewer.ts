import { GoogleGenAI } from '@google/genai';
import type { AdaptiveFollowUpQuestion, PatientVitals } from '../../src/types/clinical';
import { generateContentWithFallback } from '../utils/aiHelper';

interface AdaptiveContext {
  chiefComplaint: string;
  symptomDescription?: string;
  age?: number;
  gender?: string;
  vitals?: PatientVitals;
  pastMedicalHistory?: string;
}

/**
 * Intelligent clinical heuristics providing instant high-yield questions
 * for primary emergency presentations.
 */
function getRuleBasedFollowUps(context: AdaptiveContext): AdaptiveFollowUpQuestion[] {
  const cc = (context.chiefComplaint || '').toLowerCase();
  const desc = (context.symptomDescription || '').toLowerCase();
  const combined = `${cc} ${desc}`;

  if (combined.includes('chest') || combined.includes('angina') || combined.includes('pressure') || combined.includes('tightness') || combined.includes('substernal')) {
    return [
      {
        id: 'afq-chest-1',
        question: 'Does the chest discomfort radiate to your left arm, neck, jaw, back, or shoulder blade, and is it triggered or worsened by exertion?',
        reasoning: 'Triage Logic: Radiation to the left arm or jaw with exertional provocation significantly elevates the pre-test probability of Acute Coronary Syndrome (ACS) over non-ischemic causes.',
        suggestedAnswers: [
          'Yes, radiates to left arm and jaw, aggravated by exertion',
          'No radiation; sharp and worse with deep breathing or coughing',
          'Dull localized pressure without radiation, not related to exertion',
        ],
      },
      {
        id: 'afq-chest-2',
        question: 'When the chest discomfort began, did you experience cold sweating (diaphoresis), shortness of breath, or nausea/vomiting?',
        reasoning: 'Triage Logic: Autonomic signs (diaphoresis, nausea) in conjunction with chest pain serve as major red-flag risk factors for acute myocardial infarction.',
        suggestedAnswers: [
          'Yes, broke out in cold sweat with nausea',
          'Mild shortness of breath only, no nausea or sweating',
          'No autonomic symptoms, pain is isolated to chest wall',
        ],
      },
    ];
  }

  if (combined.includes('breath') || combined.includes('dyspnea') || combined.includes('short of breath') || combined.includes('wheez') || combined.includes('suffocat')) {
    return [
      {
        id: 'afq-resp-1',
        question: 'Does your shortness of breath worsen when lying flat (orthopnea), or have you woken up gasping for air at night (paroxysmal nocturnal dyspnea)?',
        reasoning: 'Triage Logic: Orthopnea and PND distinguish elevated left-ventricular filling pressures (acute pulmonary edema / CHF) from parenchymal pneumonia or bronchospasm.',
        suggestedAnswers: [
          'Yes, cannot sleep flat and need 2-3 pillows',
          'No change with lying flat; worse with coughing and exertion',
          'Sudden acute onset without positional changes',
        ],
      },
      {
        id: 'afq-resp-2',
        question: 'Are you coughing up any sputum, and if so, what color is it (e.g. rust-colored, green/yellow, pink frothy, or clear)?',
        reasoning: 'Triage Logic: Purulent or rust-colored sputum points toward bacterial consolidation (pneumonia), whereas pink frothy sputum indicates pulmonary edema, and clear sputum suggests viral or reactive airway disease.',
        suggestedAnswers: [
          'Yes, thick purulent green/rust-colored sputum',
          'Dry hacking cough without sputum production',
          'Coughing up clear thin secretions',
        ],
      },
    ];
  }

  if (combined.includes('abdom') || combined.includes('belly') || combined.includes('stomach') || combined.includes('quadrant') || combined.includes('iliac') || combined.includes('appendi')) {
    return [
      {
        id: 'afq-abd-1',
        question: 'Did the pain begin around your navel (belly button) before moving to the lower right side, and does walking or coughing intensify it?',
        reasoning: 'Triage Logic: Classical visceral-to-somatic migration (periumbilical to RLQ McBurney point) has high specificity for acute appendicitis; exacerbation by jarring movements indicates parietal peritoneal irritation.',
        suggestedAnswers: [
          'Yes, started near belly button and migrated to sharp lower right pain',
          'Constant generalized crampy pain across entire abdomen',
          'Pain started directly in right upper quadrant under the ribs',
        ],
      },
      {
        id: 'afq-abd-2',
        question: 'Have you experienced complete loss of appetite (anorexia), vomiting, or inability to pass gas or stool?',
        reasoning: 'Triage Logic: Anorexia is present in >80% of acute appendicitis cases; failure to pass gas/stool points to acute mechanical bowel obstruction or paralytic ileus.',
        suggestedAnswers: [
          'Complete loss of appetite and vomited twice',
          'Able to eat small amounts, mild nausea only',
          'No nausea, normal bowel movements today',
        ],
      },
    ];
  }

  if (combined.includes('head') || combined.includes('cephala') || combined.includes('migrain') || combined.includes('dizz') || combined.includes('syncope')) {
    return [
      {
        id: 'afq-neuro-1',
        question: 'Did this headache reach peak maximum intensity instantaneously within seconds like a "thunderclap", or build gradually over hours/days?',
        reasoning: 'Triage Logic: Sudden maximal onset ("thunderclap headache") is the hallmark clinical presentation of subarachnoid hemorrhage requiring emergent non-contrast CT.',
        suggestedAnswers: [
          'Instantaneous peak severity in under 1 minute (worst headache of life)',
          'Gradual buildup over several hours, throbbing in nature',
          'Constant dull tension headache present for 3 days',
        ],
      },
      {
        id: 'afq-neuro-2',
        question: 'Have you noticed any weakness on one side of your face/body, speech slurring, vision changes, or neck stiffness with light sensitivity?',
        reasoning: 'Triage Logic: Screens for acute ischemic stroke (focal motor/speech deficits) and acute meningitis (nuchal rigidity and photophobia).',
        suggestedAnswers: [
          'No weakness or numbness, but neck feels stiff with light sensitivity',
          'Mild facial drooping or arm weakness noticed by family',
          'No neurological deficits, normal vision and speech',
        ],
      },
    ];
  }

  if (combined.includes('fever') || combined.includes('chill') || combined.includes('infection') || combined.includes('sepsis')) {
    return [
      {
        id: 'afq-fever-1',
        question: 'Have you noticed any confusion, severe dizziness upon standing, or a noticeable drop in how frequently you are urinating?',
        reasoning: 'Triage Logic: Evaluates systemic hypoperfusion, altered mental status (CURB-65 / qSOFA criterion), and early acute kidney injury in severe systemic sepsis.',
        suggestedAnswers: [
          'Feel dizzy when standing and have not urinated in 8 hours',
          'Fatigued but fully oriented, normal urine output',
          'Shivering shaking chills (rigors) with high fever',
        ],
      },
      {
        id: 'afq-fever-2',
        question: 'Do you have any localized source of infection such as burning with urination, skin redness, or cough?',
        reasoning: 'Triage Logic: Rapid source identification guides targeted empiric antimicrobial selection and diagnostic workup.',
        suggestedAnswers: [
          'Productive cough and chest discomfort',
          'Severe burning and urgency during urination',
          'Spreading red warm rash on lower extremity',
        ],
      },
    ];
  }

  // Generic clinical high-yield triage questions
  return [
    {
      id: 'afq-gen-1',
      question: 'Did your symptoms begin suddenly within minutes, or develop gradually over hours to days, and are they worsening right now?',
      reasoning: 'Triage Logic: Rate of symptom progression differentiates acute catastrophic events (vascular, ischemic, rupture) from subacute inflammatory or indolent processes.',
      suggestedAnswers: [
        'Sudden acute onset and rapidly worsening',
        'Gradual progression over several days',
        'Intermittent episodes that come and go',
      ],
    },
    {
      id: 'afq-gen-2',
      question: 'Are there specific actions, movements, or positions that relieve or worsen the discomfort?',
      reasoning: 'Triage Logic: Identifying aggravating and relieving factors delineates somatic/musculoskeletal pain from visceral, vascular, or inflammatory pathology.',
      suggestedAnswers: [
        'Worsens significantly with movement and deep breathing',
        'Constant unremitting discomfort unaffected by position',
        'Partially relieved by rest or medication',
      ],
    },
  ];
}

/**
 * Generates 1-2 adaptive follow-up questions tailored to chief complaint,
 * backed by Gemini with rule-based fallback.
 */
export async function generateAdaptiveFollowUps(
  ai: GoogleGenAI | null,
  context: AdaptiveContext
): Promise<AdaptiveFollowUpQuestion[]> {
  const fallback = getRuleBasedFollowUps(context);

  if (!ai || !context.chiefComplaint || context.chiefComplaint.trim().length < 4) {
    return fallback;
  }

  try {
    const systemInstruction = `You are an emergency triage physician in the Interviewer Agent role of MediAgent AI.
Given a patient's chief complaint and brief context, generate EXACTLY 1 or 2 targeted, high-yield clinical follow-up questions that an expert clinician would ask before completing intake.
For each follow-up question:
1. Question: Clear, empathetic, patient-friendly phrasing.
2. Reasoning: An explicit inline note explaining the clinical triage logic behind asking this question (e.g. "Triage Logic: Assessing for ... to rule out ... vs ...").
3. SuggestedAnswers: An array of 2 to 3 concise, realistic answers the patient could choose from.

Output strictly valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "Does the chest pain radiate anywhere...",
      "reasoning": "Triage Logic: Assessing for typical angina radiation to rule in/out Acute Coronary Syndrome.",
      "suggestedAnswers": ["Yes, radiates to left arm/jaw", "No radiation, sharp with breathing", "Constant dull ache"]
    }
  ]
}`;

    const userPrompt = `Patient Presentation Context:
- Age: ${context.age || 'Adult'}
- Gender: ${context.gender || 'Not specified'}
- Chief Complaint: "${context.chiefComplaint}"
- Symptom Description / Narrative: "${context.symptomDescription || 'None'}"
- Past Medical History: "${context.pastMedicalHistory || 'None'}"
${context.vitals ? `- Vitals: HR ${context.vitals.heartRate} bpm, BP ${context.vitals.bloodPressureSystolic}/${context.vitals.bloodPressureDiastolic}, SpO2 ${context.vitals.oxygenSaturation}%, Temp ${context.vitals.temperature}°C` : ''}

Generate 1-2 targeted follow-up triage questions with explicit triage logic reasoning notes.`;

    const rawText = await generateContentWithFallback(ai, {
      contents: [{ text: userPrompt }],
      systemInstruction,
      temperature: 0.2,
    });

    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed.questions.slice(0, 2).map((q: any, i: number) => ({
        id: q.id || `afq-${Date.now()}-${i}`,
        question: q.question,
        reasoning: q.reasoning?.startsWith('Triage Logic:') ? q.reasoning : `Triage Logic: ${q.reasoning || 'Evaluates symptom characteristics to guide clinical risk stratification.'}`,
        suggestedAnswers: Array.isArray(q.suggestedAnswers) && q.suggestedAnswers.length > 0 ? q.suggestedAnswers : fallback[i]?.suggestedAnswers || ['Yes', 'No', 'Uncertain'],
      }));
    }
    return fallback;
  } catch (err: any) {
    console.warn('[Adaptive Interviewer] Gemini generation unavailable (quota/rate-limit). Utilizing chief complaint heuristic triage questions.');
    return fallback;
  }
}
