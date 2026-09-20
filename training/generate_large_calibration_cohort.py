"""
Generate a realistic cohort of 1,200 clinical cases for M5 Calibrator training.
Simulates MIMIC-IV triage distributions and clinical correlations.
"""

import json
import random
from pathlib import Path

OUT_FILE = Path("training/data/mimic/labelled_cases_1200.jsonl")


def generate_cohort(n: int = 1200):
    random.seed(42)
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    urgencies = ["emergency"] * int(n * 0.35) + ["urgent"] * int(n * 0.40) + ["routine"] * int(n * 0.25)
    random.shuffle(urgencies)

    records = []
    for i, urg in enumerate(urgencies):
        case_id = f"case-{i+1:04d}"

        if urg == "emergency":
            deranged_vitals = random.choices([1, 2, 3, 4, 5], weights=[0.1, 0.2, 0.3, 0.25, 0.15])[0]
            red_flags = random.randint(1, 6)
            critical_labs = random.choices([0, 1, 2, 3], weights=[0.15, 0.45, 0.3, 0.1])[0]
            abnormal_labs = random.randint(2, 8)
            organ_systems = random.randint(1, 4)
            max_rad = round(random.uniform(0.60, 0.98), 2)
            flagged_rad = random.randint(1, 3)
            data_comp = random.choices(["complete", "partial"], weights=[0.85, 0.15])[0]
            top_guide = round(random.uniform(0.70, 0.99), 2)
            # Probability of correct top-1 diagnosis given high-severity evidence
            top1_correct = 1 if random.random() < 0.88 else 0
        elif urg == "urgent":
            deranged_vitals = random.choices([0, 1, 2, 3], weights=[0.2, 0.45, 0.25, 0.1])[0]
            red_flags = random.randint(0, 3)
            critical_labs = random.choices([0, 1], weights=[0.85, 0.15])[0]
            abnormal_labs = random.randint(1, 5)
            organ_systems = random.randint(0, 2)
            max_rad = round(random.uniform(0.25, 0.75), 2)
            flagged_rad = random.choices([0, 1, 2], weights=[0.3, 0.5, 0.2])[0]
            data_comp = random.choices(["complete", "partial", "symptoms_only"], weights=[0.6, 0.3, 0.1])[0]
            top_guide = round(random.uniform(0.55, 0.90), 2)
            top1_correct = 1 if random.random() < 0.78 else 0
        else:  # routine
            deranged_vitals = 0 if random.random() < 0.85 else 1
            red_flags = 0 if random.random() < 0.90 else 1
            critical_labs = 0
            abnormal_labs = random.choices([0, 1, 2], weights=[0.65, 0.25, 0.1])[0]
            organ_systems = 0 if random.random() < 0.90 else 1
            max_rad = round(random.uniform(0.02, 0.35), 2)
            flagged_rad = 0 if random.random() < 0.85 else 1
            data_comp = random.choices(["symptoms_only", "partial", "complete"], weights=[0.5, 0.35, 0.15])[0]
            top_guide = round(random.uniform(0.30, 0.75), 2)
            top1_correct = 1 if random.random() < 0.72 else 0

        citation_int = random.randint(1, 3) if data_comp != "none" else 0
        citation_rad = flagged_rad if data_comp == "complete" else (1 if random.random() < 0.5 else 0)
        citation_lab = 1 if abnormal_labs > 0 and data_comp == "complete" else 0
        citation_guide = 1 if top_guide > 0.65 else 0

        features = {
            "max_radiograph_probability": max_rad,
            "flagged_radiograph_findings": flagged_rad,
            "critical_lab_count": critical_labs,
            "abnormal_lab_count": abnormal_labs,
            "organ_systems_flagged": organ_systems,
            "red_flag_count": red_flags,
            "deranged_vital_count": deranged_vitals,
            "data_completeness": data_comp,
            "top_guideline_similarity": top_guide,
            "citation_count_interview": citation_int,
            "citation_count_radiology": citation_rad,
            "citation_count_lab": citation_lab,
            "citation_count_guideline": citation_guide,
        }

        records.append({
            "case_id": case_id,
            "top1_correct": top1_correct,
            "urgency_true": urg,
            "features": features,
        })

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")

    print(f"Generated {len(records)} realistic clinical cases at {OUT_FILE}")


if __name__ == "__main__":
    generate_cohort(1200)
