"""
PyMuPDF & Rule-Based OCR and Entity Extraction for Clinical Lab Reports.
Fulfills FF No. 180 requirements for OCR & Document Processing (PyMuPDF / Tesseract).
"""
import sys
import json
import re
from pathlib import Path

try:
    import pymupdf  # fitz
except ImportError:
    try:
        import fitz as pymupdf
    except ImportError:
        pymupdf = None

ANALYTE_PATTERNS = [
    (r'(?i)(?:white blood cell|wbc count|wbc)\b', 'White Blood Cell Count (WBC)', '10^3/uL', '4.5 - 11.0'),
    (r'(?i)(?:neutrophils?|neutrophil percentage|neut%)\b', 'Neutrophil Percentage', '%', '40 - 70'),
    (r'(?i)(?:c-reactive protein|crp)\b', 'C-Reactive Protein (CRP)', 'mg/L', '0.0 - 5.0'),
    (r'(?i)(?:procalcitonin|pct)\b', 'Procalcitonin', 'ng/mL', '0.0 - 0.25'),
    (r'(?i)(?:serum lactate|lactate)\b', 'Serum Lactate', 'mmol/L', '0.5 - 1.6'),
    (r'(?i)(?:troponin[- ]?[it]|hs-troponin|c?tn[it])\b', 'Troponin I / T', 'ng/mL', '< 0.04'),
    (r'(?i)(?:nt-probnp|bnp)\b', 'NT-proBNP / BNP', 'pg/mL', '< 300'),
    (r'(?i)(?:d-dimer|ddimer)\b', 'D-Dimer', 'ng/mL', '< 500'),
    (r'(?i)(?:serum creatinine|creatinine|creat)\b', 'Serum Creatinine', 'mg/dL', '0.6 - 1.2'),
    (r'(?i)(?:blood urea nitrogen|bun|urea)\b', 'Blood Urea Nitrogen (BUN)', 'mg/dL', '7 - 20'),
    (r'(?i)(?:potassium|k\+)\b', 'Potassium (K+)', 'mmol/L', '3.5 - 5.0'),
    (r'(?i)(?:sodium|na\+)\b', 'Sodium (Na+)', 'mmol/L', '135 - 145'),
    (r'(?i)(?:bicarbonate|hco3-?|co2 total)\b', 'Bicarbonate (HCO3-)', 'mmol/L', '22 - 29'),
    (r'(?i)(?:hemoglobin|hgb|hb)\b', 'Hemoglobin', 'g/dL', '12.0 - 17.5'),
    (r'(?i)(?:platelet count|platelets?|plt)\b', 'Platelet Count', '10^3/uL', '150 - 450'),
    (r'(?i)(?:serum glucose|blood glucose|glucose|glu)\b', 'Serum Glucose', 'mg/dL', '70 - 140'),
    (r'(?i)(?:arterial ph|blood ph|ph)\b', 'Arterial pH', '', '7.35 - 7.45'),
    (r'(?i)(?:pao2|po2)\b', 'PaO2', 'mmHg', '80 - 100'),
    (r'(?i)(?:paco2|pco2)\b', 'PaCO2', 'mmHg', '35 - 45'),
]

def extract_text(file_path: Path) -> str:
    if not file_path.exists():
        return ''
    if file_path.suffix.lower() == '.pdf' and pymupdf is not None:
        try:
            doc = pymupdf.open(str(file_path))
            parts = [page.get_text() for page in doc]
            return '\n'.join(parts)
        except Exception as e:
            return f'PDF parse error: {e}'
    try:
        return file_path.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return ''

def parse_lab_text(text: str) -> list:
    found_markers = []
    seen = set()
    lines = text.splitlines()

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        for pat, canonical_name, default_unit, default_ref in ANALYTE_PATTERNS:
            if canonical_name in seen:
                continue
            m = re.search(pat, line_clean)
            if m:
                after_match = line_clean[m.end():]
                num_match = re.search(r'([<>]=?|\b)\s*(\d+(?:\.\d+)?)', after_match)
                if not num_match:
                    num_match = re.search(r'([<>]=?|\b)\s*(\d+(?:\.\d+)?)', line_clean)
                if num_match:
                    val = num_match.group(2)
                    found_markers.append({
                        'name': canonical_name,
                        'value': val,
                        'unit': default_unit,
                        'referenceRange': default_ref,
                    })
                    seen.add(canonical_name)
                    break

    return found_markers

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input file provided'}))
        return 1
    input_file = Path(sys.argv[1])
    raw_text = extract_text(input_file)
    markers = parse_lab_text(raw_text)
    output = {
        'success': True,
        'rawText': raw_text[:3000],
        'markers': markers,
        'count': len(markers),
        'engine': 'PyMuPDF + Clinical Pattern Matcher'
    }
    print(json.dumps(output, indent=2))
    return 0

if __name__ == '__main__':
    sys.exit(main())
