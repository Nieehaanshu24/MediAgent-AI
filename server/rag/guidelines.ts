import { GoogleGenAI } from '@google/genai';
import type { ClinicalGuideline } from '../../src/types/clinical';

export interface GuidelineWithEmbedding extends ClinicalGuideline {
  embedding?: number[];
}

// 10 authentic evidence-based clinical triage guidelines
export const CLINICAL_GUIDELINES: Omit<GuidelineWithEmbedding, 'embedding'>[] = [
  {
    id: 'guide-bts-curb65',
    title: 'BTS Guidelines / CURB-65 Triage for Community-Acquired Pneumonia',
    source: 'British Thoracic Society (BTS) & NICE CG191',
    category: 'Respiratory / Infectious Disease',
    snippet: 'Assess pneumonia severity using CURB-65: Confusion (AMTS <= 8), Blood Urea Nitrogen > 7 mmol/L (19 mg/dL), Respiratory rate >= 30/min, Blood pressure (SBP < 90 mmHg or DBP <= 60 mmHg), Age >= 65. Score 0-1 indicates low mortality (<3%), suitable for outpatient treatment; score 2 indicates intermediate risk (9% mortality), requiring urgent hospital admission; score 3-5 indicates severe pneumonia (15-40% mortality), mandating emergency inpatient care, immediate IV broad-spectrum antibiotics within 4 hours, and consideration for intensive respiratory support if PaO2/FiO2 < 250 or bilateral infiltrates on chest imaging.',
  },
  {
    id: 'guide-nice-acs',
    title: 'NICE NG185: Acute Coronary Syndromes Triage & High-Sensitivity Troponin',
    source: 'NICE National Institute for Health and Care Excellence (NG185)',
    category: 'Cardiovascular / Emergency',
    snippet: 'For acute chest pain radiating to neck, jaw, or left arm with accompanying diaphoresis, dyspnea, or nausea: perform immediate 12-lead ECG and high-sensitivity cardiac Troponin I/T. Triage as Emergency if ST-segment elevation, hemodynamic instability (systolic BP < 90 mmHg), sustained ventricular arrhythmia, or pulmonary edema. Triage as Urgent if elevated hs-troponin above 99th percentile upper reference limit without persistent ST elevation (NSTEMI/Unstable Angina). Initiate dual antiplatelet therapy (aspirin + P2Y12 inhibitor), therapeutic anticoagulation, and continuous telemetry monitoring.',
  },
  {
    id: 'guide-ssc-sepsis3',
    title: 'Surviving Sepsis Campaign (SSC 2021) & Sepsis-3 Diagnostic Criteria',
    source: 'Surviving Sepsis Campaign International Guidelines & Sepsis-3',
    category: 'Critical Care / Infectious Disease',
    snippet: 'Identify sepsis in patients with suspected or proven infection plus acute organ dysfunction, screened via qSOFA (>=2 criteria: RR >= 22/min, altered mentation, SBP <= 100 mmHg) or SOFA score increase >= 2. Serum lactate > 2.0 mmol/L indicates cellular hypoperfusion. Septic shock requires vasopressors to maintain MAP >= 65 mmHg with lactate > 2 mmol/L despite adequate fluid resuscitation. Mandatory emergency 1-hour bundle: measure lactate and remeasure if >2, obtain blood cultures prior to antibiotics, administer broad-spectrum IV antimicrobials, and infuse 30 mL/kg balanced crystalloids for hypotension or lactate >= 4 mmol/L.',
  },
  {
    id: 'guide-nice-pe-wells',
    title: 'NICE NG158 & Wells Score for Suspected Pulmonary Embolism',
    source: 'NICE NG158 / European Society of Cardiology Guidelines on PE',
    category: 'Pulmonary / Vascular',
    snippet: 'Evaluate acute unexplained dyspnea, pleuritic chest pain, or hemoptysis using the two-level Wells PE criteria: clinical signs of DVT (3 pts), PE most likely diagnosis (3 pts), HR > 100 bpm (1.5 pts), immobilization/surgery in past 4 weeks (1.5 pts), prior DVT/PE (1.5 pts), hemoptysis (1 pt), malignancy (1 pt). A score > 4 indicates PE likely; perform immediate CT Pulmonary Angiography (CTPA) or offer therapeutic anticoagulation while awaiting imaging. A score <= 4 warrants quantitative D-dimer testing; if D-dimer is elevated (>500 ng/mL FEU), proceed to CTPA. Emergency triage if hemodynamic instability (SBP < 90 mmHg or shock index > 1.0).',
  },
  {
    id: 'guide-ada-dka',
    title: 'ADA Consensus Guidelines for Diabetic Ketoacidosis & Hyperglycemic Crises',
    source: 'American Diabetes Association (ADA) Standards of Care',
    category: 'Endocrinology / Metabolic',
    snippet: 'Diagnostic criteria for Diabetic Ketoacidosis (DKA): blood glucose > 250 mg/dL, arterial pH < 7.30 or serum bicarbonate < 18 mEq/L, and presence of serum or urine ketones with high anion gap metabolic acidosis (> 12 mEq/L). Severity: Mild (pH 7.25-7.30, HCO3 15-18), Moderate (pH 7.00-7.24, HCO3 10-14), Severe (pH < 7.00, HCO3 < 10, stupor/coma). Triage as Emergency: immediately initiate aggressive isotonic saline volume expansion (1000-1500 mL in first hour), check serum potassium (do not start insulin if K+ < 3.3 mEq/L), then infuse regular IV insulin at 0.1 units/kg/hour once potassium is replete, aiming for glucose decline of 50-75 mg/dL/hr.',
  },
  {
    id: 'guide-acr-appendicitis',
    title: 'ACR Appropriateness Criteria & Alvarado Score for Acute Appendicitis',
    source: 'American College of Radiology (ACR) & World Society of Emergency Surgery (WSES)',
    category: 'Gastroenterology / Acute Abdomen',
    snippet: 'Patients presenting with migratory abdominal pain to the right lower quadrant, localized McBurney point tenderness, low-grade fever, and leukocytosis (> 10,000/uL with left shift / neutrophilia > 75%). An Alvarado score >= 7 indicates high probability of acute appendicitis. Contrast-enhanced abdominal/pelvic CT (or ultrasound in pediatric/pregnant patients) is the gold standard imaging modality showing appendiceal diameter > 6-7 mm, wall thickening, periappendiceal fat stranding, or appendicolith. Triage as Urgent for surgical evaluation; upgrade to Emergency if signs of generalized peritonitis (involuntary rigidity, rebound tenderness, high fever, hypotension) indicating perforation.',
  },
  {
    id: 'guide-who-ards',
    title: 'WHO & Berlin Definition Criteria for Acute Respiratory Distress Syndrome (ARDS)',
    source: 'World Health Organization (WHO) & Berlin ARDS Definition Consensus',
    category: 'Pulmonary / Critical Care',
    snippet: 'ARDS onset within 1 week of known clinical insult with bilateral opacities on chest radiograph or CT not fully explained by cardiogenic fluid overload or effusions. Classified by PaO2/FiO2 ratio with PEEP >= 5 cmH2O: Mild (200 < PaO2/FiO2 <= 300), Moderate (100 < PaO2/FiO2 <= 200), Severe (PaO2/FiO2 <= 100 mmHg). Patients exhibiting severe tachypnea (>30/min), accessory muscle use, cyanosis, and SpO2 < 90% despite high-flow oxygen require immediate emergency triage, admission to intensive care, low tidal volume lung-protective mechanical ventilation (4-8 mL/kg predicted body weight), and plateau pressure target < 30 cmH2O.',
  },
  {
    id: 'guide-gold-copd',
    title: 'GOLD 2023 Guidelines: Acute Exacerbation of Chronic Obstructive Pulmonary Disease',
    source: 'Global Initiative for Chronic Obstructive Lung Disease (GOLD 2023 Report)',
    category: 'Respiratory Medicine',
    snippet: 'An acute exacerbation of COPD is characterized by increased dyspnea, increased sputum volume, and increased sputum purulence (Anthonisen Type 1). Chest radiograph rules out pneumonia or pneumothorax, typically showing hyperinflation and flattened diaphragms. Triage as Urgent or Emergency if acute respiratory acidosis (pH < 7.35, PaCO2 > 45 mmHg), oxygen saturation < 88-90% despite supplemental O2, use of accessory respiratory muscles, or severe background COPD. Treatment includes short-acting bronchodilators, systemic corticosteroids (prednisolone 40 mg daily for 5 days), targeted oxygen therapy (target SpO2 88-92%), and non-invasive positive pressure ventilation (NIV/BiPAP) for acute hypercapnic failure.',
  },
  {
    id: 'guide-esc-heartfailure',
    title: 'ESC Guidelines on Acute Decompensated Heart Failure & Pulmonary Edema',
    source: 'European Society of Cardiology (ESC) Heart Failure Guidelines',
    category: 'Cardiology / Acute Care',
    snippet: 'Acute decompensated heart failure presents with worsening orthopnea, paroxysmal nocturnal dyspnea, jugular venous distension, bibasilar lung crackles, peripheral pitting edema, and markedly elevated B-type natriuretic peptides (BNP > 400 pg/mL or NT-proBNP > 1000 pg/mL). Chest X-ray demonstrates cardiomegaly (cardiothoracic ratio > 0.5), upper zone venous redistribution, Kerley B lines, and interstitial alveolar edema. Emergency triage is mandatory for flash pulmonary edema (severe hypoxia, tachypnea, pink frothy sputum) or cardiogenic shock (SBP < 90 mmHg, cold extremities, oliguria, lactate elevation). Administer IV loop diuretics, vasodilators if hypertensive, and CPAP for acute respiratory distress.',
  },
  {
    id: 'guide-aha-stroke',
    title: 'AHA/ASA Guidelines for Early Management of Acute Ischemic Stroke',
    source: 'American Heart Association / American Stroke Association Guidelines',
    category: 'Neurology / Emergency Care',
    snippet: 'Acute focal neurological deficits identified by FAST criteria (Facial droop, Arm weakness, Speech difficulty, Time to call 911). Triage as Emergency: immediate non-contrast head CT within 20 minutes of hospital arrival to exclude intracranial hemorrhage. Screen for IV thrombolysis (alteplase or tenecteplase) within the 4.5-hour therapeutic window from last known well time (target door-to-needle time < 45 minutes). Emergent CT angiography / MR angiography to detect large vessel occlusion (LVO) eligible for endovascular mechanical thrombectomy within 6 to 24 hours. Strict blood pressure control (maintain BP < 185/110 mmHg prior to thrombolytic therapy).',
  },
];

// In-memory cache of computed embeddings
const embeddingsCache = new Map<string, number[]>();

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

/**
 * Initializes and embeds all clinical guidelines using Gemini gemini-embedding-001
 */
export async function initializeGuidelineEmbeddings(ai: GoogleGenAI): Promise<void> {
  for (const guide of CLINICAL_GUIDELINES) {
    if (!embeddingsCache.has(guide.id)) {
      try {
        const textToEmbed = `${guide.title}. Category: ${guide.category}. Criteria: ${guide.snippet}`;
        const res = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: textToEmbed,
        });
        const vector = res.embeddings?.[0]?.values;
        if (vector && vector.length > 0) {
          embeddingsCache.set(guide.id, vector);
        }
      } catch (err) {
        console.error(`Error embedding guideline ${guide.id}:`, err);
      }
    }
  }
}

/**
 * Live similarity search against clinical guidelines
 */
export async function searchClinicalGuidelines(
  ai: GoogleGenAI,
  queryText: string,
  topK = 3
): Promise<ClinicalGuideline[]> {
  // Ensure guidelines are embedded
  if (embeddingsCache.size < CLINICAL_GUIDELINES.length) {
    await initializeGuidelineEmbeddings(ai);
  }

  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: queryText,
    });
    const queryVector = res.embeddings?.[0]?.values;

    if (!queryVector || queryVector.length === 0) {
      // Fallback to text matching if embedding fails
      return fallbackKeywordSearch(queryText, topK);
    }

    const scored: (ClinicalGuideline & { similarityScore: number })[] = [];

    for (const guide of CLINICAL_GUIDELINES) {
      const guideVec = embeddingsCache.get(guide.id);
      if (guideVec) {
        const sim = cosineSimilarity(queryVector, guideVec);
        scored.push({
          ...guide,
          similarityScore: Math.round(sim * 1000) / 1000,
        });
      }
    }

    // Sort descending by cosine similarity
    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    return scored.slice(0, topK);
  } catch (err) {
    console.warn('Vector search failed, falling back to keyword similarity:', err);
    return fallbackKeywordSearch(queryText, topK);
  }
}

function fallbackKeywordSearch(query: string, topK: number): ClinicalGuideline[] {
  const queryLower = query.toLowerCase();
  const scored = CLINICAL_GUIDELINES.map((guide) => {
    let score = 0;
    const words = guide.snippet.toLowerCase().split(/\W+/);
    const titleWords = guide.title.toLowerCase().split(/\W+/);

    for (const w of words) {
      if (w.length > 3 && queryLower.includes(w)) score += 1;
    }
    for (const w of titleWords) {
      if (w.length > 3 && queryLower.includes(w)) score += 3;
    }
    return {
      ...guide,
      similarityScore: Math.min(0.95, 0.4 + score * 0.05),
    };
  });

  scored.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
  return scored.slice(0, topK);
}
