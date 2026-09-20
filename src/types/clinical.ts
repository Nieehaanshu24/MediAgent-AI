/**
 * Types for MediAgent AI Clinical Decision-Support Triage System
 */

export type UrgencyLevel = 'routine' | 'urgent' | 'emergency';

export interface PatientVitals {
  heartRate: number; // bpm
  bloodPressureSystolic: number; // mmHg
  bloodPressureDiastolic: number; // mmHg
  respiratoryRate: number; // breaths/min
  oxygenSaturation: number; // %
  temperature: number; // Celsius
}

export interface AdaptiveFollowUpQuestion {
  id: string;
  question: string;
  reasoning: string; // Inline note detailing why the Interviewer asked this question (triage logic)
  suggestedAnswers?: string[];
  answer?: string;
  answeredAt?: string;
}

export interface PatientDemographics {
  age: number;
  gender: 'male' | 'female' | 'other';
  chiefComplaint: string;
  symptomDuration: string;
  symptomDescription: string;
  pastMedicalHistory: string;
  currentMedications: string;
  allergies: string;
  vitals: PatientVitals;
  followUpQuestions?: AdaptiveFollowUpQuestion[];
  intakeComplete?: boolean;
}

export interface ImagingStudy {
  modality: 'Chest X-Ray (PA/AP)' | 'Chest CT' | 'Abdominal X-Ray' | 'Ultrasound' | 'Other';
  imageDataUrl?: string; // base64
  fileName?: string;
  clinicalIndication: string;
  structuredFindings?: RadiologistFinding[];
  overallImpression?: string;
  isAnalyzing?: boolean;
}

export interface LabMarker {
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: 'NORMAL' | 'ABNORMAL_HIGH' | 'ABNORMAL_LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';
  interpretation?: string;
}

export interface LabPanelData {
  markers: LabMarker[];
  rawReportText?: string;
  collectionTime?: string;
}

// 1. Interviewer Agent Output
export interface InterviewerAnalysis {
  agentName: string;
  clinicalSummary: string;
  symptomTimeline: string;
  vitalsAssessment: {
    vitalName: string;
    value: string;
    status: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'LOW' | 'CRITICAL';
    clinicalSignificance: string;
  }[];
  keyRiskFactors: string[];
  interviewerImpressions: string[];
  redFlagSymptoms: string[];
  adaptiveFollowUps?: AdaptiveFollowUpQuestion[];
}

// 2. Radiologist Agent Output
export type PathologyLabel =
  | 'Atelectasis'
  | 'Cardiomegaly'
  | 'Effusion'
  | 'Infiltration'
  | 'Mass'
  | 'Nodule'
  | 'Pneumonia'
  | 'Pneumothorax'
  | 'Consolidation'
  | 'Edema'
  | 'Emphysema'
  | 'Fibrosis'
  | 'Pleural_Thickening'
  | 'Hernia'
  | 'No Finding'
  | string;

export interface PathologyClassResult {
  index: number;
  label: PathologyLabel;
  logit: number;
  probability: number;
  flaggedPositive: boolean;
}

export interface RadiologyModelInference {
  modelName: string;
  modelArchitecture: string;
  trainingDataset: string;
  validationAuc: number;
  executionTimeMs: number;
  classes: PathologyClassResult[];
  positiveFindings: string[];
  reliabilityNote: string;
}

export type FindingSeverity = 'Normal' | 'Mild' | 'Moderate' | 'Severe' | 'Critical';

export interface RadiologistFinding {
  id: string; // e.g. "RF-1", "RF-2"
  region: string;
  observation: string;
  severity: FindingSeverity;
}

export interface RegionObservation {
  id?: string;
  region: string;
  status: 'Normal' | 'Abnormal' | 'Equivocal';
  findingDescription: string;
  observation?: string;
  severity?: FindingSeverity;
}

export interface RadiologistAnalysis {
  agentName: string;
  studyModality: string;
  technicalQuality: string;
  findings: RadiologistFinding[]; // structured findings: list of {region, observation, severity}
  overallImpression: string; // one overall impression line
  regionObservations: RegionObservation[];
  positiveFindings: string[];
  pertinentNegatives: string[];
  radiologicalImpression: string;
  diagnosticDifferential: string[];
  recommendedImagingFollowUp: string;
  modelInference?: RadiologyModelInference;
}

// 3. Lab Analyst Agent Output
export interface LabAnalystAnalysis {
  agentName: string;
  processedMarkers: LabMarker[];
  criticalAlerts: string[];
  clinicalCalculations: {
    indexName: string;
    calculatedValue: string;
    referenceNorm: string;
    clinicalMeaning: string;
  }[];
  organSystemsFlagged: string[];
  labImpression: string;
}

// RAG Clinical Guideline Snippet
export interface ClinicalGuideline {
  id: string;
  title: string;
  source: string;
  category: string;
  snippet: string;
  similarityScore?: number;
}

// Evidence Citation linking a Doctor claim to concrete agent/guideline output
export interface EvidenceCitation {
  sourceType: 'interview' | 'radiology' | 'lab' | 'guideline';
  sourceName: string;
  claim: string;
  citedTextOrValue: string;
  confidenceContribution?: string;
}

export interface MissingDataSource {
  source: 'imaging' | 'labs' | 'vitals' | 'interview';
  label: string;
  status: 'unavailable' | 'deferred' | 'partial';
  impactOnConfidence: string;
  recommendedAction: string;
}

export interface ConfidencePillarScore {
  pillar: 'interview' | 'radiology' | 'lab' | 'guideline';
  label: string;
  maxWeight: number;
  contributedScore: number;
  isSupported: boolean;
  statusText: string;
  citationCount: number;
}

export interface ProbableCondition {
  condition: string;
  icdCodeEstimate: string;
  probabilityScore: number; // 0 to 100
  evidenceStrength?: 'strong' | 'moderate' | 'weak';
  rationale: string;
  evidenceCitations: EvidenceCitation[];
  referencedFindingIds?: string[]; // e.g. ["RF-1", "RF-2"]
  confidencePillars?: ConfidencePillarScore[];
}

// 4. Doctor Agent Synthesis Output
export interface DoctorSynthesis {
  agentName: string;
  urgencyLevel: UrgencyLevel;
  urgencyRationale: string;
  clinicalExecutiveSummary: string;
  probableConditions: ProbableCondition[];
  recommendedNextSteps: {
    category: 'Immediate Stabilization' | 'Diagnostics & Labs' | 'Consultations' | 'Monitoring';
    action: string;
    timeframe: string;
    groundingCitation: string;
  }[];
  guidelineGroundingSummary: string;
  differentialExclusions: {
    condition: string;
    reasonForLowerLikelihood: string;
    counterEvidence: string;
  }[];
  referencedRadiologistFindings?: string[]; // list of all cited finding chips e.g. ["RF-1", "RF-3"]
  missingDataSources?: MissingDataSource[];
  dataCompletenessLevel?: 'symptoms_only' | 'partial' | 'complete';
  diagnosticLimitationsNotice?: string;
}

export interface ClinicalCase {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  patient: PatientDemographics;
  imaging?: ImagingStudy;
  labs: LabPanelData;
  agentResults?: {
    interviewer?: InterviewerAnalysis;
    radiologist?: RadiologistAnalysis;
    labAnalyst?: LabAnalystAnalysis;
    retrievedGuidelines?: ClinicalGuideline[];
    doctor?: DoctorSynthesis;
  };
  agentExecutionTimes?: {
    interviewerMs?: number;
    radiologistMs?: number;
    labAnalystMs?: number;
    ragRetrievalMs?: number;
    doctorMs?: number;
    totalMs?: number;
  };
}

export type LiveAgentStatus = 'waiting' | 'running' | 'done' | 'error';

export interface AgentProgressState {
  status: LiveAgentStatus;
  message?: string;
  executionTimeMs?: number;
  preview?: string;
  startedAt?: number;
}

export interface LivePipelineProgress {
  interviewer: AgentProgressState;
  radiologist: AgentProgressState;
  labAnalyst: AgentProgressState;
  rag: AgentProgressState;
  doctor: AgentProgressState;
  activeAgentId?: 'interviewer' | 'radiologist' | 'labAnalyst' | 'rag' | 'doctor';
  elapsedMs: number;
}
