"""Replace the synthetic SVG generator in clinicalScenarios.ts with a lookup
into the embedded real chest X-ray data URLs (REAL_XRAYS)."""
import os

PATH = os.path.join('src', 'data', 'clinicalScenarios.ts')

with open(PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines are 0-indexed here; the generator occupies source lines 15..110
# (1-indexed), i.e. indices 14..109 inclusive.
start_idx = 14  # '// Generate realistic simulated...'
end_idx = 110   # line 110 '}' -> exclusive bound index 110

# Sanity-check the boundaries before splicing.
assert 'simulated radiographic imagery' in lines[start_idx], lines[start_idx]
assert lines[start_idx + 1].lstrip().startswith('function createChestXrayDataUrl'), lines[start_idx + 1]
assert lines[end_idx - 1].rstrip() == '}', repr(lines[end_idx - 1])

replacement = (
    "// Return a real de-identified chest radiograph for each demo case.\n"
    "//\n"
    "// These are genuine chest X-rays (public COVID-19 Image Data Collection),\n"
    "// embedded in src/data/realXrays.ts, so the DenseNet-121 ONNX model receives\n"
    "// real radiographic input and produces meaningful pathology probabilities.\n"
    "// This replaces the previous synthetic SVG cartoons, which yielded\n"
    "// meaningless model activations.\n"
    "function createChestXrayDataUrl(type: 'pneumonia' | 'cardiomegaly' | 'copd' | 'appendicitis'): string {\n"
    "  return REAL_XRAYS[type];\n"
    "}\n"
)

new_lines = lines[:start_idx] + [replacement] + lines[end_idx:]

with open(PATH, 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(new_lines)

print('Replaced generator. New file lines:', len(new_lines))
