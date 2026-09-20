import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ExtractedLabMarker {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
}

export interface ExtractedLabResult {
  success: boolean;
  rawText: string;
  markers: ExtractedLabMarker[];
  count: number;
  engine: string;
}

const ANALYTE_FALLBACK_PATTERNS = [
  { regex: /(?:white blood cell|wbc count|wbc)\b/i, name: 'White Blood Cell Count (WBC)', unit: '10^3/uL', ref: '4.5 - 11.0' },
  { regex: /(?:neutrophils?|neutrophil percentage|neut%)\b/i, name: 'Neutrophil Percentage', unit: '%', ref: '40 - 70' },
  { regex: /(?:c-reactive protein|crp)\b/i, name: 'C-Reactive Protein (CRP)', unit: 'mg/L', ref: '0.0 - 5.0' },
  { regex: /(?:procalcitonin|pct)\b/i, name: 'Procalcitonin', unit: 'ng/mL', ref: '0.0 - 0.25' },
  { regex: /(?:serum lactate|lactate)\b/i, name: 'Serum Lactate', unit: 'mmol/L', ref: '0.5 - 1.6' },
  { regex: /(?:troponin[- ]?[it]|hs-troponin|c?tn[it])\b/i, name: 'Troponin I / T', unit: 'ng/mL', ref: '< 0.04' },
  { regex: /(?:nt-probnp|bnp)\b/i, name: 'NT-proBNP / BNP', unit: 'pg/mL', ref: '< 300' },
  { regex: /(?:d-dimer|ddimer)\b/i, name: 'D-Dimer', unit: 'ng/mL', ref: '< 500' },
  { regex: /(?:serum creatinine|creatinine|creat)\b/i, name: 'Serum Creatinine', unit: 'mg/dL', ref: '0.6 - 1.2' },
  { regex: /(?:blood urea nitrogen|bun|urea)\b/i, name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', ref: '7 - 20' },
  { regex: /(?:potassium|k\+)\b/i, name: 'Potassium (K+)', unit: 'mmol/L', ref: '3.5 - 5.0' },
  { regex: /(?:sodium|na\+)\b/i, name: 'Sodium (Na+)', unit: 'mmol/L', ref: '135 - 145' },
  { regex: /(?:bicarbonate|hco3-?|co2 total)\b/i, name: 'Bicarbonate (HCO3-)', unit: 'mmol/L', ref: '22 - 29' },
  { regex: /(?:hemoglobin|hgb|hb)\b/i, name: 'Hemoglobin', unit: 'g/dL', ref: '12.0 - 17.5' },
  { regex: /(?:platelet count|platelets?|plt)\b/i, name: 'Platelet Count', unit: '10^3/uL', ref: '150 - 450' },
  { regex: /(?:serum glucose|blood glucose|glucose|glu)\b/i, name: 'Serum Glucose', unit: 'mg/dL', ref: '70 - 140' },
  { regex: /(?:arterial ph|blood ph|ph)\b/i, name: 'Arterial pH', unit: '', ref: '7.35 - 7.45' },
  { regex: /(?:pao2|po2)\b/i, name: 'PaO2', unit: 'mmHg', ref: '80 - 100' },
  { regex: /(?:paco2|pco2)\b/i, name: 'PaCO2', unit: 'mmHg', ref: '35 - 45' },
];

export function parseLabTextFallback(text: string): ExtractedLabMarker[] {
  const lines = text.split('\n');
  const markers: ExtractedLabMarker[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const item of ANALYTE_FALLBACK_PATTERNS) {
      if (seen.has(item.name)) continue;
      if (item.regex.test(trimmed)) {
        const match = trimmed.match(/(?:[<>]=?|\b)\s*(\d+(?:\.\d+)?)/);
        if (match && match[1]) {
          markers.push({
            name: item.name,
            value: match[1],
            unit: item.unit,
            referenceRange: item.ref,
          });
          seen.add(item.name);
          break;
        }
      }
    }
  }
  return markers;
}

export async function extractLabReport(fileDataOrBase64: string, filename = 'report.pdf'): Promise<ExtractedLabResult> {
  let fileBuffer: Buffer;
  const isBase64 = fileDataOrBase64.startsWith('data:') || fileDataOrBase64.length > 500;

  if (fileDataOrBase64.startsWith('data:')) {
    const commaIndex = fileDataOrBase64.indexOf(',');
    fileBuffer = Buffer.from(fileDataOrBase64.slice(commaIndex + 1), 'base64');
  } else if (isBase64 && !fileDataOrBase64.includes('\n') && !fileDataOrBase64.includes(' ')) {
    fileBuffer = Buffer.from(fileDataOrBase64, 'base64');
  } else {
    fileBuffer = Buffer.from(fileDataOrBase64, 'utf-8');
  }

  const tmpPath = path.join(os.tmpdir(), `lab_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  fs.writeFileSync(tmpPath, fileBuffer);

  const pythonScript = path.join(process.cwd(), 'training', 'ocr_lab_report.py');

  return new Promise((resolve) => {
    execFile('python', [pythonScript, tmpPath], { timeout: 15000 }, (error, stdout) => {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}

      if (!error && stdout) {
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.success) {
            return resolve(parsed);
          }
        } catch {}
      }

      // Fallback
      const text = fileBuffer.toString('utf-8');
      const fallbackMarkers = parseLabTextFallback(text);
      return resolve({
        success: true,
        rawText: text.slice(0, 2000),
        markers: fallbackMarkers,
        count: fallbackMarkers.length,
        engine: 'TypeScript Fallback Regex Parser',
      });
    });
  });
}
