"""Build a triage smoke payload that includes a REAL chest X-ray data URL
(from the embedded demo asset) so the DenseNet-121 ONNX model runs on genuine
radiographic input end-to-end."""
import json
import os

with open(os.path.join('src', 'data', 'xray_b64', 'pneumonia.txt'), 'r') as f:
    img = f.read().strip()

payload = {
    'title': 'Smoke Test - CAP + Real CXR',
    'patient': {
        'age': 67,
        'gender': 'male',
        'chiefComplaint': 'Productive cough, fever, and shortness of breath for 3 days',
        'symptomDescription': 'Persistent productive cough with rust-colored sputum, pleuritic chest pain, rigors, progressive dyspnea.',
        'medicalHistory': 'Hypertension, type 2 diabetes',
        'medications': 'Metformin, Lisinopril',
        'allergies': 'Penicillin (rash)',
        'vitals': {
            'heartRate': 112,
            'bloodPressureSystolic': 102,
            'bloodPressureDiastolic': 64,
            'respiratoryRate': 28,
            'oxygenSaturation': 91,
            'temperature': 38.9,
        },
    },
    'imaging': {
        'modality': 'Chest X-Ray (PA/AP)',
        'fileName': 'pneumonia.png',
        'imageDataUrl': img,
        'clinicalIndication': 'Rule out pneumonia, pleural effusion, or pneumothorax.',
    },
    'labs': {
        'markers': [
            {'name': 'White Blood Cell Count (WBC)', 'value': '15.2', 'unit': '10^3/uL', 'referenceRange': '4.5 - 11.0', 'status': 'ABNORMAL_HIGH'},
            {'name': 'C-Reactive Protein (CRP)', 'value': '180', 'unit': 'mg/L', 'referenceRange': '0.0 - 5.0', 'status': 'CRITICAL_HIGH'},
        ]
    },
}

out = os.path.join('scripts', 'smoke-payload-img.json')
with open(out, 'w') as f:
    json.dump(payload, f)
print('Wrote', out, os.path.getsize(out) // 1024, 'KB')
