import type { PatientDemographics, ImagingStudy, LabPanelData } from '../types/clinical';

export interface ClinicalScenario {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  expectedUrgency: 'routine' | 'urgent' | 'emergency';
  patient: PatientDemographics;
  imaging: ImagingStudy;
  labs: LabPanelData;
}

// Generate realistic simulated radiographic imagery as inline SVG data URLs
function createChestXrayDataUrl(type: 'pneumonia' | 'cardiomegaly' | 'copd' | 'appendicitis'): string {
  let innerSvg = '';

  if (type === 'pneumonia') {
    // Dense alveolar consolidation in right lower lobe (anatomical right = viewer's left)
    innerSvg = `
      <!-- Thorax rib cage silhouette -->
      <path d="M 60 80 Q 200 40 340 80 Q 380 250 340 420 Q 200 460 60 420 Q 20 250 60 80 Z" fill="#111827" stroke="#374151" stroke-width="2"/>
      <!-- Clavicles -->
      <path d="M 70 90 Q 200 120 190 130" stroke="#9ca3af" stroke-width="8" fill="none" opacity="0.8"/>
      <path d="M 330 90 Q 200 120 210 130" stroke="#9ca3af" stroke-width="8" fill="none" opacity="0.8"/>
      <!-- Spine / Vertebrae -->
      <rect x="190" y="70" width="20" height="340" fill="#4b5563" opacity="0.5"/>
      <!-- Ribs -->
      ${[130, 170, 210, 250, 290, 330, 370].map((y) => `
        <path d="M 200 ${y} Q 110 ${y + 20} 70 ${y + 40}" stroke="#4b5563" stroke-width="7" fill="none" opacity="0.6"/>
        <path d="M 200 ${y} Q 290 ${y + 20} 330 ${y + 40}" stroke="#4b5563" stroke-width="7" fill="none" opacity="0.6"/>
      `).join('')}
      <!-- Left lung field (Normal clear dark) -->
      <ellipse cx="270" cy="250" rx="55" ry="110" fill="#030712" opacity="0.9"/>
      <!-- Right lung field -->
      <ellipse cx="130" cy="250" rx="55" ry="110" fill="#030712" opacity="0.9"/>
      <!-- Radiopaque Lobar Consolidation Right Lower Zone (viewer's left) -->
      <path d="M 90 280 Q 140 270 170 310 Q 180 370 110 375 Q 80 340 90 280 Z" fill="#e5e7eb" opacity="0.85" filter="blur(4px)"/>
      <path d="M 100 295 Q 135 285 160 325 Q 165 365 115 365 Z" fill="#ffffff" opacity="0.75" filter="blur(2px)"/>
      <!-- Air bronchograms lines -->
      <path d="M 125 295 L 120 345" stroke="#1f2937" stroke-width="2" opacity="0.9"/>
      <path d="M 125 315 L 140 340" stroke="#1f2937" stroke-width="1.5" opacity="0.8"/>
      <!-- Heart silhouette -->
      <path d="M 175 220 Q 200 200 220 220 Q 275 290 240 350 Q 190 360 170 320 Z" fill="#374151" opacity="0.7"/>
      <!-- Diaphragm domes -->
      <path d="M 70 390 Q 130 350 190 380" stroke="#9ca3af" stroke-width="4" fill="none" opacity="0.5"/>
      <path d="M 210 380 Q 270 340 330 380" stroke="#9ca3af" stroke-width="4" fill="none" opacity="0.9"/>
      <!-- Label overlay -->
      <text x="20" y="30" fill="#94a3b8" font-size="12" font-family="monospace">CHEST PA ERECT | RLL INFILTRATE</text>
      <text x="320" y="30" fill="#e2e8f0" font-size="16" font-weight="bold" font-family="sans-serif">R</text>
    `;
  } else if (type === 'cardiomegaly') {
    innerSvg = `
      <path d="M 60 80 Q 200 40 340 80 Q 380 250 340 420 Q 200 460 60 420 Q 20 250 60 80 Z" fill="#111827" stroke="#374151" stroke-width="2"/>
      <rect x="190" y="70" width="20" height="340" fill="#4b5563" opacity="0.5"/>
      ${[130, 170, 210, 250, 290, 330, 370].map((y) => `
        <path d="M 200 ${y} Q 110 ${y + 20} 70 ${y + 40}" stroke="#4b5563" stroke-width="7" fill="none" opacity="0.6"/>
        <path d="M 200 ${y} Q 290 ${y + 20} 330 ${y + 40}" stroke="#4b5563" stroke-width="7" fill="none" opacity="0.6"/>
      `).join('')}
      <!-- Markedly Enlarged Cardiothoracic Ratio (>0.58) -->
      <path d="M 140 210 Q 200 180 230 200 Q 310 290 280 370 Q 180 390 120 330 Z" fill="#475569" opacity="0.85" filter="blur(2px)"/>
      <!-- Cephalization of pulmonary vessels -->
      <path d="M 190 160 Q 150 140 120 150" stroke="#cbd5e1" stroke-width="3" opacity="0.5"/>
      <path d="M 210 160 Q 250 140 280 150" stroke="#cbd5e1" stroke-width="3" opacity="0.5"/>
      <text x="20" y="30" fill="#94a3b8" font-size="12" font-family="monospace">CHEST AP PORTABLE | CARDIOMEGALY CTR 0.58</text>
      <text x="320" y="30" fill="#e2e8f0" font-size="16" font-weight="bold" font-family="sans-serif">R</text>
    `;
  } else if (type === 'copd') {
    innerSvg = `
      <path d="M 50 70 Q 200 30 350 70 Q 390 250 350 440 Q 200 480 50 440 Q 10 250 50 70 Z" fill="#090d16" stroke="#374151" stroke-width="2"/>
      <rect x="190" y="60" width="20" height="360" fill="#374151" opacity="0.4"/>
      <!-- Low flattened diaphragms -->
      <path d="M 60 420 L 190 415" stroke="#9ca3af" stroke-width="4" opacity="0.8"/>
      <path d="M 210 415 L 340 420" stroke="#9ca3af" stroke-width="4" opacity="0.8"/>
      <!-- Markedly dark hyperinflated lungs -->
      <ellipse cx="120" cy="240" rx="65" ry="140" fill="#000000" opacity="0.95"/>
      <ellipse cx="280" cy="240" rx="65" ry="140" fill="#000000" opacity="0.95"/>
      <!-- Narrow vertical heart -->
      <path d="M 185 220 Q 200 200 215 220 L 220 370 L 180 370 Z" fill="#374151" opacity="0.75"/>
      <text x="20" y="30" fill="#94a3b8" font-size="12" font-family="monospace">CHEST PA | HYPERINFLATION & FLATTENED DIAPHRAGMS</text>
      <text x="320" y="30" fill="#e2e8f0" font-size="16" font-weight="bold" font-family="sans-serif">R</text>
    `;
  } else {
    // Appendicitis Ultrasound
    innerSvg = `
      <rect width="400" height="400" fill="#030712"/>
      <!-- Ultrasound sector fan -->
      <path d="M 200 40 L 40 380 A 240 240 0 0 0 360 380 Z" fill="#111827" stroke="#1f2937"/>
      <!-- Speckle background -->
      <circle cx="200" cy="220" r="100" fill="#1e293b" opacity="0.5" filter="blur(8px)"/>
      <!-- Target Sign / Dilated Appendix 9.2mm transverse -->
      <circle cx="205" cy="240" r="38" fill="#334155" stroke="#94a3b8" stroke-width="6" opacity="0.9"/>
      <circle cx="205" cy="240" r="22" fill="#020617"/>
      <!-- Appendicolith acoustic shadowing -->
      <ellipse cx="205" cy="225" rx="8" ry="5" fill="#f8fafc"/>
      <path d="M 197 232 L 190 340 L 220 340 L 213 232 Z" fill="#020617" opacity="0.85"/>
      <!-- Caliper Measurement text -->
      <text x="20" y="30" fill="#38bdf8" font-size="12" font-family="monospace">US ABDOMEN RLQ | APPENDIX DIA: 9.2 mm (NL &lt; 6.0 mm)</text>
      <text x="20" y="50" fill="#94a3b8" font-size="11" font-family="monospace">NON-COMPRESSIBLE APERISTALTIC BLIND POUCH</text>
    `;
  }

  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440" width="400" height="440">
    <rect width="400" height="440" fill="#050811"/>
    ${innerSvg}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(fullSvg)}`;
}

export const CLINICAL_SCENARIOS: ClinicalScenario[] = [
  {
    id: 'case-pneumonia-sepsis',
    name: 'Severe Community-Acquired Lobar Pneumonia with Sepsis',
    category: 'Respiratory / Infectious',
    shortDescription: '68F with 4-day worsening fever, productive cough, pleuritic chest pain, tachypnea, and right lower lobe consolidation.',
    expectedUrgency: 'emergency',
    patient: {
      age: 68,
      gender: 'female',
      chiefComplaint: 'Worsening shortness of breath, high fever, and right-sided pleuritic chest pain for 4 days.',
      symptomDuration: '4 days',
      symptomDescription: 'Patient developed fever and chills 4 days ago followed by cough productive of thick rust-colored sputum. In the past 24 hours, developed sharp right lower chest pain aggravated by deep inspiration and coughing, with progressive dyspnea at rest. Denies recent travel or COVID exposure.',
      pastMedicalHistory: 'Type 2 Diabetes Mellitus (HbA1c 7.6%), Mild Hypertension.',
      currentMedications: 'Metformin 850mg BID, Amlodipine 5mg daily.',
      allergies: 'Penicillin (developed urticarial rash in youth).',
      vitals: {
        heartRate: 118,
        bloodPressureSystolic: 102,
        bloodPressureDiastolic: 64,
        respiratoryRate: 26,
        oxygenSaturation: 93,
        temperature: 38.9,
      },
      intakeComplete: true,
      followUpQuestions: [
        {
          id: 'sc1-q1',
          question: 'Does the chest pain sharpen significantly when taking a deep breath or coughing, and what color is the sputum produced?',
          reasoning: 'Triage Logic: Pleuritic chest pain exacerbated by inspiration signals visceral-parietal pleural friction over lobar consolidation, while rust-colored sputum confirms alveolar red cell and inflammatory exudate typical of S. pneumoniae.',
          suggestedAnswers: [
            'Sharp right lower chest pain aggravated by deep breaths and coughing, with thick rust-colored sputum',
            'Non-pleuritic dull retrosternal ache with clear watery sputum',
            'No chest pain present, dry non-productive cough only',
          ],
          answer: 'Sharp right lower chest pain aggravated by deep breaths and coughing, with thick rust-colored sputum.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
        {
          id: 'sc1-q2',
          question: 'Have you felt confused, excessively drowsy, or noticed decreased urine output over the past 24 hours?',
          reasoning: 'Triage Logic: Assesses for end-organ hypoperfusion and CURB-65 / qSOFA sepsis criteria (Confusion, elevated Urea/BUN risk, systemic hypoperfusion).',
          suggestedAnswers: [
            'Alert but significantly fatigued; noticed darker and decreased urine output today',
            'Completely alert with normal urination',
            'Severe confusion and disorientation reported by family',
          ],
          answer: 'Alert but significantly fatigued; noticed darker and decreased urine output today.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
      ],
    },
    imaging: {
      modality: 'Chest X-Ray (PA/AP)',
      fileName: 'cxr_pa_right_lobar_consolidation.svg',
      imageDataUrl: createChestXrayDataUrl('pneumonia'),
      clinicalIndication: 'Rule out pneumonia, pleural effusion, or pneumothorax in febrile tachypneic patient.',
      overallImpression: 'Acute right lower lobe dense alveolar consolidation with air bronchograms, diagnostic of lobar bacterial pneumonia without effusion or pneumothorax.',
      structuredFindings: [
        {
          id: 'RF-1',
          region: 'Right Lower Hemithorax',
          observation: 'Dense alveolar consolidation with prominent air bronchograms obscuring the right hemidiaphragmatic silhouette.',
          severity: 'Severe',
        },
        {
          id: 'RF-2',
          region: 'Left Hemithorax',
          observation: 'Clear pulmonary parenchyma with normal vascular markings; no focal infiltrate or cavitation.',
          severity: 'Normal',
        },
        {
          id: 'RF-3',
          region: 'Cardiac Silhouette & Mediastinum',
          observation: 'Normal cardiothoracic ratio (< 0.50), aortic contour intact without mediastinal widening.',
          severity: 'Normal',
        },
        {
          id: 'RF-4',
          region: 'Pleural Spaces & Angles',
          observation: 'Costophrenic sulci sharp bilaterally without pleural effusion or pneumothorax.',
          severity: 'Normal',
        },
        {
          id: 'RF-5',
          region: 'Thoracic Skeleton & Soft Tissues',
          observation: 'Intact bony thorax without visible acute fracture or lytic lesion.',
          severity: 'Normal',
        },
      ],
    },
    labs: {
      markers: [
        { name: 'White Blood Cell Count (WBC)', value: 18.4, unit: '10^3/uL', referenceRange: '4.5 - 11.0', status: 'ABNORMAL_HIGH', interpretation: 'Marked leukocytosis with left shift.' },
        { name: 'Neutrophil Percentage', value: 86.2, unit: '%', referenceRange: '40.0 - 70.0', status: 'ABNORMAL_HIGH', interpretation: 'Pronounced neutrophilia indicating acute bacterial infection.' },
        { name: 'C-Reactive Protein (CRP)', value: 142, unit: 'mg/L', referenceRange: '< 5.0', status: 'CRITICAL_HIGH', interpretation: 'Severe acute phase inflammatory response.' },
        { name: 'Procalcitonin', value: 2.4, unit: 'ng/mL', referenceRange: '< 0.25', status: 'CRITICAL_HIGH', interpretation: 'Strongly supportive of bacterial sepsis / severe lower respiratory tract infection.' },
        { name: 'Serum Lactate', value: 2.4, unit: 'mmol/L', referenceRange: '0.5 - 1.6', status: 'ABNORMAL_HIGH', interpretation: 'Elevated lactate reflecting cellular hypoperfusion / systemic sepsis.' },
        { name: 'Blood Urea Nitrogen (BUN)', value: 24, unit: 'mg/dL', referenceRange: '7 - 20', status: 'ABNORMAL_HIGH', interpretation: 'Elevated urea contributing to CURB-65 pneumonia risk score.' },
        { name: 'Serum Creatinine', value: 1.3, unit: 'mg/dL', referenceRange: '0.6 - 1.1', status: 'ABNORMAL_HIGH', interpretation: 'Mild acute kidney stress.' },
        { name: 'Platelet Count', value: 215, unit: '10^3/uL', referenceRange: '150 - 450', status: 'NORMAL' },
      ],
      rawReportText: 'CBC with Differential: WBC 18.4 (High), Seg Neutrophils 86% (High), Bands 6%, Lymphocytes 6%. CRP: 142 mg/L. Procalcitonin: 2.40 ng/mL. Serum Lactate: 2.4 mmol/L. Electrolytes: Na 135, K 4.2, Cl 101, HCO3 21, BUN 24, Cr 1.3, Glucose 178 mg/dL.',
    },
  },
  {
    id: 'case-nstemi-acs',
    name: 'Acute Coronary Syndrome (NSTEMI) with Ischemic Strain',
    category: 'Cardiovascular / Emergency',
    shortDescription: '59M with 2 hours of heavy substernal chest pressure radiating to left arm and jaw, diaphoresis, and critical troponin elevation.',
    expectedUrgency: 'emergency',
    patient: {
      age: 59,
      gender: 'male',
      chiefComplaint: 'Crushing central chest tightness radiating to the jaw and left arm for 2 hours.',
      symptomDuration: '2 hours',
      symptomDescription: 'Patient was watching television when he experienced acute onset of heavy, constricting substernal chest discomfort rated 8/10. Pain radiated to the left inner arm and mandible, accompanied by cold diaphoresis and mild nausea. Sublingual antacids brought no relief.',
      pastMedicalHistory: 'Hyperlipidemia, Essential Hypertension, 25 pack-year cigarette smoking.',
      currentMedications: 'Atorvastatin 20mg daily, Lisinopril 10mg daily.',
      allergies: 'No known drug allergies.',
      vitals: {
        heartRate: 104,
        bloodPressureSystolic: 168,
        bloodPressureDiastolic: 98,
        respiratoryRate: 20,
        oxygenSaturation: 96,
        temperature: 36.8,
      },
      intakeComplete: true,
      followUpQuestions: [
        {
          id: 'sc2-q1',
          question: 'Does the chest pain radiate to your left arm, shoulder, neck, jaw, or back, and did it start during rest or physical exertion?',
          reasoning: 'Triage Logic: Substernal pressure radiating to the left arm and mandible at rest is a classic anginal equivalent with high predictive value for acute coronary occlusion (NSTEMI/STEMI).',
          suggestedAnswers: [
            'Yes, radiates to jaw and left arm, started suddenly at rest while sitting',
            'Sharp pain radiating between shoulder blades, tearing in quality',
            'Localized strictly to chest wall, reproduced by manual pressing',
          ],
          answer: 'Yes, radiates to jaw and left arm, started suddenly at rest while sitting.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
        {
          id: 'sc2-q2',
          question: 'Did you experience cold drenching sweat (diaphoresis), nausea, or shortness of breath alongside the chest tightness?',
          reasoning: 'Triage Logic: Sympathetic autonomic activation (diaphoresis, nausea) alongside chest tightness significantly elevates acute coronary syndrome probability over gastrointestinal reflux.',
          suggestedAnswers: [
            'Yes, broke into a severe cold sweat with mild nausea',
            'No sweating or nausea, only mild breathlessness',
            'No associated symptoms, chest pressure alone',
          ],
          answer: 'Yes, broke into a severe cold sweat with mild nausea.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
      ],
    },
    imaging: {
      modality: 'Chest X-Ray (PA/AP)',
      fileName: 'cxr_cardiomegaly_mild_congestion.svg',
      imageDataUrl: createChestXrayDataUrl('cardiomegaly'),
      clinicalIndication: 'Evaluate for widened mediastinum, aortic dissection, or cardiogenic pulmonary congestion.',
      overallImpression: 'Cardiomegaly with mild pulmonary vascular redistribution and cephalization, consistent with elevated left ventricular filling pressures; no focal consolidation or pneumothorax.',
      structuredFindings: [
        {
          id: 'RF-1',
          region: 'Cardiac Silhouette & Pericardium',
          observation: 'Enlarged cardiac silhouette with cardiothoracic ratio approximately 0.58; left ventricular contour rounded.',
          severity: 'Moderate',
        },
        {
          id: 'RF-2',
          region: 'Pulmonary Vasculature & Hila',
          observation: 'Mild cephalization of pulmonary vasculature and peribronchial cuffing without florid alveolar edema.',
          severity: 'Moderate',
        },
        {
          id: 'RF-3',
          region: 'Aortic Arch & Mediastinum',
          observation: 'Normal mediastinal width (< 8cm) without contour distortion or signs of acute aortic enlargement.',
          severity: 'Normal',
        },
        {
          id: 'RF-4',
          region: 'Lung Parenchyma & Pleura',
          observation: 'No focal airspace consolidation, mass, or visible pneumothorax bilaterally.',
          severity: 'Normal',
        },
      ],
    },
    labs: {
      markers: [
        { name: 'High-Sensitivity Troponin I', value: 1.65, unit: 'ng/mL', referenceRange: '< 0.04', status: 'CRITICAL_HIGH', interpretation: 'Marked myocardial injury indicative of acute non-ST elevation myocardial infarction.' },
        { name: 'CK-MB', value: 38, unit: 'ng/mL', referenceRange: '0.0 - 5.0', status: 'CRITICAL_HIGH', interpretation: 'Elevated cardiac biomarker confirming acute ischemic myocardial necrosis.' },
        { name: 'B-Type Natriuretic Peptide (BNP)', value: 420, unit: 'pg/mL', referenceRange: '< 100', status: 'ABNORMAL_HIGH', interpretation: 'Elevated ventricular wall stress.' },
        { name: 'Serum Glucose', value: 158, unit: 'mg/dL', referenceRange: '70 - 99', status: 'ABNORMAL_HIGH', interpretation: 'Stress-induced hyperglycemia.' },
        { name: 'Serum Potassium', value: 4.1, unit: 'mmol/L', referenceRange: '3.5 - 5.0', status: 'NORMAL' },
        { name: 'White Blood Cell Count', value: 11.2, unit: '10^3/uL', referenceRange: '4.5 - 11.0', status: 'ABNORMAL_HIGH', interpretation: 'Borderline reactive leukocytosis.' },
      ],
      rawReportText: 'Cardiac Panel: hs-Troponin I = 1.65 ng/mL (CRITICAL HIGH). CK-MB = 38 ng/mL. BNP = 420 pg/mL. Chemistry: Na 138, K 4.1, Cl 102, BUN 16, Cr 1.0, Glucose 158. Lipid profile: LDL 152 mg/dL.',
    },
  },
  {
    id: 'case-acute-appendicitis',
    name: 'Acute Appendicitis with Localized Peritoneal Signs',
    category: 'Gastroenterology / Acute Abdomen',
    shortDescription: '27M with 18h migratory periumbilical to right lower quadrant pain, McBurney tenderness, and ultrasound confirmed dilated appendix.',
    expectedUrgency: 'urgent',
    patient: {
      age: 27,
      gender: 'male',
      chiefComplaint: 'Severe right lower quadrant abdominal pain with anorexia and nausea for 18 hours.',
      symptomDuration: '18 hours',
      symptomDescription: 'Pain started as dull periumbilical cramping yesterday afternoon, then migrated and sharpened in the right iliac fossa overnight. Patient had two episodes of non-bilious vomiting. Any movement, coughing, or road bumps during transport exacerbated the pain.',
      pastMedicalHistory: 'None. Healthy young adult.',
      currentMedications: 'None.',
      allergies: 'NKDA.',
      vitals: {
        heartRate: 98,
        bloodPressureSystolic: 124,
        bloodPressureDiastolic: 78,
        respiratoryRate: 18,
        oxygenSaturation: 99,
        temperature: 38.1,
      },
      intakeComplete: true,
      followUpQuestions: [
        {
          id: 'sc3-q1',
          question: 'Did your pain begin around your navel (periumbilical) before migrating to the lower right side, and does coughing or walking make it sharper?',
          reasoning: 'Triage Logic: Migration from periumbilical visceral pain to localized RLQ somatic pain (McBurney point) has high specificity for acute appendicitis; aggravation with coughing signals localized peritonitis.',
          suggestedAnswers: [
            'Yes, started around belly button yesterday afternoon, now sharp in lower right abdomen and hurts with every step',
            'Pain stayed entirely diffuse across the entire stomach',
            'Pain started in the right flank and radiates downward to groin',
          ],
          answer: 'Yes, started around belly button yesterday afternoon, now sharp in lower right abdomen and hurts with every step.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
        {
          id: 'sc3-q2',
          question: 'Have you experienced complete loss of appetite (anorexia) or nausea and vomiting, and did the pain start before the vomiting?',
          reasoning: 'Triage Logic: Pain preceding vomiting with profound anorexia is characteristic of acute surgical appendicitis; vomiting preceding pain is more indicative of gastroenteritis.',
          suggestedAnswers: [
            'Complete loss of appetite, pain started first, followed by two episodes of vomiting',
            'Nausea only, no vomiting, still hungry',
            'Vomiting started before any abdominal pain',
          ],
          answer: 'Complete loss of appetite, pain started first, followed by two episodes of vomiting.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
      ],
    },
    imaging: {
      modality: 'Ultrasound',
      fileName: 'us_rlq_appendix_dilated.svg',
      imageDataUrl: createChestXrayDataUrl('appendicitis'),
      clinicalIndication: 'Graded compression ultrasound to assess appendix and exclude other acute abdominal etiologies.',
      overallImpression: 'Aperistaltic, non-compressible blind-ended tubular structure in RLQ measuring 9.2 mm in diameter with target sign and appendicolith, sonographically diagnostic of acute appendicitis without free fluid or abscess.',
      structuredFindings: [
        {
          id: 'RF-1',
          region: 'Right Lower Quadrant / Appendix',
          observation: 'Dilated blind-ended tubular structure measuring 9.2 mm in outer diameter with non-compressibility and mural hyperemia.',
          severity: 'Severe',
        },
        {
          id: 'RF-2',
          region: 'Appendiceal Lumen & Appendicolith',
          observation: 'Intraluminal obstructing hyperechoic appendicolith (fecalith) with posterior acoustic shadowing.',
          severity: 'Moderate',
        },
        {
          id: 'RF-3',
          region: 'Periappendiceal Fat & Mesentery',
          observation: 'Prominent echogenic periappendiceal fat stranding consistent with acute localized inflammatory changes.',
          severity: 'Moderate',
        },
        {
          id: 'RF-4',
          region: 'Pelvic Free Fluid / Peritoneal Cavity',
          observation: 'No organized fluid collections, abscess formation, or secondary loculated ascites in the pelvis or Morrison pouch.',
          severity: 'Normal',
        },
      ],
    },
    labs: {
      markers: [
        { name: 'White Blood Cell Count (WBC)', value: 15.2, unit: '10^3/uL', referenceRange: '4.5 - 11.0', status: 'ABNORMAL_HIGH', interpretation: 'Leukocytosis with acute surgical abdomen.' },
        { name: 'Neutrophil Percentage', value: 84.0, unit: '%', referenceRange: '40.0 - 70.0', status: 'ABNORMAL_HIGH', interpretation: 'Marked left shift characteristic of acute suppurative appendicitis.' },
        { name: 'C-Reactive Protein (CRP)', value: 48, unit: 'mg/L', referenceRange: '< 5.0', status: 'ABNORMAL_HIGH', interpretation: 'Elevated inflammatory acute phase reactant.' },
        { name: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'NORMAL' },
        { name: 'Urinalysis (RBC/WBC)', value: '0-2', unit: 'HPF', referenceRange: '< 3', status: 'NORMAL', interpretation: 'Unremarkable urine sediment; rules out nephrolithiasis / urinary tract infection.' },
      ],
      rawReportText: 'CBC: WBC 15.2 x 10^3/uL (84% Neutrophils, 11% Lymphocytes). CRP: 48 mg/L. Basic Metabolic Panel normal. Urinalysis: Yellow, clear, protein neg, glucose neg, WBC 1-2/hpf, RBC 0-1/hpf, nitrites negative.',
    },
  },
  {
    id: 'case-copd-exacerbation',
    name: 'Acute Exacerbation of COPD with Respiratory Acidosis',
    category: 'Pulmonary / Chronic Disease',
    shortDescription: '66M with 3-day worsening dyspnea, increased purulent sputum, hyperinflated lungs, and acute respiratory acidosis.',
    expectedUrgency: 'urgent',
    patient: {
      age: 66,
      gender: 'male',
      chiefComplaint: 'Severe breathlessness and inability to catch breath with greenish sputum for 3 days.',
      symptomDuration: '3 days',
      symptomDescription: 'Known COPD patient on maintenance inhalers. In the past 72 hours, experienced marked decline in exercise tolerance, waking up multiple times gasping. Sputum has become copious and dark green. Auditory wheezing present bilaterally.',
      pastMedicalHistory: 'COPD (GOLD Stage III), 35 pack-year smoking history (quit 2 years ago), Osteoarthritis.',
      currentMedications: 'Tiotropium inhaler daily, Salbutamol PRN, Formoterol/Budesonide BID.',
      allergies: 'Sulfa antibiotics (rash).',
      vitals: {
        heartRate: 112,
        bloodPressureSystolic: 142,
        bloodPressureDiastolic: 86,
        respiratoryRate: 28,
        oxygenSaturation: 87,
        temperature: 37.7,
      },
      intakeComplete: true,
      followUpQuestions: [
        {
          id: 'sc4-q1',
          question: 'How markedly has your breathlessness increased compared to your usual baseline, and have you noticed an increase in sputum thickness or change to dark green?',
          reasoning: 'Triage Logic: Assesses the Anthonisen Type 1 criteria (worsening dyspnea, increased sputum volume, sputum purulence) to confirm a severe infectious exacerbation warranting hospital admission and targeted antibiotics.',
          suggestedAnswers: [
            'Severe deterioration from baseline, gasping at rest, with copious dark green sputum',
            'Mild increase in breathlessness, sputum is thin and whitish',
            'Shortness of breath is unchanged from chronic baseline',
          ],
          answer: 'Severe deterioration from baseline, gasping at rest, with copious dark green sputum.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
        {
          id: 'sc4-q2',
          question: 'How often are you needing your rescue inhaler, and have you felt abnormally drowsy, confused, or had a morning headache?',
          reasoning: 'Triage Logic: High-frequency rescue beta-agonist use indicates severe bronchospasm refractory to outpatient therapy; morning headache or daytime hypersomnolence indicates worsening hypercapnia (CO2 narcosis).',
          suggestedAnswers: [
            'Using rescue inhaler every 1-2 hours without lasting relief; feeling sluggish and drowsy',
            'Rescue inhaler used 2-3 times per day with good relief',
            'No morning headaches or drowsiness',
          ],
          answer: 'Using rescue inhaler every 1-2 hours without lasting relief; feeling sluggish and drowsy.',
          answeredAt: '2026-09-14T05:00:00.000Z',
        },
      ],
    },
    imaging: {
      modality: 'Chest X-Ray (PA/AP)',
      fileName: 'cxr_copd_hyperinflation.svg',
      imageDataUrl: createChestXrayDataUrl('copd'),
      clinicalIndication: 'Rule out pneumonia, pneumothorax, or acute pulmonary edema complicating COPD exacerbation.',
      overallImpression: 'Bilateral severe pulmonary hyperinflation with flattened hemidiaphragms, widened intercostal spaces, and increased retrosternal airspace consistent with emphysema; no focal pneumonia or pneumothorax.',
      structuredFindings: [
        {
          id: 'RF-1',
          region: 'Diaphragms & Lung Volumes',
          observation: 'Markedly depressed, flattened hemidiaphragms with visualization of 11 posterior ribs bilaterally, reflecting severe hyperinflation.',
          severity: 'Moderate',
        },
        {
          id: 'RF-2',
          region: 'Bronchovascular Markings & Airway',
          observation: 'Prominent bronchovascular markings throughout lower lobes consistent with chronic bronchitis / small airway inflammatory changes.',
          severity: 'Moderate',
        },
        {
          id: 'RF-3',
          region: 'Parenchymal Infiltrates',
          observation: 'No focal lobar consolidation, cavitary lesion, or overt dense infiltrate to suggest acute lobar bacterial pneumonia.',
          severity: 'Normal',
        },
        {
          id: 'RF-4',
          region: 'Pleural Margins & Mediastinum',
          observation: 'Pleural spaces clear; no visible apical visceral pleural line or pneumothorax.',
          severity: 'Normal',
        },
      ],
    },
    labs: {
      markers: [
        { name: 'Arterial Blood Gas pH', value: 7.31, unit: 'pH', referenceRange: '7.35 - 7.45', status: 'ABNORMAL_LOW', interpretation: 'Acute respiratory acidosis.' },
        { name: 'Arterial PaCO2', value: 56, unit: 'mmHg', referenceRange: '35 - 45', status: 'ABNORMAL_HIGH', interpretation: 'Alveolar hypoventilation and carbon dioxide retention.' },
        { name: 'Arterial PaO2', value: 58, unit: 'mmHg', referenceRange: '80 - 100', status: 'CRITICAL_LOW', interpretation: 'Moderate to severe arterial hypoxemia.' },
        { name: 'Serum Bicarbonate (HCO3)', value: 28, unit: 'mEq/L', referenceRange: '22 - 26', status: 'ABNORMAL_HIGH', interpretation: 'Partial renal compensation for chronic hypercapnia.' },
        { name: 'White Blood Cell Count', value: 12.8, unit: '10^3/uL', referenceRange: '4.5 - 11.0', status: 'ABNORMAL_HIGH', interpretation: 'Mild leukocytosis consistent with infectious tracheobronchitis.' },
        { name: 'Hemoglobin', value: 16.4, unit: 'g/dL', referenceRange: '13.5 - 17.5', status: 'NORMAL', interpretation: 'High-normal secondary to chronic hypoxic drive.' },
      ],
      rawReportText: 'Arterial Blood Gas (on room air): pH 7.31, PaCO2 56 mmHg, PaO2 58 mmHg, HCO3 28 mEq/L, SaO2 87.5%. CBC: WBC 12.8, Hgb 16.4, Plt 260. Chemistry: Na 139, K 4.4, Cl 98, CO2 29, BUN 18, Cr 1.1.',
    },
  },
];
