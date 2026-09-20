import { GoogleGenAI } from '@google/genai';
import type { PatientDemographics, InterviewerAnalysis } from '../../src/types/clinical';
import { generateContentWithFallback } from '../utils/aiHelper';

export async function runInterviewerAgent(
  ai: GoogleGenAI,
  patient: PatientDemographics
): Promise<InterviewerAnalysis> {
  const systemInstruction = `You are the Interviewer Agent in MediAgent AI, an advanced clinical decision-support triage system (educational prototype).
Your role:
1. Synthesize patient demographics, chief complaint, symptom description, past history, medications, allergies, and vital signs into a structured clinical interview assessment.
2. Objectively classify each vital sign against adult physiological norms:
   - Heart Rate: 60-100 bpm normal (<60 LOW, 101-120 ELEVATED/TACHYCARDIA, >120 CRITICAL HIGH)
   - Blood Pressure: 90/60 to 120/80 normal (SBP < 90 HYPOTENSION/CRITICAL, SBP 121-139 ELEVATED, SBP 140-179 STAGE 2 HYPERTENSION, SBP >= 180 HYPERTENSIVE CRISIS)
   - Respiratory Rate: 12-20 bpm normal (>20 ELEVATED/TACHYPNEA, >=30 CRITICAL HIGH)
   - Oxygen Saturation (SpO2): 95-100% normal on room air (90-94% MILD HYPOXEMIA, <90% SEVERE HYPOXEMIA/CRITICAL)
   - Temperature: 36.5-37.5 C normal (>38.0 C FEVER, >=39.0 C HIGH FEVER, <35.5 C HYPOTHERMIA)
3. Identify red flags (e.g. hemodynamic collapse, hypoxia, severe pain, severe infection signs).
4. Provide structured, unambiguous clinical conclusions without hedging words.

Output MUST be strictly valid JSON matching this structure:
{
  "agentName": "Interviewer Agent",
  "clinicalSummary": "Comprehensive summary of present illness, symptom evolution, and baseline status...",
  "symptomTimeline": "Timeline breakdown of symptom onset and progression...",
  "vitalsAssessment": [
    {
      "vitalName": "Heart Rate",
      "value": "118 bpm",
      "status": "HIGH",
      "clinicalSignificance": "Sinus tachycardia, indicative of physiological stress, systemic inflammatory response, or compensatory mechanism."
    }
  ],
  "keyRiskFactors": ["List of identified patient risk factors from history and presentation..."],
  "interviewerImpressions": ["Clinical hypotheses regarding primary affected systems..."],
  "redFlagSymptoms": ["Immediate alert symptoms identified during intake..."]
}`;

  const followUpsText = patient.followUpQuestions && patient.followUpQuestions.length > 0
    ? `\nAdaptive Triage Follow-Up Questions & Patient Responses:
${patient.followUpQuestions.map((q, idx) => `Question ${idx + 1}: "${q.question}"\n- Triage Logic / Reasoning: ${q.reasoning}\n- Patient Response: "${q.answer || 'No response recorded'}"`).join('\n\n')}`
    : '';

  const userPrompt = `Patient Intake Data:
- Age: ${patient.age} years old
- Gender: ${patient.gender}
- Chief Complaint: "${patient.chiefComplaint}"
- Duration: ${patient.symptomDuration}
- Clinical Description: "${patient.symptomDescription}"
- Past Medical History: ${patient.pastMedicalHistory || 'None reported'}
- Current Medications: ${patient.currentMedications || 'None'}
- Allergies: ${patient.allergies || 'No known allergies (NKDA)'}
${followUpsText}

Measured Vital Signs:
- Heart Rate: ${patient.vitals.heartRate} bpm
- Blood Pressure: ${patient.vitals.bloodPressureSystolic}/${patient.vitals.bloodPressureDiastolic} mmHg
- Respiratory Rate: ${patient.vitals.respiratoryRate} breaths/min
- SpO2: ${patient.vitals.oxygenSaturation}%
- Body Temperature: ${patient.vitals.temperature} °C

Analyze this patient presentation now according to your instructions, integrating the adaptive follow-up findings into your clinical summary and impressions.`;

  try {
    const rawText = await generateContentWithFallback(ai, {
      contents: [{ text: userPrompt }],
      systemInstruction,
      temperature: 0.2,
    });

    const parsed = JSON.parse(rawText) as InterviewerAnalysis;
    parsed.agentName = 'Interviewer Agent';
    if (patient.followUpQuestions && patient.followUpQuestions.length > 0) {
      parsed.adaptiveFollowUps = patient.followUpQuestions;
    }
    return parsed;
  } catch (err: any) {
    console.warn('[Interviewer Agent] Gemini generation unavailable (quota/rate-limit). Utilizing rule-based clinical intake synthesis.');
    return buildFallbackInterviewerAnalysis(patient);
  }
}

function buildFallbackInterviewerAnalysis(patient: PatientDemographics): InterviewerAnalysis {
  const hr = patient.vitals.heartRate;
  const sbp = patient.vitals.bloodPressureSystolic;
  const dbp = patient.vitals.bloodPressureDiastolic;
  const rr = patient.vitals.respiratoryRate;
  const spo2 = patient.vitals.oxygenSaturation;
  const temp = patient.vitals.temperature;

  const vitalsAssessment: {
    vitalName: string;
    value: string;
    status: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'LOW' | 'CRITICAL';
    clinicalSignificance: string;
  }[] = [
    {
      vitalName: 'Heart Rate',
      value: `${hr} bpm`,
      status: hr > 120 ? 'CRITICAL' : hr > 100 ? 'ELEVATED' : hr < 60 ? 'LOW' : 'NORMAL',
      clinicalSignificance: hr > 100 ? 'Sinus tachycardia, suggesting inflammatory response, acute distress, or compensatory overdrive.' : 'Heart rate within baseline physiological range.',
    },
    {
      vitalName: 'Blood Pressure',
      value: `${sbp}/${dbp} mmHg`,
      status: sbp < 90 ? 'CRITICAL' : sbp >= 180 || dbp >= 110 ? 'CRITICAL' : sbp >= 140 ? 'HIGH' : 'NORMAL',
      clinicalSignificance: sbp < 90 ? 'Hypotension, indicative of potential circulatory compromise or shock state.' : 'Blood pressure evaluated against adult normotensive standards.',
    },
    {
      vitalName: 'Respiratory Rate',
      value: `${rr} breaths/min`,
      status: rr >= 30 ? 'CRITICAL' : rr > 20 ? 'ELEVATED' : 'NORMAL',
      clinicalSignificance: rr > 20 ? 'Tachypnea, indicating increased work of breathing or metabolic acidosis compensation.' : 'Eupneic ventilation rate.',
    },
    {
      vitalName: 'Oxygen Saturation',
      value: `${spo2}%`,
      status: spo2 < 90 ? 'CRITICAL' : spo2 < 95 ? 'ELEVATED' : 'NORMAL',
      clinicalSignificance: spo2 < 95 ? 'Hypoxemia requiring clinical pulse oximetry monitoring and supplemental O2 evaluation.' : 'Normal room-air oxygenation.',
    },
    {
      vitalName: 'Body Temperature',
      value: `${temp} °C`,
      status: temp >= 39.0 ? 'CRITICAL' : temp >= 38.0 ? 'ELEVATED' : temp < 35.5 ? 'LOW' : 'NORMAL',
      clinicalSignificance: temp >= 38.0 ? 'Febrile presentation consistent with infectious or inflammatory etiology.' : 'Normothermic body temperature.',
    },
  ];

  const redFlagSymptoms: string[] = [];
  if (spo2 < 90) redFlagSymptoms.push('Severe Hypoxia (SpO2 < 90%)');
  if (sbp < 90) redFlagSymptoms.push('Systemic Hypotension / Shock Risk (SBP < 90 mmHg)');
  if (rr >= 30) redFlagSymptoms.push('Severe Tachypnea (RR >= 30/min)');
  if (hr > 120) redFlagSymptoms.push('Marked Tachycardia (HR > 120 bpm)');
  if (temp >= 39.0) redFlagSymptoms.push('High Fever (Temp >= 39.0°C)');

  const ccLower = (patient.chiefComplaint + ' ' + patient.symptomDescription).toLowerCase();
  if (ccLower.includes('chest pain') || ccLower.includes('angina') || ccLower.includes('pressure')) {
    redFlagSymptoms.push('Acute Thoracic Discomfort / Ischemic Risk');
  }
  if (ccLower.includes('shortness of breath') || ccLower.includes('dyspnea') || ccLower.includes('gasping')) {
    redFlagSymptoms.push('Acute Respiratory Distress');
  }

  return {
    agentName: 'Interviewer Agent',
    clinicalSummary: `Patient presents with ${patient.age}-year-old ${patient.gender} presenting with chief complaint of "${patient.chiefComplaint}" lasting ${patient.symptomDuration}. Description: ${patient.symptomDescription}. Medical history: ${patient.pastMedicalHistory || 'None'}. Vitals reveal HR ${hr} bpm, BP ${sbp}/${dbp} mmHg, RR ${rr}/min, SpO2 ${spo2}%, Temp ${temp}°C.`,
    symptomTimeline: `Onset and progression reported over ${patient.symptomDuration}.`,
    vitalsAssessment,
    keyRiskFactors: [
      patient.pastMedicalHistory ? `Past Medical History: ${patient.pastMedicalHistory}` : 'Age-related baseline risk profile',
      patient.allergies ? `Allergies: ${patient.allergies}` : 'No known drug allergies',
    ],
    interviewerImpressions: [
      `Primary clinical concern focused on ${patient.chiefComplaint || 'presenting symptoms'}.`,
      redFlagSymptoms.length > 0 ? `Red flag indicators flagged: ${redFlagSymptoms.join(', ')}.` : 'No immediate life-threatening vitals instability detected at intake.',
    ],
    redFlagSymptoms,
    adaptiveFollowUps: patient.followUpQuestions || [],
  };
}
