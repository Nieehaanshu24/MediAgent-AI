import type { LabMarker } from '../types/clinical';

export interface LabReferenceEntry {
  canonicalName: string;
  aliases: string[];
  unit: string;
  min: number;
  max: number;
  criticalLow?: number;
  criticalHigh?: number;
  highInterpretation: (val: number, unit: string) => string;
  lowInterpretation: (val: number, unit: string) => string;
  criticalHighInterpretation?: (val: number, unit: string) => string;
  criticalLowInterpretation?: (val: number, unit: string) => string;
}

export const LAB_REFERENCE_DATABASE: LabReferenceEntry[] = [
  {
    canonicalName: 'White Blood Cell Count (WBC)',
    aliases: ['wbc', 'white blood cell', 'white blood count', 'leukocyte', 'leukocytes', 'total wbc'],
    unit: '10^3/uL',
    min: 4.5,
    max: 11.0,
    criticalLow: 2.0,
    criticalHigh: 20.0,
    highInterpretation: (val) => `elevated WBC (${val}) — consistent with possible acute bacterial infection, systemic inflammation, or stress response`,
    lowInterpretation: (val) => `decreased WBC (${val}) — leukopenia, possible viral etiology, bone marrow suppression, or severe sepsis`,
    criticalHighInterpretation: (val) => `critically elevated WBC (${val}) — severe leukocytosis / leukemoid reaction, urgent sepsis or hematologic evaluation warranted`,
    criticalLowInterpretation: (val) => `critically low WBC (${val}) — severe leukopenia / neutropenia, high risk of opportunistic infection`,
  },
  {
    canonicalName: 'Neutrophil Percentage',
    aliases: ['neutrophils', 'neutrophil %', 'neutrophil percentage', 'segs', 'segmented neutrophils', 'anc %'],
    unit: '%',
    min: 40.0,
    max: 70.0,
    criticalHigh: 85.0,
    highInterpretation: (val) => `elevated Neutrophils (${val}%) — neutrophilia with left shift, consistent with acute bacterial infection or tissue necrosis`,
    lowInterpretation: (val) => `decreased Neutrophils (${val}%) — neutropenia, risk for impaired bacterial defense or viral suppression`,
  },
  {
    canonicalName: 'C-Reactive Protein (CRP)',
    aliases: ['crp', 'c reactive protein', 'hs-crp', 'c-reactive protein (crp)'],
    unit: 'mg/L',
    min: 0,
    max: 5.0,
    criticalHigh: 100.0,
    highInterpretation: (val) => `elevated CRP (${val} mg/L) — active systemic inflammatory response, infection, or tissue injury`,
    lowInterpretation: () => 'normal baseline CRP — absence of marked acute systemic inflammation',
    criticalHighInterpretation: (val) => `markedly elevated CRP (${val} mg/L) — indicates severe acute-phase inflammatory process or invasive infection`,
  },
  {
    canonicalName: 'Procalcitonin',
    aliases: ['pct', 'procalcitonin'],
    unit: 'ng/mL',
    min: 0,
    max: 0.25,
    criticalHigh: 2.0,
    highInterpretation: (val) => `elevated Procalcitonin (${val} ng/mL) — supportive of systemic bacterial infection vs viral illness`,
    lowInterpretation: () => 'normal Procalcitonin — bacterial sepsis unlikely',
    criticalHighInterpretation: (val) => `critically elevated Procalcitonin (${val} ng/mL) — high probability of severe bacterial sepsis / septic shock`,
  },
  {
    canonicalName: 'Serum Lactate',
    aliases: ['lactate', 'lactic acid', 'plasma lactate'],
    unit: 'mmol/L',
    min: 0.5,
    max: 1.6,
    criticalHigh: 4.0,
    highInterpretation: (val) => `elevated Lactate (${val} mmol/L) — signs of cellular hypoperfusion, anaerobic metabolism, or metabolic stress`,
    lowInterpretation: () => 'normal Lactate — adequate microvascular tissue oxygenation',
    criticalHighInterpretation: (val) => `critical hyperlactatemia (${val} mmol/L) — severe tissue hypoperfusion, high mortality risk in sepsis or shock`,
  },
  {
    canonicalName: 'Troponin I / T',
    aliases: ['troponin', 'troponin i', 'troponin t', 'hs-troponin', 'high sensitivity troponin'],
    unit: 'ng/mL',
    min: 0.0,
    max: 0.04,
    criticalHigh: 0.50,
    highInterpretation: (val) => `elevated Troponin (${val} ng/mL) — acute myocardial necrosis, consistent with acute coronary syndrome or myocardial strain`,
    lowInterpretation: () => 'undetectable / normal Troponin — acute myocardial necrosis less likely',
    criticalHighInterpretation: (val) => `critically elevated Troponin (${val} ng/mL) — substantial acute myocardial infarction / cardiomyocyte necrosis`,
  },
  {
    canonicalName: 'NT-proBNP / BNP',
    aliases: ['bnp', 'nt-probnp', 'pro-bnp', 'brain natriuretic peptide'],
    unit: 'pg/mL',
    min: 0,
    max: 300,
    criticalHigh: 1800,
    highInterpretation: (val) => `elevated NT-proBNP (${val} pg/mL) — ventricular stretch, consistent with acute decompensated heart failure or volume overload`,
    lowInterpretation: () => 'normal BNP — heart failure exacerbation unlikely',
    criticalHighInterpretation: (val) => `markedly elevated NT-proBNP (${val} pg/mL) — severe hemodynamic congestion and ventricular wall tension`,
  },
  {
    canonicalName: 'D-Dimer',
    aliases: ['d-dimer', 'ddimer', 'd dimer'],
    unit: 'ng/mL',
    min: 0,
    max: 500,
    criticalHigh: 2000,
    highInterpretation: (val) => `elevated D-Dimer (${val} ng/mL) — active fibrin degradation, consistent with possible pulmonary embolism, DVT, or DIC`,
    lowInterpretation: () => 'normal D-Dimer — high negative predictive value for venous thromboembolism',
    criticalHighInterpretation: (val) => `markedly elevated D-Dimer (${val} ng/mL) — extensive intravascular coagulation / high thromboembolic burden`,
  },
  {
    canonicalName: 'Serum Creatinine',
    aliases: ['creatinine', 'cr', 'serum cr', 's-cr'],
    unit: 'mg/dL',
    min: 0.6,
    max: 1.2,
    criticalHigh: 3.0,
    highInterpretation: (val) => `elevated Creatinine (${val} mg/dL) — decreased glomerular filtration, consistent with acute kidney injury (AKI) or renal impairment`,
    lowInterpretation: (val) => `low Creatinine (${val} mg/dL) — low muscle mass, hyperfiltration, or advanced liver disease`,
    criticalHighInterpretation: (val) => `critically elevated Creatinine (${val} mg/dL) — severe acute renal failure, urgent nephrologic review required`,
  },
  {
    canonicalName: 'Blood Urea Nitrogen (BUN)',
    aliases: ['bun', 'urea', 'blood urea nitrogen'],
    unit: 'mg/dL',
    min: 7,
    max: 20,
    criticalHigh: 60,
    highInterpretation: (val) => `elevated BUN (${val} mg/dL) — consistent with pre-renal azotemia, dehydration, increased catabolism, or upper GI bleed`,
    lowInterpretation: (val) => `low BUN (${val} mg/dL) — malnutrition, severe hepatic dysfunction, or overhydration`,
    criticalHighInterpretation: (val) => `critically elevated BUN (${val} mg/dL) — severe uremic risk, renal decompensation`,
  },
  {
    canonicalName: 'Potassium (K+)',
    aliases: ['potassium', 'k', 'k+', 'serum potassium'],
    unit: 'mmol/L',
    min: 3.5,
    max: 5.0,
    criticalLow: 2.8,
    criticalHigh: 6.0,
    highInterpretation: (val) => `elevated Potassium (${val} mmol/L) — hyperkalemia, risk of cardiac conduction abnormalities`,
    lowInterpretation: (val) => `low Potassium (${val} mmol/L) — hypokalemia, risk of cardiac ectopy, muscle weakness, and ileus`,
    criticalHighInterpretation: (val) => `CRITICAL Hyperkalemia (${val} mmol/L) — life-threatening risk of fatal ventricular arrhythmias / sine-wave ECG`,
    criticalLowInterpretation: (val) => `CRITICAL Hypokalemia (${val} mmol/L) — severe risk of polymorphic ventricular tachycardia (TdP) and paralysis`,
  },
  {
    canonicalName: 'Sodium (Na+)',
    aliases: ['sodium', 'na', 'na+', 'serum sodium'],
    unit: 'mmol/L',
    min: 135,
    max: 145,
    criticalLow: 120,
    criticalHigh: 160,
    highInterpretation: (val) => `elevated Sodium (${val} mmol/L) — hypernatremia, indicates unreplaced water deficit or dehydration`,
    lowInterpretation: (val) => `low Sodium (${val} mmol/L) — hyponatremia, risk of cerebral edema, osmotic shifts, or SIADH/diuretic effect`,
    criticalHighInterpretation: (val) => `critical Hypernatremia (${val} mmol/L) — severe hyperosmolality, altered mental status risk`,
    criticalLowInterpretation: (val) => `critical Hyponatremia (${val} mmol/L) — severe neuroglycopenic/seizure threshold risk, requires cautious correction`,
  },
  {
    canonicalName: 'Bicarbonate (HCO3-)',
    aliases: ['bicarbonate', 'hco3', 'co2', 'total co2', 'serum bicarbonate'],
    unit: 'mmol/L',
    min: 22,
    max: 29,
    criticalLow: 15,
    criticalHigh: 40,
    highInterpretation: (val) => `elevated Bicarbonate (${val} mmol/L) — metabolic alkalosis or renal compensation for chronic respiratory acidosis`,
    lowInterpretation: (val) => `low Bicarbonate (${val} mmol/L) — metabolic acidosis (anion gap or non-gap) or respiratory alkalosis compensation`,
    criticalLowInterpretation: (val) => `critically low Bicarbonate (${val} mmol/L) — profound metabolic acidosis, risk of hemodynamic collapse`,
  },
  {
    canonicalName: 'Hemoglobin',
    aliases: ['hemoglobin', 'hgb', 'hb'],
    unit: 'g/dL',
    min: 12.0,
    max: 17.5,
    criticalLow: 7.0,
    criticalHigh: 20.0,
    highInterpretation: (val) => `elevated Hemoglobin (${val} g/dL) — hemoconcentration, chronic hypoxia, or polycythemia vera`,
    lowInterpretation: (val) => `decreased Hemoglobin (${val} g/dL) — anemia, consistent with blood loss, hemolysis, or impaired marrow erythropoiesis`,
    criticalLowInterpretation: (val) => `critically low Hemoglobin (${val} g/dL) — severe symptomatic anemia, transfusion threshold reached`,
  },
  {
    canonicalName: 'Platelet Count',
    aliases: ['platelets', 'platelet', 'plt', 'platelet count'],
    unit: '10^3/uL',
    min: 150,
    max: 450,
    criticalLow: 50,
    criticalHigh: 1000,
    highInterpretation: (val) => `elevated Platelets (${val}) — thrombocytosis, reactive acute phase reactant or myeloproliferative state`,
    lowInterpretation: (val) => `low Platelets (${val}) — thrombocytopenia, risk of bleeding or consumptive coagulopathy (sepsis/DIC)`,
    criticalLowInterpretation: (val) => `critically low Platelets (${val}) — severe thrombocytopenia, spontaneous bleeding hazard`,
  },
  {
    canonicalName: 'Serum Glucose',
    aliases: ['glucose', 'blood glucose', 'glu', 'blood sugar'],
    unit: 'mg/dL',
    min: 70,
    max: 140,
    criticalLow: 50,
    criticalHigh: 350,
    highInterpretation: (val) => `elevated Glucose (${val} mg/dL) — hyperglycemia, acute physiologic stress response or decompensated diabetes`,
    lowInterpretation: (val) => `low Glucose (${val} mg/dL) — hypoglycemia, neuroglycopenia risk, urgent carbohydrate administration indicated`,
    criticalHighInterpretation: (val) => `critically high Glucose (${val} mg/dL) — marked hyperglycemia, evaluate for DKA or HHS`,
    criticalLowInterpretation: (val) => `critically low Glucose (${val} mg/dL) — severe neuroglycopenia / seizure risk`,
  },
  {
    canonicalName: 'Arterial pH',
    aliases: ['ph', 'blood ph', 'abg ph', 'arterial ph'],
    unit: '',
    min: 7.35,
    max: 7.45,
    criticalLow: 7.20,
    criticalHigh: 7.60,
    highInterpretation: (val) => `alkalemia (pH ${val}) — respiratory or metabolic alkalosis`,
    lowInterpretation: (val) => `acidemia (pH ${val}) — significant acid-base disturbance, metabolic or respiratory acidosis`,
    criticalLowInterpretation: (val) => `severe acidemia (pH ${val}) — dangerous myocardial depression and vasodilation`,
  },
  {
    canonicalName: 'PaO2',
    aliases: ['pao2', 'po2', 'arterial po2', 'abg po2'],
    unit: 'mmHg',
    min: 80,
    max: 100,
    criticalLow: 60,
    highInterpretation: (val) => `hyperoxia (PaO2 ${val} mmHg) — supranormal supplemental oxygenation`,
    lowInterpretation: (val) => `hypoxemia (PaO2 ${val} mmHg) — impaired gas exchange, ventilation/perfusion mismatch or shunt`,
    criticalLowInterpretation: (val) => `severe hypoxemia (PaO2 ${val} mmHg) — acute respiratory failure, critical hypoxia hazard`,
  },
  {
    canonicalName: 'Alanine Aminotransferase (ALT)',
    aliases: ['alt', 'sgpt', 'alanine transaminase'],
    unit: 'U/L',
    min: 7,
    max: 56,
    criticalHigh: 500,
    highInterpretation: (val) => `elevated ALT (${val} U/L) — acute hepatocellular injury, hepatitis, or hepatic congestion`,
    lowInterpretation: () => 'normal ALT — no acute hepatocellular necrosis',
    criticalHighInterpretation: (val) => `marked ALT surge (${val} U/L) — severe acute hepatocellular necrosis (ischemic, viral, or toxic)`,
  },
  {
    canonicalName: 'Aspartate Aminotransferase (AST)',
    aliases: ['ast', 'sgot', 'aspartate transaminase'],
    unit: 'U/L',
    min: 10,
    max: 40,
    criticalHigh: 500,
    highInterpretation: (val) => `elevated AST (${val} U/L) — hepatocellular injury, cardiac, or skeletal muscle damage`,
    lowInterpretation: () => 'normal AST',
    criticalHighInterpretation: (val) => `severe AST elevation (${val} U/L) — profound acute liver or muscle necrosis`,
  },
  {
    canonicalName: 'Total Bilirubin',
    aliases: ['bilirubin', 'total bilirubin', 't-bili'],
    unit: 'mg/dL',
    min: 0.2,
    max: 1.2,
    criticalHigh: 5.0,
    highInterpretation: (val) => `elevated Bilirubin (${val} mg/dL) — hyperbilirubinemia, indicates biliary obstruction, hepatic dysfunction, or hemolysis`,
    lowInterpretation: () => 'normal Bilirubin',
  },
  {
    canonicalName: 'Alkaline Phosphatase (ALP)',
    aliases: ['alp', 'alk phos', 'alkaline phosphatase'],
    unit: 'U/L',
    min: 44,
    max: 147,
    highInterpretation: (val) => `elevated ALP (${val} U/L) — cholestatic hepatobiliary injury or high bone turnover`,
    lowInterpretation: () => 'normal ALP',
  },
  {
    canonicalName: 'Serum Lipase',
    aliases: ['lipase', 'serum lipase'],
    unit: 'U/L',
    min: 10,
    max: 140,
    criticalHigh: 400,
    highInterpretation: (val) => `elevated Lipase (${val} U/L) — acute pancreatic inflammation or peripancreatic injury`,
    lowInterpretation: () => 'normal Lipase — acute pancreatitis unlikely',
    criticalHighInterpretation: (val) => `marked Lipase elevation (${val} U/L) — diagnostic of acute pancreatitis (> 3x upper limit of normal)`,
  },
];

/**
 * Match an analyte by name or alias against the reference database
 */
export function findReferenceEntry(name: string): LabReferenceEntry | undefined {
  const clean = name.toLowerCase().trim();
  return LAB_REFERENCE_DATABASE.find((entry) => {
    if (entry.canonicalName.toLowerCase() === clean) return true;
    return entry.aliases.some((alias) => clean === alias || clean.includes(alias) || alias.includes(clean));
  });
}

/**
 * Evaluate an individual lab marker against reference ranges and return flagged status + one-line interpretation
 */
export function evaluateLabMarker(marker: LabMarker): LabMarker {
  const numericVal = typeof marker.value === 'number' ? marker.value : parseFloat(String(marker.value).replace(/[^0-9.-]/g, ''));

  if (isNaN(numericVal)) {
    return {
      ...marker,
      status: marker.status || 'NORMAL',
      interpretation: marker.interpretation || 'Qualitative result recorded.',
    };
  }

  const ref = findReferenceEntry(marker.name);
  if (!ref) {
    // If not in database, attempt to parse the marker's own referenceRange string if provided (e.g. "4.5 - 11.0" or "< 5.0")
    return evaluateCustomRangeMarker(marker, numericVal);
  }

  const unit = marker.unit || ref.unit;
  const referenceRange = marker.referenceRange && marker.referenceRange !== 'Standard' ? marker.referenceRange : `${ref.min} - ${ref.max}`;

  // Check critical thresholds first
  if (ref.criticalHigh !== undefined && numericVal >= ref.criticalHigh) {
    return {
      ...marker,
      unit,
      referenceRange,
      status: 'CRITICAL_HIGH',
      interpretation: ref.criticalHighInterpretation ? ref.criticalHighInterpretation(numericVal, unit) : ref.highInterpretation(numericVal, unit),
    };
  }

  if (ref.criticalLow !== undefined && numericVal <= ref.criticalLow) {
    return {
      ...marker,
      unit,
      referenceRange,
      status: 'CRITICAL_LOW',
      interpretation: ref.criticalLowInterpretation ? ref.criticalLowInterpretation(numericVal, unit) : ref.lowInterpretation(numericVal, unit),
    };
  }

  // Check standard out-of-range
  if (numericVal > ref.max) {
    return {
      ...marker,
      unit,
      referenceRange,
      status: 'ABNORMAL_HIGH',
      interpretation: ref.highInterpretation(numericVal, unit),
    };
  }

  if (numericVal < ref.min) {
    return {
      ...marker,
      unit,
      referenceRange,
      status: 'ABNORMAL_LOW',
      interpretation: ref.lowInterpretation(numericVal, unit),
    };
  }

  // Value is normal
  return {
    ...marker,
    unit,
    referenceRange,
    status: 'NORMAL',
    interpretation: `Within normal clinical reference interval (${referenceRange} ${unit}).`,
  };
}

/**
 * Helper to parse custom range strings like "4.5 - 11.0", "< 5.0", "> 50"
 */
function evaluateCustomRangeMarker(marker: LabMarker, val: number): LabMarker {
  const rangeStr = (marker.referenceRange || '').trim();
  const unit = marker.unit || '';

  // Case 1: "< X"
  const lessThanMatch = rangeStr.match(/<\s*([0-9.]+)/);
  if (lessThanMatch) {
    const max = parseFloat(lessThanMatch[1]);
    if (!isNaN(max)) {
      if (val > max) {
        return {
          ...marker,
          status: 'ABNORMAL_HIGH',
          interpretation: `elevated ${marker.name} (${val} ${unit}) — above reference threshold (< ${max})`,
        };
      }
      return {
        ...marker,
        status: 'NORMAL',
        interpretation: `Within normal reference threshold (< ${max} ${unit}).`,
      };
    }
  }

  // Case 2: "> X"
  const greaterThanMatch = rangeStr.match(/>\s*([0-9.]+)/);
  if (greaterThanMatch) {
    const min = parseFloat(greaterThanMatch[1]);
    if (!isNaN(min)) {
      if (val < min) {
        return {
          ...marker,
          status: 'ABNORMAL_LOW',
          interpretation: `low ${marker.name} (${val} ${unit}) — below reference threshold (> ${min})`,
        };
      }
      return {
        ...marker,
        status: 'NORMAL',
        interpretation: `Within normal reference threshold (> ${min} ${unit}).`,
      };
    }
  }

  // Case 3: "min - max"
  const rangeMatch = rangeStr.match(/([0-9.]+)\s*[-–—]\s*([0-9.]+)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      if (val > max) {
        return {
          ...marker,
          status: 'ABNORMAL_HIGH',
          interpretation: `elevated ${marker.name} (${val} ${unit}) — above reference interval (${min} - ${max})`,
        };
      }
      if (val < min) {
        return {
          ...marker,
          status: 'ABNORMAL_LOW',
          interpretation: `low ${marker.name} (${val} ${unit}) — below reference interval (${min} - ${max})`,
        };
      }
      return {
        ...marker,
        status: 'NORMAL',
        interpretation: `Within normal reference interval (${min} - ${max} ${unit}).`,
      };
    }
  }

  // Fallback if no parseable range
  return {
    ...marker,
    status: marker.status || 'NORMAL',
    interpretation: marker.interpretation || `Recorded as ${val} ${unit}.`,
  };
}

/**
 * Check if a marker status is considered flagged (out-of-range)
 */
export function isMarkerFlagged(status: LabMarker['status']): boolean {
  return status === 'ABNORMAL_HIGH' || status === 'ABNORMAL_LOW' || status === 'CRITICAL_HIGH' || status === 'CRITICAL_LOW';
}

/**
 * Split a list of markers into flagged and normal categories
 */
export function partitionLabMarkers(markers: LabMarker[]) {
  const evaluated = markers.map(evaluateLabMarker);
  const flagged = evaluated.filter((m) => isMarkerFlagged(m.status));
  const normal = evaluated.filter((m) => !isMarkerFlagged(m.status));
  return { evaluated, flagged, normal };
}
