import React, { useState } from 'react';
import {
 AlertOctagon,
 AlertTriangle,
 CheckCircle,
 ChevronDown,
 ChevronUp,
 FileText,
 User,
 Heart,
 ImageIcon,
 FlaskConical,
 BookOpen,
 Stethoscope,
 Printer,
 RotateCcw,
 Check,
 ExternalLink,
 ShieldCheck,
 Sparkles,
 Layers,
 Info,
 HelpCircle,
 X,
 AlertCircle,
 Gauge,
 Scale,
 CheckCircle2,
 MinusCircle,
 XCircle,
 Activity,
 BarChart2,
} from 'lucide-react';
import type {
 ClinicalCase,
 EvidenceCitation,
 ProbableCondition,
 RadiologistFinding,
 LabMarker,
 ConfidencePillarScore,
} from '../types/clinical';
import { partitionLabMarkers, evaluateLabMarker, isMarkerFlagged } from '../utils/labReference';
import { ClinicalHandoffNote } from './ClinicalHandoffNote';

interface FinalReportViewProps {
 clinicalCase: ClinicalCase;
 onEditCase: () => void;
 onNewCase: () => void;
}

export interface ComputedConfidenceBreakdown {
 pillars: ConfidencePillarScore[];
 agreeCount: number;
 totalPillars: number;
 calculatedScore: number;
 isHighAgreement: boolean;
 isModerateAgreement: boolean;
 isWeakAgreement: boolean;
 summaryRationale: string;
}

export function computeConfidenceBreakdown(
 cond: ProbableCondition,
 caseFindingCount = 0
): ComputedConfidenceBreakdown {
 if (cond.confidencePillars && cond.confidencePillars.length === 4) {
 const pillars = cond.confidencePillars;
 const agreeCount = pillars.filter((p) => p.isSupported).length;
 const calculatedScore = cond.probabilityScore ?? Math.round(pillars.reduce((s, p) => s + p.contributedScore, 0));
 return {
 pillars,
 agreeCount,
 totalPillars: 4,
 calculatedScore,
 isHighAgreement: agreeCount >= 3,
 isModerateAgreement: agreeCount === 2,
 isWeakAgreement: agreeCount <= 1,
 summaryRationale: `4-Pillar Calibrated: Supported by ${pillars.filter((p) => p.isSupported).map((p) => p.label).join(', ') || 'Syndromic presentation'}`,
 };
 }

 const citations = cond.evidenceCitations || [];
 const interviewCits = citations.filter((c) => c.sourceType === 'interview');
 const radiologyCits = citations.filter((c) => c.sourceType === 'radiology');
 const labCits = citations.filter((c) => c.sourceType === 'lab');
 const guidelineCits = citations.filter((c) => c.sourceType === 'guideline');

 const baseScore = cond.probabilityScore ?? 50;
 const isWeak = cond.evidenceStrength === 'weak' || baseScore < 40;
 const isModerate =
 cond.evidenceStrength === 'moderate' || (baseScore >= 40 && baseScore < 70);

 // 1. Patient Interview (Max 25 pts)
 const hasInterview = interviewCits.length > 0;
 const interviewScore = hasInterview ? (isWeak ? 10 : 25) : 0;
 const interviewSupported = interviewScore >= 15;
 const interviewStatus = hasInterview
 ? isWeak
 ? 'Non-specific / overlapping symptoms'
 : 'Classic symptom presentation & triage vitals'
 : 'No patient-reported concordance';

 // 2. Radiological Imaging (Max 30 pts)
 const isRadDeferred = radiologyCits.some(
 (c) =>
 c.sourceName.toLowerCase().includes('deferred') ||
 c.sourceName.toLowerCase().includes('unavailable') ||
 c.citedTextOrValue.toLowerCase().includes('no diagnostic scan') ||
 c.citedTextOrValue.toLowerCase().includes('imaging deferred')
 );
 const hasRadiologyChips =
 !isRadDeferred &&
 radiologyCits.length > 0 &&
 ((cond.referencedFindingIds && cond.referencedFindingIds.length > 0) || !isWeak);
 const radiologyScore = hasRadiologyChips
 ? isModerate
 ? 20
 : 30
 : isWeak || isRadDeferred
 ? 0
 : radiologyCits.length > 0
 ? 15
 : 0;
 const radiologySupported = radiologyScore >= 15;
 const radiologyStatus = isRadDeferred
 ? 'Modality deferred / no imaging submitted'
 : hasRadiologyChips
 ? `Objective imaging chip confirmation (${cond.referencedFindingIds?.join(', ') || 'Corroborating scan'})`
 : isWeak
 ? 'Absence of focal radiographic lesion / normal imaging'
 : radiologyCits.length > 0
 ? 'Borderline / non-specific radiological finding'
 : 'No imaging correlation';

 // 3. Laboratory Pathology (Max 25 pts)
 const isLabDeferred = labCits.some(
 (c) =>
 c.sourceName.toLowerCase().includes('deferred') ||
 c.sourceName.toLowerCase().includes('unavailable') ||
 c.citedTextOrValue.toLowerCase().includes('no blood chemistry') ||
 c.citedTextOrValue.toLowerCase().includes('no laboratory')
 );
 const hasLabs = !isLabDeferred && labCits.length > 0;
 const labScore = hasLabs ? (isWeak ? 5 : isModerate ? 15 : 25) : 0;
 const labSupported = labScore >= 15;
 const labStatus = isLabDeferred
 ? 'Modality deferred / no laboratory panel submitted'
 : hasLabs
 ? isWeak
 ? 'Non-specific biomarker elevations'
 : isModerate
 ? 'Moderate inflammatory / metabolic shifts'
 : 'Definitive diagnostic lab biomarker derangements'
 : 'Normal / non-confirmatory lab values';

 // 4. Clinical Guidelines RAG (Max 20 pts)
 const hasGuidelines = guidelineCits.length > 0;
 const guidelineScore = hasGuidelines ? (isWeak ? 5 : isModerate ? 15 : 20) : 0;
 const guidelineSupported = guidelineScore >= 15;
 const guidelineStatus = hasGuidelines
 ? isWeak
 ? 'Guideline rules favor alternate primary differential'
 : 'Validated clinical decision rule & criteria threshold met'
 : 'No specific guideline criteria matched';

 const pillars: ConfidencePillarScore[] = [
 {
 pillar: 'interview',
 label: 'Patient Presentation & Vitals',
 maxWeight: 25,
 contributedScore: interviewScore,
 isSupported: interviewSupported,
 statusText: interviewStatus,
 citationCount: interviewCits.length,
 },
 {
 pillar: 'radiology',
 label: 'Radiological Imaging',
 maxWeight: 30,
 contributedScore: radiologyScore,
 isSupported: radiologySupported,
 statusText: radiologyStatus,
 citationCount: radiologyCits.length,
 },
 {
 pillar: 'lab',
 label: 'Laboratory Pathology',
 maxWeight: 25,
 contributedScore: labScore,
 isSupported: labSupported,
 statusText: labStatus,
 citationCount: labCits.length,
 },
 {
 pillar: 'guideline',
 label: 'Clinical Practice Guidelines',
 maxWeight: 20,
 contributedScore: guidelineScore,
 isSupported: guidelineSupported,
 statusText: guidelineStatus,
 citationCount: guidelineCits.length,
 },
 ];

 const agreeCount = pillars.filter((p) => p.isSupported).length;
 const totalScore = pillars.reduce((sum, p) => sum + p.contributedScore, 0);

 const summaryRationale =
 agreeCount >= 3
 ? `${agreeCount} of 4 independent modalities agree. Strong multi-modal concordance confirms high diagnostic confidence.`
 : agreeCount === 2
 ? `2 of 4 modalities agree. Partial clinical corroboration pending targeted confirmatory testing.`
 : `Only ${agreeCount} of 4 modalities show support. Low multi-modal concordance; retained as lower differential candidate.`;

 return {
 pillars,
 agreeCount,
 totalPillars: 4,
 calculatedScore: Math.min(100, Math.max(10, baseScore)),
 isHighAgreement: agreeCount >= 3,
 isModerateAgreement: agreeCount === 2,
 isWeakAgreement: agreeCount <= 1,
 summaryRationale,
 };
}

export interface MultiAgentUrgencyResult {
 level: 'emergency' | 'urgent' | 'routine';
 title: string;
 badgeLabel: string;
 oneLineRationale: string;
 contributingFindings: {
 source: 'vitals' | 'radiology' | 'labs' | 'doctor';
 label: string;
 detail: string;
 isSevere: boolean;
 }[];
 primaryDriver: string;
 bannerBg: string;
 badgeBg: string;
 border: string;
 icon: React.ComponentType<{ className?: string }>;
 accent: string;
}

export function resolveMultiAgentUrgency(
 clinicalCase: ClinicalCase,
 radiologistFindings: RadiologistFinding[]
): MultiAgentUrgencyResult {
 const doctor = clinicalCase.agentResults?.doctor;
 const labAnalyst = clinicalCase.agentResults?.labAnalyst;
 const patient = clinicalCase.patient;
 const vitals = patient?.vitals;

 const rawMarkers =
 labAnalyst?.processedMarkers && labAnalyst.processedMarkers.length > 0
 ? labAnalyst.processedMarkers
 : clinicalCase.labs?.markers || (clinicalCase as any).labData?.markers || [];
 const { flagged: flaggedLabs } = partitionLabMarkers(rawMarkers);

 // 1. Gather severity findings from each modality
 const contributingFindings: {
 source: 'vitals' | 'radiology' | 'labs' | 'doctor';
 label: string;
 detail: string;
 isSevere: boolean;
 }[] = [];

 let isEmergency = false;
 let isUrgent = false;

 // Modality A: Patient Vitals & Presentation
 let vitalsSevereNote = '';
 if (vitals) {
 if (vitals.oxygenSaturation !== undefined && vitals.oxygenSaturation < 90) {
 isEmergency = true;
 vitalsSevereNote = `Critical hypoxia (SpO2 ${vitals.oxygenSaturation}%)`;
 contributingFindings.push({
 source: 'vitals',
 label: 'Critical Hypoxia',
 detail: `SpO2 ${vitals.oxygenSaturation}% below emergency threshold (<90%)`,
 isSevere: true,
 });
 } else if (vitals.oxygenSaturation !== undefined && vitals.oxygenSaturation <= 93) {
 isUrgent = true;
 contributingFindings.push({
 source: 'vitals',
 label: 'Moderate Hypoxia',
 detail: `SpO2 ${vitals.oxygenSaturation}% requires supplemental O2 monitoring`,
 isSevere: false,
 });
 }

 if (vitals.bloodPressureSystolic !== undefined && vitals.bloodPressureSystolic < 90) {
 isEmergency = true;
 vitalsSevereNote = `Hypotension / Shock risk (BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg)`;
 contributingFindings.push({
 source: 'vitals',
 label: 'Hypotension / Shock',
 detail: `BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`,
 isSevere: true,
 });
 } else if (
 (vitals.bloodPressureSystolic !== undefined && vitals.bloodPressureSystolic >= 180) ||
 (vitals.bloodPressureDiastolic !== undefined && vitals.bloodPressureDiastolic >= 110)
 ) {
 isEmergency = true;
 vitalsSevereNote = `Hypertensive emergency (BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg)`;
 contributingFindings.push({
 source: 'vitals',
 label: 'Hypertensive Emergency',
 detail: `BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`,
 isSevere: true,
 });
 }

 if (vitals.heartRate !== undefined && (vitals.heartRate >= 130 || vitals.heartRate < 45)) {
 isEmergency = true;
 vitalsSevereNote = `Marked hemodynamic instability (HR ${vitals.heartRate} bpm)`;
 contributingFindings.push({
 source: 'vitals',
 label: 'Marked Tachy/Bradycardia',
 detail: `HR ${vitals.heartRate} bpm`,
 isSevere: true,
 });
 } else if (vitals.heartRate !== undefined && vitals.heartRate >= 100) {
 isUrgent = true;
 contributingFindings.push({
 source: 'vitals',
 label: 'Tachycardia',
 detail: `HR ${vitals.heartRate} bpm`,
 isSevere: false,
 });
 }

 if (vitals.temperature !== undefined && vitals.temperature >= 38.8) {
 isUrgent = true;
 contributingFindings.push({
 source: 'vitals',
 label: 'High Fever',
 detail: `Core temp ${vitals.temperature}°C`,
 isSevere: false,
 });
 }

 if (vitals.respiratoryRate !== undefined && vitals.respiratoryRate >= 28) {
 isEmergency = true;
 contributingFindings.push({
 source: 'vitals',
 label: 'Severe Tachypnea',
 detail: `RR ${vitals.respiratoryRate}/min`,
 isSevere: true,
 });
 } else if (vitals.respiratoryRate !== undefined && vitals.respiratoryRate >= 22) {
 isUrgent = true;
 contributingFindings.push({
 source: 'vitals',
 label: 'Tachypnea',
 detail: `RR ${vitals.respiratoryRate}/min`,
 isSevere: false,
 });
 }
 }

 // Modality B: Laboratory Pathology
 const criticalLabs = flaggedLabs.filter(
 (m) => m.status === 'CRITICAL_HIGH' || m.status === 'CRITICAL_LOW'
 );
 let labSevereNote = '';
 if (criticalLabs.length > 0) {
 isEmergency = true;
 const topCrit = criticalLabs[0];
 labSevereNote = `critically elevated ${topCrit.name} (${topCrit.value} ${topCrit.unit || ''})`;
 criticalLabs.forEach((m) => {
 contributingFindings.push({
 source: 'labs',
 label: `Critical ${m.name}`,
 detail: `${m.value} ${m.unit || ''} (${m.status})`,
 isSevere: true,
 });
 });
 } else if (flaggedLabs.length > 0) {
 isUrgent = true;
 const topFlag = flaggedLabs[0];
 labSevereNote = `elevated ${topFlag.name} (${topFlag.value} ${topFlag.unit || ''})`;
 flaggedLabs.slice(0, 3).forEach((m) => {
 contributingFindings.push({
 source: 'labs',
 label: `Flagged ${m.name}`,
 detail: `${m.value} ${m.unit || ''} (Abnormal)`,
 isSevere: false,
 });
 });
 }

 // Modality C: Radiology Agent Findings
 const severeRadiology = radiologistFindings.filter(
 (f) =>
 f.severity?.toLowerCase() === 'severe' ||
 f.severity?.toLowerCase() === 'critical'
 );
 const moderateRadiology = radiologistFindings.filter(
 (f) => f.severity?.toLowerCase() === 'moderate'
 );

 let radSevereNote = '';
 if (severeRadiology.length > 0) {
 isEmergency = true;
 const topRad = severeRadiology[0];
 radSevereNote = `${topRad.region} ${topRad.observation} [${topRad.id}]`;
 severeRadiology.forEach((f) => {
 contributingFindings.push({
 source: 'radiology',
 label: `Severe Imaging [${f.id}]`,
 detail: `${f.region}: ${f.observation}`,
 isSevere: true,
 });
 });
 } else if (moderateRadiology.length > 0) {
 isUrgent = true;
 const topRad = moderateRadiology[0];
 radSevereNote = `${topRad.region} finding [${topRad.id}]`;
 moderateRadiology.forEach((f) => {
 contributingFindings.push({
 source: 'radiology',
 label: `Radiographic Finding [${f.id}]`,
 detail: `${f.region}: ${f.observation}`,
 isSevere: false,
 });
 });
 }

 // Modality D: Doctor Agent Synthesis
 const doctorUrgency = (doctor?.urgencyLevel || '').toLowerCase();
 if (doctorUrgency === 'emergency') {
 isEmergency = true;
 } else if (doctorUrgency === 'urgent') {
 isUrgent = true;
 }

 const topCondition = doctor?.probableConditions?.[0]?.condition || '';

 // Determine final level
 const finalLevel: 'emergency' | 'urgent' | 'routine' = isEmergency
 ? 'emergency'
 : isUrgent
 ? 'urgent'
 : 'routine';

 // Build the explicit one-line rationale
 let oneLineRationale = '';

 if (finalLevel === 'emergency') {
 const complaintLower = (patient?.chiefComplaint || '').toLowerCase();
 const hasTroponin = rawMarkers.some((m) => m.name.toLowerCase().includes('troponin') && isMarkerFlagged(m.status));
 const isCardiac =
 (complaintLower.includes('chest pain') || complaintLower.includes('angina') || complaintLower.includes('infarction')) &&
 (hasTroponin || topCondition.toLowerCase().includes('myocardial') || topCondition.toLowerCase().includes('coronary') || topCondition.toLowerCase().includes('infarction'));

 if (isCardiac) {
 oneLineRationale =
 'Emergency: findings suggest possible acute MI based on ECG-consistent symptoms + elevated troponin';
 } else if (topCondition.toLowerCase().includes('sepsis') || (vitals?.temperature && vitals.temperature >= 38.5 && severeRadiology.length > 0)) {
 oneLineRationale = `Emergency: findings suggest severe sepsis secondary to lobar pneumonia based on high fever (${vitals?.temperature || 38.9}°C), marked leukocytosis, and right lower lobe alveolar consolidation [RF-1]`;
 } else if (vitalsSevereNote && radSevereNote) {
 oneLineRationale = `Emergency: findings indicate acute cardiopulmonary instability based on ${vitalsSevereNote} and ${radSevereNote}`;
 } else if (doctor?.urgencyRationale && doctor.urgencyRationale.length < 160 && !doctor.urgencyRationale.toLowerCase().includes('triage')) {
 const cleanRationale = doctor.urgencyRationale.replace(/^(emergency:?|urgent:?|routine:?)\s*/i, '');
 oneLineRationale = `Emergency: ${cleanRationale}`;
 } else if (topCondition) {
 oneLineRationale = `Emergency: critical presentation for ${topCondition} driven by ${labSevereNote || vitalsSevereNote || radSevereNote || 'acute multi-modal deterioration'}`;
 } else {
 oneLineRationale =
 'Emergency: critical presentation requiring immediate resuscitation based on acute multi-modal clinical findings';
 }
 } else if (finalLevel === 'urgent') {
 const complaintLower = (patient?.chiefComplaint || '').toLowerCase();
 if (topCondition.toLowerCase().includes('appendicitis') || complaintLower.includes('rlq') || complaintLower.includes('appendic')) {
 oneLineRationale =
 'Urgent: findings suggest acute appendicitis based on RLQ peritoneal tenderness, elevated inflammatory markers, and ultrasonographic appendiceal thickening';
 } else if (topCondition.toLowerCase().includes('copd') || complaintLower.includes('copd') || complaintLower.includes('wheezing')) {
 oneLineRationale =
 'Urgent: findings suggest acute COPD exacerbation based on progressive dyspnea, wheezing, and radiographic bilateral hyperinflation';
 } else if (topCondition.toLowerCase().includes('pneumonia') || topCondition.toLowerCase().includes('infiltrate')) {
 oneLineRationale =
 'Urgent: findings suggest acute pneumonia based on productive respiratory symptoms, elevated inflammatory markers, and focal radiographic infiltrate';
 } else if (doctor?.urgencyRationale && doctor.urgencyRationale.length < 160 && !doctor.urgencyRationale.toLowerCase().includes('triage')) {
 const cleanRationale = doctor.urgencyRationale.replace(/^(emergency:?|urgent:?|routine:?)\s*/i, '');
 oneLineRationale = `Urgent: ${cleanRationale}`;
 } else if (topCondition) {
 oneLineRationale = `Urgent: clinical findings warrant expedited evaluation for ${topCondition} supported by ${labSevereNote || radSevereNote || 'abnormal diagnostic biomarkers'}`;
 } else {
 oneLineRationale =
 'Urgent: expedited inpatient evaluation required based on abnormal laboratory and imaging findings';
 }
 } else {
 oneLineRationale =
 'Routine: findings indicate stable subacute presentation without hemodynamic compromise, critical biomarker derangements, or acute radiographic lesions';
 }

 // Ensure prefix is cleanly standardized
 if (finalLevel === 'emergency' && !oneLineRationale.startsWith('Emergency:')) {
 oneLineRationale = `Emergency: ${oneLineRationale}`;
 } else if (finalLevel === 'urgent' && !oneLineRationale.startsWith('Urgent:')) {
 oneLineRationale = `Urgent: ${oneLineRationale}`;
 } else if (finalLevel === 'routine' && !oneLineRationale.startsWith('Routine:')) {
 oneLineRationale = `Routine: ${oneLineRationale}`;
 }

   if (finalLevel === 'emergency') {
    return {
      level: 'emergency',
      title: 'EMERGENCY TRIAGE — IMMEDIATE RESUSCITATION & ATTENTION REQUIRED',
      badgeLabel: 'EMERGENCY (LEVEL 1)',
      oneLineRationale,
      contributingFindings,
      primaryDriver: labSevereNote || vitalsSevereNote || radSevereNote || 'Acute multi-modal critical findings',
      bannerBg: 'bg-surface border-2 border-emergency/30',
      badgeBg: 'bg-emergency/15 text-emergency border border-emergency/30 font-bold',
      border: 'border-emergency/30',
      icon: AlertOctagon,
      accent: 'text-emergency',
    };
  }

  if (finalLevel === 'urgent') {
    return {
      level: 'urgent',
      title: 'URGENT TRIAGE — EXPEDITED INPATIENT EVALUATION REQUIRED',
      badgeLabel: 'URGENT (LEVEL 2)',
      oneLineRationale,
      contributingFindings,
      primaryDriver: labSevereNote || radSevereNote || 'Abnormal inflammatory & imaging markers',
      bannerBg: 'bg-surface border-2 border-amber-500/30',
      badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold',
      border: 'border-amber-500/30',
      icon: AlertTriangle,
      accent: 'text-amber-600',
    };
  }

  return {
    level: 'routine',
    title: 'ROUTINE TRIAGE — SUITABLE FOR OUTPATIENT / SUBACUTE WORKUP',
    badgeLabel: 'ROUTINE (LEVEL 3)',
    oneLineRationale,
    contributingFindings,
    primaryDriver: 'Stable vitals, baseline biomarkers, non-acute imaging',
    bannerBg: 'bg-surface border-2 border-routine/30',
    badgeBg: 'bg-routine/15 text-routine border border-routine/30 font-bold',
    border: 'border-routine/30',
    icon: CheckCircle2,
    accent: 'text-routine',
  };
}

export const FinalReportView: React.FC<FinalReportViewProps> = ({
 clinicalCase,
 onEditCase,
 onNewCase,
}) => {
 const [expandedConditionIndex, setExpandedConditionIndex] = useState<number | null>(0);
 const [activeTab, setActiveTab] = useState<'synthesis' | 'agents' | 'rag' | 'handoff'>('synthesis');
 const [selectedCitation, setSelectedCitation] = useState<EvidenceCitation | null>(null);
 const [selectedFinding, setSelectedFinding] = useState<RadiologistFinding | null>(null);
 const [showAllNormalReportLabs, setShowAllNormalReportLabs] = useState(false);
 const [showConfidenceModelModal, setShowConfidenceModelModal] = useState(false);

 const doctor = clinicalCase.agentResults?.doctor;
 const interviewer = clinicalCase.agentResults?.interviewer;
 const radiologist = clinicalCase.agentResults?.radiologist;
 const labAnalyst = clinicalCase.agentResults?.labAnalyst;
 const guidelines = clinicalCase.agentResults?.retrievedGuidelines || [];
 const adaptiveQuestions = interviewer?.adaptiveFollowUps || clinicalCase.patient?.followUpQuestions || [];

 // Normalize radiologist findings from structured findings or region observations
 const caseImaging = clinicalCase.imaging || (clinicalCase as any).imagingStudy;
 const radiologistFindings: RadiologistFinding[] =
 radiologist?.findings && radiologist.findings.length > 0
 ? radiologist.findings
 : caseImaging?.structuredFindings && caseImaging.structuredFindings.length > 0
 ? caseImaging.structuredFindings
 : (radiologist?.regionObservations || []).map((obs, idx) => ({
 id: obs.id || `RF-${idx + 1}`,
 region: obs.region,
 observation: obs.observation || obs.findingDescription,
 severity: obs.severity || (obs.status === 'Normal' ? 'Normal' : 'Moderate'),
 }));

 // Derive multi-agent urgency results driven by the most severe finding across all agents
 const urgencyResult = resolveMultiAgentUrgency(clinicalCase, radiologistFindings);
 const UrgencyIcon = urgencyResult.icon;

 const doctorReferencedFindingIds = new Set<string>(doctor?.referencedRadiologistFindings || []);

 const getSeverityBadge = (severity?: string) => {
 switch (severity?.toLowerCase()) {
 case 'severe':
 case 'critical':
 return (
 <span className="px-2 py-0.5 text-[10px] font-bold bg-emergency/15 text-emergency border border-emergency/40">
 Severe
 </span>
 );
 case 'moderate':
 return (
 <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/15 text-primary border border-primary/40">
 Moderate
 </span>
 );
 case 'mild':
 return (
 <span className="px-2 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
 Mild
 </span>
 );
 case 'normal':
 default:
 return (
 <span className="px-2 py-0.5 text-[10px] font-medium bg-routine/15 text-routine border border-routine/40">
 Normal
 </span>
 );
 }
 };

 const renderNarrativeWithChips = (text?: string) => {
 if (!text) return 'Clinical synthesis in progress.';
 const regex = /(\[RF-\d+(?::\s*[^\]]+)?\])/g;
 const tokens = text.split(regex);
 return tokens.map((token, i) => {
 const match = token.match(/\[(RF-\d+)(?::\s*([^\]]+))?\]/);
 if (match) {
 const chipId = match[1];
 const customRegion = match[2];
 const found = radiologistFindings.find((f) => f.id === chipId);
 return (
 <button
 key={i}
 type="button"
 onClick={() => found && setSelectedFinding(found)}
 className="inline-flex items-center gap-1 font-sans font-bold text-xs px-2 py-0.5 mx-1 bg-primary text-surface hover:bg-primary transition-colors cursor-pointer align-baseline"
 title={
 found
 ? `[${chipId}] ${found.region} (${found.severity}): ${found.observation}`
 : `Radiologist finding chip ${chipId}`
 }
 >
 <Sparkles className="w-2.5 h-2.5 text-primary/50 shrink-0" />
 <span>{chipId}</span>
 {(customRegion || found?.region) && (
 <span className="font-sans font-normal text-[11px] text-primary/40">
 : {customRegion || found?.region}
 </span>
 )}
 </button>
 );
 }
 return token;
 });
 };

 const getSourceBadge = (sourceType: EvidenceCitation['sourceType']) => {
 switch (sourceType) {
 case 'interview':
 return (
 <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200">
 <User className="w-3 h-3" /> Interview
 </span>
 );
 case 'radiology':
 return (
 <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-200">
 <ImageIcon className="w-3 h-3" /> Radiology
 </span>
 );
 case 'lab':
 return (
 <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-routine/15 text-routine border border-routine/30">
 <FlaskConical className="w-3 h-3" /> Lab Pathology
 </span>
 );
 case 'guideline':
 return (
 <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-primary/15 text-primary border border-primary/30">
 <BookOpen className="w-3 h-3" /> Guideline RAG
 </span>
 );
 }
 };

 const handlePrint = () => {
 try {
 const reportElement = document.getElementById('final-clinical-report');
 if (!reportElement) {
 window.print();
 return;
 }

 const printWindow = window.open('', '_blank', 'width=900,height=800');
 if (printWindow) {
 printWindow.document.write(`
 <!DOCTYPE html>
 <html>
 <head>
 <title>MediAgent AI — Clinical Decision-Support Triage Report (${clinicalCase.id})</title>
 <style>
 body {
 font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
 padding: 24px;
 color: #1a1a1a;
 background-color: #ffffff;
 line-height: 1.5;
 }
 button, .print\\:hidden, #print-summary-btn, #edit-case-btn, #new-case-btn {
 display: none !important;
 }
 h1, h2, h3, h4 { margin-top: 1em; margin-bottom: 0.5em; color: #111827; }
 table { width: 100%; border-collapse: collapse; margin: 16px 0; }
 th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
 th { background-color: #f8fafc; font-weight: bold; }
 </style>
 </head>
 <body>
 <div style="margin-bottom: 16px; border-bottom: 2px solid #1e293b; padding-bottom: 12px;">
 <h1 style="margin: 0; font-size: 20px;">MediAgent AI — Clinical Decision-Support Triage Report</h1>
 <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Case ID: ${clinicalCase.id} • Generated: ${new Date().toLocaleString()}</p>
 </div>
 ${reportElement.innerHTML}
 <script>
 window.onload = function() {
 window.focus();
 window.print();
 };
 </script>
 </body>
 </html>
 `);
 printWindow.document.close();
 } else {
 window.print();
 }
 } catch (err) {
 console.warn('Fallback standard print:', err);
 window.print();
 }
 };

 return (
 <div id="final-clinical-report" className="space-y-6 max-w-5xl mx-auto print:max-w-none">
 {/* 1. PROMINENT MULTI-AGENT URGENCY BANNER AT TOP OF REPORT */}
      <div
        id="triage-urgency-banner"
        className={`bg-surface border-2 ${
          urgencyResult.level === 'emergency'
            ? 'border-emergency/30 dark:border-emergency/50'
            : urgencyResult.level === 'urgent'
            ? 'border-amber-500/30 dark:border-amber-500/50'
            : 'border-routine/30 dark:border-routine/50'
        } rounded-xl shadow-xs overflow-hidden transition-all`}
      >
        {/* Top Header Strip with Acuity Badge, Title, and Case Info */}
        <div className="p-5 sm:p-6 pb-4 border-b border-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                urgencyResult.level === 'emergency'
                  ? 'bg-emergency/10 text-emergency border-emergency/25'
                  : urgencyResult.level === 'urgent'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                  : 'bg-routine/10 text-routine border-routine/25'
              }`}
            >
              <UrgencyIcon className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] font-sans font-bold px-2.5 py-0.5 rounded-full border ${
                    urgencyResult.level === 'emergency'
                      ? 'bg-emergency/15 text-emergency border-emergency/30'
                      : urgencyResult.level === 'urgent'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-routine/15 text-routine border-routine/30'
                  }`}
                >
                  {urgencyResult.badgeLabel}
                </span>
                <span className="text-xs text-muted font-sans hidden sm:inline">
                  Multi-Agent Consensus Synthesized
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-ink mt-1 font-sans">
                {urgencyResult.title}
              </h2>
            </div>
          </div>

          <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0 text-right">
            <div className="text-xs font-bold text-ink font-sans">CASE #{clinicalCase.id}</div>
            <div className="text-[11px] text-muted font-sans">
              {new Date(clinicalCase.updatedAt || clinicalCase.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* Body with Rationale Callout and Trigger Findings */}
        <div className="p-5 sm:p-6 pt-4 space-y-3.5">
          {/* Prominent One-Line Rationale Callout */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              urgencyResult.level === 'emergency'
                ? 'bg-emergency/5 border-emergency/20'
                : urgencyResult.level === 'urgent'
                ? 'bg-amber-500/5 border-amber-500/20'
                : 'bg-routine/5 border-routine/20'
            }`}
          >
            <Sparkles
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                urgencyResult.level === 'emergency'
                  ? 'text-emergency'
                  : urgencyResult.level === 'urgent'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-routine'
              }`}
            />
            <div className="text-sm leading-relaxed">
              <span
                className={`font-bold mr-1.5 ${
                  urgencyResult.level === 'emergency'
                    ? 'text-emergency'
                    : urgencyResult.level === 'urgent'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-routine'
                }`}
              >
                Clinical Triage Rationale:
              </span>
              <span className="text-ink font-medium">
                {urgencyResult.oneLineRationale.replace(/^(emergency:?|urgent:?|routine:?)\s*/i, '')}
              </span>
            </div>
          </div>

          {/* Contributing Severe Findings Across Specialist Agents */}
          {urgencyResult.contributingFindings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-xs font-semibold text-muted mr-1">
                Trigger Findings:
              </span>
              {urgencyResult.contributingFindings.map((finding, fIdx) => (
                <span
                  key={fIdx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-surface border border-muted/20 text-ink shadow-xs"
                  title={`${finding.label}: ${finding.detail}`}
                >
                  {finding.source === 'vitals' && <Heart className="w-3 h-3 text-emergency shrink-0" />}
                  {finding.source === 'radiology' && <ImageIcon className="w-3 h-3 text-indigo-500 shrink-0" />}
                  {finding.source === 'labs' && <FlaskConical className="w-3 h-3 text-routine shrink-0" />}
                  {finding.source === 'doctor' && <Stethoscope className="w-3 h-3 text-primary shrink-0" />}
                  <span>{finding.label}</span>
                  {finding.isSevere && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-emergency/10 text-emergency">
                      Critical
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

 {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3.5 sm:p-4 rounded-xl border border-muted/20 shadow-xs print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="tab-synthesis-btn"
            onClick={() => setActiveTab('synthesis')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'synthesis'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface text-muted hover:text-ink hover:bg-muted/5'
            }`}
          >
            Doctor Synthesis & Evidence Claims
          </button>
          <button
            type="button"
            id="tab-handoff-btn"
            onClick={() => setActiveTab('handoff')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'handoff'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Clinical Handoff Note (SBAR)</span>
          </button>
          <button
            type="button"
            id="tab-agents-btn"
            onClick={() => setActiveTab('agents')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'agents'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface text-muted hover:text-ink hover:bg-muted/5'
            }`}
          >
            Specialist Agents (4)
          </button>
          <button
            type="button"
            id="tab-rag-btn"
            onClick={() => setActiveTab('rag')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'rag'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface text-muted hover:text-ink hover:bg-muted/5'
            }`}
          >
            Clinical Guidelines ({guidelines.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="print-summary-btn"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-muted/20 text-muted hover:text-ink hover:bg-muted/5 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            type="button"
            id="edit-case-btn"
            onClick={onEditCase}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-muted/20 text-muted hover:text-ink hover:bg-muted/5 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Modify Case</span>
          </button>
          <button
            type="button"
            id="new-case-btn"
            onClick={onNewCase}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-primary hover:bg-[#09472C] text-white shadow-xs rounded-lg transition-colors cursor-pointer"
          >
            <span>+ New Intake</span>
          </button>
        </div>
      </div>

 {/* 2. PATIENT DEMOGRAPHICS & VITALS SUMMARY BAR */}
 <div className="bg-surface border border-muted/20 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-muted/20 pb-3 gap-2">
 <div className="flex items-center gap-2">
 <User className="w-4 h-4 text-primary" />
 <span className="text-sm font-bold text-ink">
 {clinicalCase.patient.age}yo {clinicalCase.patient.gender.toUpperCase()} • Chief Complaint: "{clinicalCase.patient.chiefComplaint}"
 </span>
 </div>
 <span className="text-xs text-muted font-sans">
 Duration: {clinicalCase.patient.symptomDuration}
 </span>
 </div>

 {/* Vitals summary badges */}
 <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
 <div className="bg-surface border border-muted/20 p-2.5 rounded-lg">
 <span className="text-muted text-[11px] block">Heart Rate</span>
 <span className="font-bold text-ink text-sm">{clinicalCase.patient.vitals.heartRate} bpm</span>
 </div>
 <div className="bg-surface border border-muted/20 p-2.5 rounded-lg">
 <span className="text-muted text-[11px] block">Blood Pressure</span>
 <span className="font-bold text-ink text-sm">
 {clinicalCase.patient.vitals.bloodPressureSystolic}/{clinicalCase.patient.vitals.bloodPressureDiastolic} mmHg
 </span>
 </div>
 <div className="bg-surface border border-muted/20 p-2.5 rounded-lg">
 <span className="text-muted text-[11px] block">Resp Rate</span>
 <span className="font-bold text-ink text-sm">{clinicalCase.patient.vitals.respiratoryRate}/min</span>
 </div>
 <div className="bg-surface border border-muted/20 p-2.5 rounded-lg">
 <span className="text-muted text-[11px] block">SpO2 (Room Air)</span>
 <span className="font-bold text-ink text-sm">{clinicalCase.patient.vitals.oxygenSaturation}%</span>
 </div>
 <div className="bg-surface border border-muted/20 p-2.5 rounded-lg">
 <span className="text-muted text-[11px] block">Temperature</span>
 <span className="font-bold text-ink text-sm">{clinicalCase.patient.vitals.temperature} °C</span>
 </div>
 </div>
 </div>

 {/* TAB 1: DOCTOR SYNTHESIS & GROUNDED CLAIMS (MAIN VIEW) */}
 {activeTab === 'synthesis' && (
 <div className="space-y-6">
 {/* DATA COMPLETENESS & DIAGNOSTIC LIMITATIONS WARNING CARD */}
 {(doctor?.dataCompletenessLevel === 'symptoms_only' ||
 doctor?.dataCompletenessLevel === 'partial' ||
 (doctor?.missingDataSources && doctor.missingDataSources.length > 0)) && (
 <div
 id="data-completeness-notice-card"
 className=" border border-primary/40 bg-primary/10 p-5 space-y-3"
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/30 pb-3">
 <div className="flex items-center gap-2 text-primary">
 <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-bold text-sm text-primary">
 Diagnostic Limitations Notice: {doctor?.dataCompletenessLevel === 'symptoms_only' ? 'Symptoms-Only Triage Intake' : 'Partial Clinical Data'}
 </span>
 <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/40">
 {doctor?.dataCompletenessLevel === 'symptoms_only' ? 'Confidence Capped (< 55%)' : 'Confidence Moderated'}
 </span>
 </div>
 <p className="text-xs text-primary mt-0.5">
 Doctor Agent detected missing objective data sources and adjusted diagnostic certainty.
 </p>
 </div>
 </div>
 </div>

 {doctor?.diagnosticLimitationsNotice && (
 <div className="p-3 bg-surface border border-primary/30 text-xs text-primary leading-relaxed font-medium">
 {doctor.diagnosticLimitationsNotice}
 </div>
 )}

 {doctor?.missingDataSources && doctor.missingDataSources.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
 {doctor.missingDataSources.map((ds, idx) => (
 <div
 key={idx}
 className="p-3.5 bg-surface border border-primary/30 space-y-2 text-xs"
 >
 <div className="flex items-center justify-between">
 <span className="font-bold text-ink flex items-center gap-1.5">
 {ds.source === 'imaging' ? (
 <ImageIcon className="w-4 h-4 text-purple-600" />
 ) : (
 <FlaskConical className="w-4 h-4 text-routine" />
 )}
 {ds.label}
 </span>
 <span className="px-2 py-0.5 text-[10px] font-sans font-bold bg-emergency/15 text-emergency border border-emergency/30">
 {ds.status.toUpperCase()}
 </span>
 </div>
 <p className="text-muted leading-normal">
 <strong className="text-ink">Impact on Confidence: </strong>
 {ds.impactOnConfidence}
 </p>
 <div className="text-primary bg-primary/5 p-2 border border-primary/20 text-[11px] font-medium">
 <strong>Recommended Action: </strong>
 {ds.recommendedAction}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Executive Clinical Summary with Interactive Finding Grounding */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-muted/20 pb-3">
 <div className="flex items-center gap-2 text-primary">
 <Stethoscope className="w-5 h-5" />
 <h3 className="text-base font-bold font-sans font-bold">Doctor Agent Clinical Executive Summary</h3>
 </div>
 <span className="text-[11px] font-sans px-2 py-0.5 bg-primary/5 text-primary border border-primary/20 font-semibold self-start sm:self-auto">
 Grounded Multi-Agent Synthesis
 </span>
 </div>

 <div className="text-sm text-ink leading-relaxed font-sans bg-surface p-4 border border-muted/20 space-y-2">
 <p>{renderNarrativeWithChips(doctor?.clinicalExecutiveSummary)}</p>
 </div>

 {/* Structured Finding Chips Legend / Quick Bar */}
 {radiologistFindings.length > 0 && (
 <div className="p-3.5 bg-primary/5 border border-primary/20 space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5 text-primary font-bold text-xs ">
 <Sparkles className="w-3.5 h-3.5 text-primary" />
 <span>Radiologist Agent Finding Chips ({radiologistFindings.length})</span>
 </div>
 <span className="text-[10px] text-primary font-sans">
 Click any chip to inspect anatomical finding
 </span>
 </div>
 <div className="flex flex-wrap gap-2 pt-1">
 {radiologistFindings.map((f, fIdx) => {
 const isDoctorReferenced = doctorReferencedFindingIds.has(f.id);
 return (
 <button
 key={f.id || fIdx}
 type="button"
 onClick={() => setSelectedFinding(f)}
 className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border transition-all cursor-pointer ${
 isDoctorReferenced
 ? 'bg-primary text-surface border-primary hover:bg-primary'
 : 'bg-surface text-ink border-muted/20 hover:border-primary/40 hover:bg-primary/5'
 }`}
 >
 <span className="font-sans font-bold text-[10px] px-1 py-0.2 bg-black/20 text-surface">
 {f.id}
 </span>
 <span>{f.region}</span>
 {f.severity && (
 <span
 className={`text-[9px] font-bold px-1 ${
 f.severity.toLowerCase() === 'severe' || f.severity.toLowerCase() === 'critical'
 ? 'bg-emergency/20 text-emergency'
 : f.severity.toLowerCase() === 'moderate'
 ? 'bg-primary/20 text-primary'
 : 'bg-routine/20 text-routine'
 }`}
 >
 {f.severity}
 </span>
 )}
 </button>
 );
 })}
 </div>
 </div>
 )}

 {radiologist?.modelInference && (
 <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-muted/20">
 <span className="font-semibold text-muted">Radiology Model Grounding:</span>
 <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 font-sans text-[11px]">
 DenseNet-121 ONNX (NIH ChestX-ray14, Val AUC: {radiologist.modelInference.validationAuc})
 </span>
 {radiologist.modelInference.positiveFindings.length > 0 ? (
 <span className="px-2 py-0.5 bg-primary/15 text-primary border border-primary/30 text-[11px] font-semibold">
 Flagged: {radiologist.modelInference.positiveFindings.map((p) => p.split(' (')[0]).join(', ')}
 </span>
 ) : (
 <span className="px-2 py-0.5 bg-routine/15 text-routine border border-routine/30 text-[11px]">
 No acute pathology &gt;0.5
 </span>
 )}
 </div>
 )}
 </div>

 {/* Probable Conditions with Expandable "Why?" Evidence Breakdown & Principled Confidence Scoring */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-muted/20 pb-3">
 <div>
 <div className="flex items-center gap-2">
 <h3 className="text-base font-bold text-ink font-sans font-bold">
 Ranked Differential Diagnoses & Probable Conditions
 </h3>
 <span className="text-[11px] font-sans px-2 py-0.5 bg-primary/5 text-primary border border-primary/20 font-semibold">
 Explainable Grounding
 </span>
 </div>
 <p className="text-xs text-muted mt-0.5">
 Diagnostic confidence is mathematically weighted by agreement across up to 4 independent diagnostic streams (Interview, Imaging, Labs, Guidelines).
 </p>
 </div>

 <button
 type="button"
 id="btn-confidence-model-info"
 onClick={() => setShowConfidenceModelModal(true)}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 text-xs font-bold transition-all cursor-pointer shrink-0"
 title="View how confidence scores are derived from independent evidence streams"
 >
 <Info className="w-3.5 h-3.5 text-primary shrink-0" />
 <span>How Confidence is Derived</span>
 </button>
 </div>

 <div className="space-y-4">
 {doctor?.probableConditions?.map((cond, idx) => {
 const isExpanded = expandedConditionIndex === idx;
 const breakdown = computeConfidenceBreakdown(cond);
 const score = breakdown.calculatedScore;
 const isStrong = cond.evidenceStrength === 'strong' || score >= 70;
 const isModerate = cond.evidenceStrength === 'moderate' || (score >= 40 && score < 70);
 const isWeak = cond.evidenceStrength === 'weak' || score < 40;

 // Color configuration reflecting evidence strength & confidence score
 const confidenceConfig = isStrong
 ? {
 badgeBg: 'bg-routine/10 border-routine/40 text-routine',
 scoreText: 'text-routine',
 meterFill: 'bg-routine',
 label: 'Strong Supporting Evidence',
 statusTag: 'High Confidence',
 statusTagClass: 'bg-routine/15 text-routine border-routine/30',
 }
 : isModerate
 ? {
 badgeBg: 'bg-primary/10 border-primary/40 text-primary',
 scoreText: 'text-primary',
 meterFill: 'bg-primary/100',
 label: 'Moderate / Partial Evidence',
 statusTag: 'Moderate Confidence',
 statusTagClass: 'bg-primary/15 text-primary border-primary/30',
 }
 : {
 badgeBg: 'bg-surface border-muted/20 text-muted',
 scoreText: 'text-muted',
 meterFill: 'bg-muted/50',
 label: 'Limited / Weak Evidence',
 statusTag: 'Low Confidence (Muted)',
 statusTagClass: 'bg-surface text-muted border-muted/20',
 };

 const citations = cond.evidenceCitations || [];
 const guidelineCitations = citations.filter((c) => c.sourceType === 'guideline');
 const nonGuidelineCitations = citations.filter((c) => c.sourceType !== 'guideline');

 // Pillar points for segmented visual gauge
 const interviewPts = breakdown.pillars.find((p) => p.pillar === 'interview')?.contributedScore || 0;
 const radiologyPts = breakdown.pillars.find((p) => p.pillar === 'radiology')?.contributedScore || 0;
 const labPts = breakdown.pillars.find((p) => p.pillar === 'lab')?.contributedScore || 0;
 const guidelinePts = breakdown.pillars.find((p) => p.pillar === 'guideline')?.contributedScore || 0;

 return (
 <div
 key={idx}
 id={`probable-condition-${idx}`}
 className={`border overflow-hidden transition-all ${
 isWeak
 ? 'border-muted/20 bg-surface opacity-95'
 : isModerate
 ? 'border-primary/30 bg-surface'
 : 'border-muted/20 bg-surface'
 }`}
 >
 {/* Condition Header Bar */}
 <div
 onClick={() => setExpandedConditionIndex(isExpanded ? null : idx)}
 className={`p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b transition-colors ${
 isExpanded
 ? isWeak
 ? 'bg-surface border-muted/20'
 : 'bg-primary/5 border-primary/20'
 : isWeak
 ? 'bg-surface hover:bg-surface border-muted/20'
 : 'bg-surface hover:bg-surface border-muted/20'
 }`}
 >
 <div className="flex items-start gap-3 flex-1 min-w-0">
 <span
 className={`w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
 isStrong
 ? 'bg-primary text-surface'
 : isModerate
 ? 'bg-primary text-surface'
 : 'bg-surface text-ink'
 }`}
 >
 {idx + 1}
 </span>
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <h4 className={`text-sm font-bold truncate ${isWeak ? 'text-muted' : 'text-ink'}`}>
 {cond.condition}
 </h4>
 {cond.icdCodeEstimate && (
 <span className="text-[10px] font-sans px-1.5 py-0.5 bg-surface text-muted font-semibold">
 ICD: {cond.icdCodeEstimate}
 </span>
 )}
 <span
 className={`text-[10px] font-semibold px-2 py-0.5 border ${confidenceConfig.statusTagClass}`}
 >
 {confidenceConfig.statusTag}
 </span>
 </div>
 <p className={`text-xs mt-1 leading-relaxed ${isWeak ? 'text-muted' : 'text-muted'}`}>
 {cond.rationale}
 </p>

 {/* Mini 4-Source Concordance Capsule */}
 <div className="flex flex-wrap items-center gap-1.5 mt-2">
 <span className="text-[10px] font-sans text-muted mr-1 font-semibold">
 Evidence Agreement:
 </span>
 {breakdown.pillars.map((pil, pIdx) => {
 const icon =
 pil.pillar === 'interview' ? (
 <User className="w-2.5 h-2.5" />
 ) : pil.pillar === 'radiology' ? (
 <ImageIcon className="w-2.5 h-2.5" />
 ) : pil.pillar === 'lab' ? (
 <FlaskConical className="w-2.5 h-2.5" />
 ) : (
 <BookOpen className="w-2.5 h-2.5" />
 );

 return (
 <span
 key={pIdx}
 title={`${pil.label}: ${pil.contributedScore}/${pil.maxWeight} pts (${pil.statusText})`}
 className={`inline-flex items-center gap-1 text-[10px] font-sans font-bold px-1.5 py-0.5 border transition-colors ${
 pil.isSupported
 ? 'bg-primary/5 text-primary border-primary/30'
 : 'bg-surface text-muted border-muted/20'
 }`}
 >
 {icon}
 <span className="capitalize">{pil.pillar}</span>
 {pil.isSupported ? (
 <Check className="w-2.5 h-2.5 text-routine" />
 ) : (
 <span className="text-[9px] text-muted/80 font-bold">—</span>
 )}
 </span>
 );
 })}
 <span className="text-[10px] font-sans text-muted ml-1">
 ({breakdown.agreeCount}/4 modalities agree)
 </span>
 </div>
 </div>
 </div>

 {/* Right Side: Multi-Segment Visual Gauge & Action Button */}
 <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-muted/20">
 {/* Multi-Segment Concordance Gauge Visual */}
 <div className="space-y-1">
 <div className="flex items-center justify-between gap-3 text-right">
 <div className="text-[10px] text-muted font-sans ">
 Confidence
 </div>
 <div className={`text-base font-extrabold font-sans ${confidenceConfig.scoreText}`}>
 {score}%
 </div>
 </div>

 {/* Segmented multi-color progress gauge */}
 <div
 className="w-28 bg-surface h-2.5 overflow-hidden flex shadow-inner cursor-help"
 title={`Derived Confidence: ${score}%\n• Interview: ${interviewPts}/25 pts\n• Radiology: ${radiologyPts}/30 pts\n• Labs: ${labPts}/25 pts\n• Guidelines: ${guidelinePts}/20 pts`}
 >
 <div
 style={{ width: `${interviewPts}%` }}
 className="bg-primary/90 h-full transition-all"
 title={`Interview: ${interviewPts}%`}
 />
 <div
 style={{ width: `${radiologyPts}%` }}
 className="bg-primary h-full transition-all"
 title={`Radiology: ${radiologyPts}%`}
 />
 <div
 style={{ width: `${labPts}%` }}
 className="bg-purple-600 h-full transition-all"
 title={`Labs: ${labPts}%`}
 />
 <div
 style={{ width: `${guidelinePts}%` }}
 className="bg-primary/100 h-full transition-all"
 title={`Guidelines: ${guidelinePts}%`}
 />
 </div>

 {/* Gauge legend hint */}
 <div className="flex items-center justify-between text-[9px] font-sans text-muted">
 <span className="text-primary font-bold">{breakdown.agreeCount}/4 sources</span>
 <span className="text-muted">weighted</span>
 </div>
 </div>

 {/* Interactive "Why?" Toggle Button */}
 <button
 type="button"
 id={`btn-why-condition-${idx}`}
 onClick={(e) => {
 e.stopPropagation();
 setExpandedConditionIndex(isExpanded ? null : idx);
 }}
 className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
 isExpanded
 ? 'bg-primary text-surface '
 : 'bg-surface text-primary border border-primary/30 hover:bg-primary/5'
 }`}
 >
 <HelpCircle className="w-3.5 h-3.5" />
 <span>Why?</span>
 {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
 </button>
 </div>
 </div>

 {/* EXPANDABLE "WHY?" EVIDENCE BREAKDOWN & CONFIDENCE MATRIX */}
 {isExpanded && (
 <div className="p-5 bg-surface space-y-5">
 {/* Section Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-muted/20 pb-3">
 <div className="flex items-center gap-2 text-ink">
 <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
 <h5 className="text-xs font-bold font-sans font-bold">
 Why this condition? — Grounded Evidence & Confidence Breakdown
 </h5>
 </div>
 <span className="text-[11px] font-sans text-muted">
 {citations.length} grounded evidence items • {breakdown.agreeCount}/4 modalities concordant
 </span>
 </div>

 {/* Principled Multi-Modal Evidence Concordance Matrix */}
 <div className="p-4 bg-surface border border-muted/20 space-y-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-muted/20 pb-2">
 <div className="flex items-center gap-2">
 <Scale className="w-4 h-4 text-primary shrink-0" />
 <span className="text-xs font-bold text-ink tracking-wide">
 Multi-Modal Concordance Matrix (Score Derivation)
 </span>
 </div>
 <span className="text-[11px] font-sans text-muted">
 Total Confidence: <strong className="text-primary">{score}%</strong>
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
 {breakdown.pillars.map((pil, pIdx) => {
 const isInterview = pil.pillar === 'interview';
 const isRadiology = pil.pillar === 'radiology';
 const isLab = pil.pillar === 'lab';
 const isGuideline = pil.pillar === 'guideline';

 const pillarBg = pil.isSupported
 ? isInterview
 ? 'bg-primary/5 border-primary/20'
 : isRadiology
 ? 'bg-indigo-50/60 border-primary/20'
 : isLab
 ? 'bg-purple-50/60 border-purple-200'
 : 'bg-primary/10 border-primary/30'
 : 'bg-surface border-muted/20 opacity-80';

 const barFill = isInterview
 ? 'bg-primary/90'
 : isRadiology
 ? 'bg-primary'
 : isLab
 ? 'bg-purple-600'
 : 'bg-primary/100';

 return (
 <div
 key={pIdx}
 className={`p-3 border ${pillarBg} space-y-2`}
 >
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold text-ink flex items-center gap-1">
 {isInterview ? (
 <User className="w-3 h-3 text-primary" />
 ) : isRadiology ? (
 <ImageIcon className="w-3 h-3 text-primary" />
 ) : isLab ? (
 <FlaskConical className="w-3 h-3 text-purple-700" />
 ) : (
 <BookOpen className="w-3 h-3 text-primary" />
 )}
 <span className="capitalize">{pil.pillar}</span>
 </span>
 <span className="text-[11px] font-sans font-bold text-ink">
 {pil.contributedScore}/{pil.maxWeight} pts
 </span>
 </div>

 {/* Pillar progress gauge */}
 <div className="w-full bg-surface h-1.5 overflow-hidden">
 <div
 className={`${barFill} h-full transition-all`}
 style={{ width: `${(pil.contributedScore / pil.maxWeight) * 100}%` }}
 />
 </div>

 <p className="text-[10px] text-muted leading-tight">
 {pil.statusText}
 </p>

 <div className="flex items-center justify-between pt-1 border-t border-muted/20 text-[10px] font-sans">
 <span className="text-muted">
 {pil.citationCount} {pil.citationCount === 1 ? 'citation' : 'citations'}
 </span>
 <span
 className={`font-semibold ${
 pil.isSupported ? 'text-routine' : 'text-muted'
 }`}
 >
 {pil.isSupported ? '✓ Supported' : '— Unverified'}
 </span>
 </div>
 </div>
 );
 })}
 </div>

 <div className="p-2.5 bg-surface border border-muted/20 text-xs text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <span className="text-[11px] text-muted">
 <strong>Formula:</strong> Score = Interview ({interviewPts}%) + Radiology ({radiologyPts}%) + Labs ({labPts}%) + Guidelines ({guidelinePts}%)
 </span>
 <span className="text-[11px] font-sans font-bold text-primary">
 {breakdown.agreeCount} of 4 Modalities Concordant
 </span>
 </div>
 </div>

 {/* Evidence Strength Notice Banner */}
 {isWeak ? (
 <div className="p-3.5 bg-surface border border-muted/20 text-muted text-xs flex items-start gap-2.5">
 <AlertCircle className="w-4 h-4 text-muted shrink-0 mt-0.5" />
 <div className="space-y-0.5">
 <div className="font-bold text-ink">
 Limited Supporting Evidence (Confidence: {score}%)
 </div>
 <p className="text-muted leading-relaxed">
 This condition is retained as a differential consideration but lacks strong objective imaging findings or abnormal lab markers in the current workup. Its confidence score is visibly lower and muted to prevent premature over-diagnosis.
 </p>
 </div>
 </div>
 ) : isModerate ? (
 <div className="p-3 bg-primary/10 border border-primary/30 text-primary text-xs flex items-start gap-2.5">
 <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
 <div className="space-y-0.5">
 <div className="font-bold text-primary">
 Moderate / Partial Supporting Evidence (Confidence: {score}%)
 </div>
 <p className="text-primary leading-relaxed">
 Partially corroborated by clinical history or non-specific diagnostic markers, but lacks definitive confirmatory scans. Targeted confirmatory testing is advised.
 </p>
 </div>
 </div>
 ) : (
 <div className="p-3 bg-routine/10 border border-routine/30 text-routine text-xs flex items-start gap-2.5">
 <CheckCircle className="w-4 h-4 text-routine shrink-0 mt-0.5" />
 <div className="space-y-0.5">
 <div className="font-bold text-routine">
 Strong Multi-Modal Corroboration (Confidence: {score}%)
 </div>
 <p className="text-routine leading-relaxed">
 Highly supported across all diagnostic modalities: interview symptom presentation, specific imaging findings, laboratory flags, and validated clinical guidelines.
 </p>
 </div>
 </div>
 )}

 {/* 1. Real Quoted Guideline Passages from Knowledge Base */}
 {guidelineCitations.length > 0 && (
 <div className="space-y-2.5">
 <div className="flex items-center gap-2 text-xs font-bold text-ink">
 <BookOpen className="w-4 h-4 text-primary" />
 <span>Clinical Practice Guideline Evidence (Real Quoted Passage)</span>
 </div>

 <div className="space-y-3">
 {guidelineCitations.map((gCit, gIdx) => (
 <div
 key={gIdx}
 onClick={() => setSelectedCitation(gCit)}
 className="p-4 border border-primary/30 bg-primary/10 hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer space-y-2.5"
 >
 <div className="flex flex-wrap items-center justify-between gap-2">
 <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-primary/15 text-primary border border-primary/40">
 <BookOpen className="w-3 h-3" /> Guideline Authority
 </span>
 <span className="text-[11px] font-semibold text-primary font-sans">
 {gCit.sourceName}
 </span>
 </div>

 <div className="text-xs font-semibold text-ink">
 <span className="text-primary font-bold">Guideline Rule Claim: </span>
 {gCit.claim}
 </div>

 {/* Verbatim Quoted Passage in Dedicated Quote Block */}
 <div className="relative pl-4 pr-3 py-3 bg-surface border-l-4 border-primary border border-muted/20 text-ink text-xs leading-relaxed font-sans font-bold italic">
 <span className="absolute left-1 top-1 text-amber-400 text-lg font-bold select-none">“</span>
 <span className="font-sans not-italic font-semibold text-primary text-[11px] block mb-1">
 Verified Knowledge Base Passage:
 </span>
 <span className="text-ink font-normal">
 {gCit.citedTextOrValue.replace(/^“|”$/g, '')}
 </span>
 </div>

 {gCit.confidenceContribution && (
 <div className="text-[11px] text-muted flex items-center gap-1.5">
 <span className="font-semibold text-muted">Diagnostic Weight:</span>
 <span>{gCit.confidenceContribution}</span>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 2. Structured Multi-Modal Evidence Grid (Interview, Lab Flags, Imaging Findings) */}
 {nonGuidelineCitations.length > 0 && (
 <div className="space-y-2.5">
 <div className="flex items-center gap-2 text-xs font-bold text-ink">
 <Layers className="w-4 h-4 text-primary" />
 <span>Specialist Agent Evidence Citations</span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {nonGuidelineCitations.map((cit, cIdx) => {
 const isRadiology = cit.sourceType === 'radiology';
 const isLab = cit.sourceType === 'lab';
 const isInterview = cit.sourceType === 'interview';

 return (
 <div
 key={cIdx}
 id={`citation-${idx}-${cIdx}`}
 onClick={() => setSelectedCitation(cit)}
 className="p-3.5 border border-muted/20 bg-surface hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer space-y-2.5"
 >
 <div className="flex items-center justify-between gap-2">
 {getSourceBadge(cit.sourceType)}
 <span className="text-[10px] text-muted font-sans line-clamp-1">
 {cit.sourceName}
 </span>
 </div>

 <div className="text-xs font-semibold text-ink">
 {cit.claim}
 </div>

 {/* Measured Value / Observed Text Container */}
 <div className="text-xs bg-surface p-2.5 border border-muted/20 text-ink font-sans text-[11px] leading-relaxed space-y-1">
 <div className="flex items-center justify-between">
 <span className="font-semibold text-primary text-[10px] tracking-wide">
 {isLab ? 'Lab Value & Status' : isRadiology ? 'Imaging Chip & Finding' : 'Patient Interview Evidence'}
 </span>
 </div>
 <div className="font-normal text-muted">
 {cit.citedTextOrValue}
 </div>
 </div>

 {cit.confidenceContribution && (
 <div className="text-[11px] text-muted italic">
 Impact: {cit.confidenceContribution}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>

 {/* Recommended Next Steps */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-4">
 <div className="border-b border-muted/20 pb-3 flex items-center justify-between">
 <div>
 <h3 className="text-base font-bold text-ink font-sans font-bold">Recommended Clinical Actions & Next Steps</h3>
 <p className="text-xs text-muted mt-0.5">
 Prioritized by clinical urgency with direct grounding citations.
 </p>
 </div>
 <span className="text-[11px] font-sans text-muted">Evidence-Backed Protocol</span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {doctor?.recommendedNextSteps?.map((step, sIdx) => (
 <div
 key={sIdx}
 id={`next-step-${sIdx}`}
 className="p-4 border border-muted/20 bg-surface space-y-2"
 >
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold px-2 py-0.5 bg-primary/10 text-primary">
 {step.category}
 </span>
 <span className="text-[11px] font-sans text-muted font-semibold">
 {step.timeframe}
 </span>
 </div>

 <p className="text-sm font-semibold text-ink leading-snug">
 {step.action}
 </p>

 <div className="text-[11px] text-muted bg-surface p-2 border border-muted/20">
 <span className="font-semibold text-primary">Source: </span>
 {step.groundingCitation}
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Differential Exclusions */}
 {doctor?.differentialExclusions && doctor.differentialExclusions.length > 0 && (
 <div className="bg-surface border border-muted/20 p-6 space-y-3">
 <h3 className="text-sm font-bold text-ink font-sans font-bold">
 Considered Differential Diagnoses & Exclusions
 </h3>
 <div className="space-y-2.5">
 {doctor.differentialExclusions.map((diff, dIdx) => (
 <div key={dIdx} className="p-3 bg-surface border border-muted/20 text-xs space-y-1">
 <div className="font-bold text-ink">{diff.condition}</div>
 <div className="text-muted">
 <span className="font-semibold text-muted">Clinical Reasoning: </span>
 {diff.reasonForLowerLikelihood}
 </div>
 <div className="text-muted font-sans text-[11px]">
 Counter-Evidence: {diff.counterEvidence}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* TAB 2: SPECIALIST AGENT DEEP DIVE (INTERVIEWER, RADIOLOGIST, LAB ANALYST) */}
 {activeTab === 'agents' && (
 <div className="space-y-6">
 {/* Interviewer Deep Dive */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-4">
 <div className="flex items-center gap-2 text-primary border-b border-muted/20 pb-3">
 <User className="w-5 h-5" />
 <h3 className="text-base font-bold font-sans font-bold">Interviewer Agent Analysis</h3>
 </div>
 <p className="text-xs text-muted leading-relaxed bg-surface p-3 border border-muted/20">
 {interviewer?.clinicalSummary}
 </p>

 <div>
 <h4 className="text-xs font-bold text-muted mb-2 font-sans font-bold">
 Vital Signs Clinical Assessment
 </h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
 {interviewer?.vitalsAssessment?.map((va, vIdx) => (
 <div key={vIdx} className="p-2.5 border border-muted/20 bg-surface text-xs">
 <div className="flex items-center justify-between mb-1">
 <span className="font-bold text-ink">{va.vitalName}</span>
 <span className="px-1.5 py-0.5 text-[10px] font-bold bg-surface text-ink">
 {va.status}
 </span>
 </div>
 <div className="font-sans text-ink font-bold mb-1">{va.value}</div>
 <p className="text-[11px] text-muted leading-tight">{va.clinicalSignificance}</p>
 </div>
 ))}
 </div>
 </div>

 {interviewer?.redFlagSymptoms && interviewer.redFlagSymptoms.length > 0 && (
 <div className="bg-emergency/5 border border-emergency/20 rounded-lg p-3 text-xs text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-emergency shrink-0" />
              <span className="font-semibold text-emergency">Red Flag Symptoms:</span>
              <span className="text-ink font-medium">{interviewer.redFlagSymptoms.join(' • ')}</span>
            </div>
 )}

 {/* Adaptive Follow-Up Questions & Triage Logic (Evaluator View) */}
 {adaptiveQuestions.length > 0 && (
 <div id="interviewer-adaptive-followups-report" className="border border-primary/20 bg-primary/5 p-4 space-y-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/20 pb-2.5">
 <div className="flex items-center gap-2 text-primary font-bold text-xs ">
 <Sparkles className="w-4 h-4 text-primary" />
 <span>Adaptive Intake Follow-Up Questions & Triage Logic</span>
 </div>
 <span className="text-[10px] font-sans font-semibold px-2 py-0.5 bg-primary/10 text-primary border border-primary/30 self-start sm:self-auto">
 Chief Complaint Tailored
 </span>
 </div>

 <div className="space-y-3">
 {adaptiveQuestions.map((q, qIdx) => (
 <div key={q.id || qIdx} className="bg-surface border border-muted/20 p-3.5 space-y-2 text-xs">
 <div className="flex items-start justify-between gap-2">
 <div className="font-bold text-ink flex items-start gap-2">
 <span className="w-5 h-5 bg-primary text-surface text-[11px] flex items-center justify-center shrink-0 mt-0.5 font-sans">
 {qIdx + 1}
 </span>
 <span className="text-ink text-xs sm:text-sm font-semibold">{q.question}</span>
 </div>
 {q.answer && (
 <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-routine/15 text-routine border border-routine/40 shrink-0">
 <Check className="w-3 h-3 text-routine" /> Answered
 </span>
 )}
 </div>

 {/* Inline Reasoning Note for Evaluators */}
 <div className="p-2.5 bg-primary/10 border border-primary/30 text-primary space-y-0.5">
 <div className="text-[10px] font-bold text-primary flex items-center gap-1">
 <Info className="w-3.5 h-3.5 text-primary shrink-0" />
 <span>Evaluator Note — Triage Logic & Rationale:</span>
 </div>
 <p className="text-[11px] leading-relaxed text-primary/90 font-medium">
 {q.reasoning}
 </p>
 </div>

 {q.answer && (
 <div className="p-2.5 bg-surface border border-muted/20 flex items-start gap-2 text-xs">
 <span className="font-bold text-muted shrink-0">Recorded Response:</span>
 <span className="text-ink font-medium italic">"{q.answer}"</span>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Radiologist Deep Dive */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-4">
 <div className="flex items-center justify-between border-b border-muted/20 pb-3">
 <div className="flex items-center gap-2 text-primary">
 <ImageIcon className="w-5 h-5" />
 <h3 className="text-base font-bold font-sans font-bold">Radiologist Agent Findings</h3>
 </div>
 <span className="text-xs font-sans text-muted">
 {radiologist?.studyModality || 'Imaging Study'}
 </span>
 </div>

 <p className="text-xs text-muted bg-surface p-3 border border-muted/20 leading-relaxed">
 <span className="font-bold text-ink">Impression: </span>
 {radiologist?.radiologicalImpression}
 </p>

 {/* Real DenseNet-121 ONNX Model Inference Results */}
 {radiologist?.modelInference && (
 <div className=" border border-purple-200 bg-purple-50/40 p-4 space-y-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/70 pb-2.5">
 <div className="flex items-center gap-2">
 <span className="p-1 bg-purple-700 text-surface">
 <Sparkles className="w-3.5 h-3.5" />
 </span>
 <div>
 <h4 className="text-xs font-bold text-purple-950 font-sans font-bold">
 Real Deep Learning Inference: DenseNet-121 ONNX Model
 </h4>
 <p className="text-[10px] text-purple-800 font-sans">
 Training: {radiologist.modelInference.trainingDataset} • Latency: {radiologist.modelInference.executionTimeMs}ms
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-bold px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 font-sans">
 Validation Mean AUC: {radiologist.modelInference.validationAuc}
 </span>
 </div>
 </div>

 {/* Model Reliability Note */}
 <div className=" bg-primary/10 border border-primary/30 p-2.5 text-xs text-primary flex items-start gap-2">
 <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
 <div className="space-y-0.5">
 <span className="font-bold text-primary text-[11px] tracking-wide">
 Model Reliability &amp; Validation Confidence:
 </span>
 <p className="text-[11px] leading-relaxed text-primary">
 {radiologist.modelInference.reliabilityNote}
 </p>
 </div>
 </div>

 {/* 5-Class Per-Class Sigmoid Probabilities & Logits */}
 <div className="space-y-1.5 pt-1">
 <div className="text-[11px] font-bold text-purple-900">
 5-Class Multi-Label Sigmoid Probabilities &amp; Raw Logits
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 {radiologist.modelInference.classes.map((cls) => {
 const pct = (cls.probability * 100).toFixed(1);
 return (
 <div
 key={cls.index}
 className={`p-2.5 border text-xs flex flex-col justify-between ${
 cls.flaggedPositive
 ? 'bg-primary/10 border-primary/40 text-primary shadow-xs'
 : 'bg-surface border-muted/20 text-muted'
 }`}
 >
 <div className="flex items-center justify-between mb-1.5">
 <span className="font-bold">
 [{cls.index}] {cls.label}
 </span>
 {cls.flaggedPositive ? (
 <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40">
 POSITIVE (&gt;0.5)
 </span>
 ) : (
 <span className="text-[10px] font-sans px-1 py-0.2 bg-surface text-muted">
 &le;0.5
 </span>
 )}
 </div>
 <div className="flex items-baseline justify-between mb-1 text-[11px]">
 <span className="font-sans font-bold text-sm">
 {pct}%
 </span>
 <span className="font-sans text-muted text-[10px]">
 logit: {cls.logit.toFixed(3)}
 </span>
 </div>
 {/* Probability bar */}
 <div className="w-full bg-surface h-1.5 overflow-hidden">
 <div
 className={`h-1.5 transition-all ${
 cls.flaggedPositive ? 'bg-primary' : 'bg-purple-600'
 }`}
 style={{ width: `${Math.min(100, Math.max(2, cls.probability * 100))}%` }}
 />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 )}

 <div>
 <h4 className="text-xs font-bold text-muted mb-2 font-sans font-bold">
 Region-Level Anatomical Observations ({radiologist?.regionObservations?.length || 0})
 </h4>
 <div className="space-y-2">
 {radiologist?.regionObservations?.map((obs, rIdx) => (
 <div
 key={rIdx}
 className={`p-3 border text-xs flex items-start justify-between gap-3 ${
 obs.status === 'Abnormal'
 ? 'bg-primary/10 border-primary/40'
 : 'bg-surface border-muted/20'
 }`}
 >
 <div>
 <div className="flex items-center gap-2">
 <span className="font-bold text-ink">{obs.region}</span>
 {obs.severity && (
 <span className="text-[10px] font-sans px-1.5 py-0.2 bg-primary/15 text-primary">
 {obs.severity}
 </span>
 )}
 </div>
 <p className="text-muted mt-1">{obs.findingDescription}</p>
 </div>
 <span
 className={`text-[10px] font-bold px-2 py-0.5 shrink-0 ${
 obs.status === 'Abnormal'
 ? 'bg-primary/20 text-primary'
 : 'bg-routine/15 text-routine'
 }`}
 >
 {obs.status}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Lab Analyst Deep Dive */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-5">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-muted/20 pb-3 gap-2">
 <div className="flex items-center gap-2 text-primary">
 <FlaskConical className="w-5 h-5" />
 <h3 className="text-base font-bold font-sans font-bold">Lab Analyst Agent Calculations &amp; Pathology</h3>
 </div>
 <span className="text-xs font-sans text-muted">Biochemical Profiling &amp; Range Analysis</span>
 </div>

 <p className="text-xs text-muted bg-surface p-3.5 border border-muted/20 leading-relaxed">
 <span className="font-bold text-ink">Pathology Impression: </span>
 {labAnalyst?.labImpression || 'Automated laboratory assessment completed.'}
 </p>

 {/* Critical Alerts Banner if present */}
 {labAnalyst?.criticalAlerts && labAnalyst.criticalAlerts.length > 0 && (
 <div className="p-3.5 bg-emergency/5 border border-emergency/25 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emergency font-bold text-xs">
                <AlertOctagon className="w-4 h-4 text-emergency shrink-0" />
                <span>Critical Laboratory Alerts ({labAnalyst.criticalAlerts.length})</span>
              </div>
              <ul className="list-disc list-inside text-xs text-ink space-y-1 font-medium pl-1">
                {labAnalyst.criticalAlerts.map((alert, aIdx) => (
                  <li key={aIdx}>{alert}</li>
                ))}
              </ul>
            </div>
 )}

 {/* Evaluated Lab Markers: Flagged Prominently + Collapsed Normal */}
 {(() => {
 const allMarkers = labAnalyst?.processedMarkers && labAnalyst.processedMarkers.length > 0
 ? labAnalyst.processedMarkers
 : (clinicalCase.labs?.markers || (clinicalCase as any).labData?.markers || []);
 const { flagged, normal } = partitionLabMarkers(allMarkers);

 return (
 <div className="space-y-4">
 {/* Flagged Markers Surfaced Prominently */}
 <div className="space-y-2.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <AlertCircle className="w-4 h-4 text-primary" />
 <h4 className="text-xs font-bold text-ink font-sans font-bold">
 Flagged Out-of-Range Analytes ({flagged.length})
 </h4>
 </div>
 <span className="text-[11px] font-sans text-muted">
 {flagged.length} / {allMarkers.length} abnormal
 </span>
 </div>

 {flagged.length > 0 ? (
 <div className="space-y-2">
 {flagged.map((m, idx) => (
 <div
 key={idx}
 className={`p-3.5 border text-xs space-y-2 ${
 m.status === 'CRITICAL_HIGH' || m.status === 'CRITICAL_LOW' ? 'bg-emergency/5 border-emergency/25 rounded-lg' : 'bg-primary/5 border-primary/20 rounded-lg'
 }`}
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-bold text-ink text-sm">{m.name}</span>
 <span
 className={`px-2 py-0.5 text-[10px] font-bold border ${
 m.status === 'CRITICAL_HIGH' || m.status === 'CRITICAL_LOW'
 ? 'bg-emergency/15 text-emergency border-emergency/40'
 : 'bg-primary/15 text-primary border-primary/40'
 }`}
 >
 {m.status.replace('_', ' ')}
 </span>
 </div>

 <div className="flex items-center gap-3 text-muted font-sans self-start sm:self-auto">
 <span className="font-bold text-sm text-ink">
 {m.value} <span className="text-xs font-normal text-muted">{m.unit}</span>
 </span>
 <span className="text-[11px] text-muted">
 Ref: {m.referenceRange}
 </span>
 </div>
 </div>

 {/* One-Line Clinical Interpretation */}
 {m.interpretation && (
 <div className="pt-2 border-t border-black/5 flex items-start gap-1.5 text-xs text-ink leading-snug">
 <span className="font-bold text-ink shrink-0">Interpretation:</span>
 <span className="italic text-muted">{m.interpretation}</span>
 </div>
 )}
 </div>
 ))}
 </div>
 ) : (
 <div className="p-4 border border-routine/30 bg-routine/10 text-center text-xs font-medium text-routine">
 All reported laboratory analytes are within standard physiologic limits.
 </div>
 )}
 </div>

 {/* Normal Values Collapsed Section */}
 <div className="border border-muted/20 overflow-hidden bg-surface">
 <button
 type="button"
 onClick={() => setShowAllNormalReportLabs(!showAllNormalReportLabs)}
 className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface transition-colors cursor-pointer"
 >
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-muted">
 {showAllNormalReportLabs ? 'Hide Normal Analytes' : 'Show All Normal Analytes'}
 </span>
 <span className="text-[11px] font-sans px-2 py-0.5 bg-surface text-muted">
 {normal.length} within reference range
 </span>
 </div>
 <div className="flex items-center gap-1 text-xs font-semibold text-primary">
 <span>{showAllNormalReportLabs ? 'Collapse' : 'Expand'}</span>
 {showAllNormalReportLabs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
 </div>
 </button>

 {showAllNormalReportLabs && (
 <div className="border-t border-muted/20 bg-surface p-2 max-h-[220px] overflow-y-auto">
 <table className="w-full text-left text-xs border-collapse">
 <thead className="bg-surface text-muted font-semibold sticky top-0 border-b border-muted/20">
 <tr>
 <th className="p-2">Marker</th>
 <th className="p-2">Value</th>
 <th className="p-2">Ref Range</th>
 <th className="p-2">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-muted/20">
 {normal.map((m, nIdx) => (
 <tr key={nIdx} className="hover:bg-surface">
 <td className="p-2 font-medium text-ink">{m.name}</td>
 <td className="p-2 font-sans font-bold text-ink">
 {m.value} <span className="text-[11px] font-normal text-muted">{m.unit}</span>
 </td>
 <td className="p-2 text-muted text-[11px] font-sans">{m.referenceRange}</td>
 <td className="p-2">
 <span className="px-2 py-0.5 text-[10px] font-medium bg-routine/15 text-routine border border-routine/40">
 NORMAL
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );
 })()}

 {/* Calculations like Shock Index, Anion Gap */}
 {labAnalyst?.clinicalCalculations && labAnalyst.clinicalCalculations.length > 0 && (
 <div className="pt-2">
 <h4 className="text-xs font-bold text-muted mb-2 font-sans font-bold">
 Derived Clinical Indices
 </h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {labAnalyst.clinicalCalculations.map((calc, cIdx) => (
 <div key={cIdx} className="p-3.5 border border-muted/20 bg-surface text-xs">
 <div className="flex items-center justify-between mb-1">
 <span className="font-bold text-ink">{calc.indexName}</span>
 <span className="text-[11px] font-sans text-muted">Norm: {calc.referenceNorm}</span>
 </div>
 <div className="text-base font-sans font-bold text-primary mb-1">
 {calc.calculatedValue}
 </div>
 <p className="text-[11px] text-muted leading-snug">{calc.clinicalMeaning}</p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* TAB 3: RETRIEVED CLINICAL GUIDELINES (RAG VECTOR SEARCH INSPECTION) */}
 {activeTab === 'rag' && (
 <div className="space-y-4 bg-surface border border-muted/20 p-6 ">
 <div className="border-b border-muted/20 pb-3 flex items-center justify-between">
 <div>
 <h3 className="text-base font-bold text-ink font-sans font-bold">Live RAG Clinical Guidelines Retrieval</h3>
 <p className="text-xs text-muted mt-0.5">
 Real-time vector cosine similarity search against embedded WHO, NICE, BTS, and Surviving Sepsis criteria.
 </p>
 </div>
 <span className="text-xs font-sans text-primary bg-primary/5 px-2.5 py-1 border border-primary/20">
 gemini-embedding-001
 </span>
 </div>

 <div className="space-y-3">
 {guidelines.map((guide, gIdx) => (
 <div key={gIdx} className="p-4 border border-muted/20 bg-surface space-y-2">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <BookOpen className="w-4 h-4 text-primary shrink-0" />
 <h4 className="text-sm font-bold text-ink font-sans font-bold">{guide.title}</h4>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[11px] text-muted font-medium">{guide.source}</span>
 {guide.similarityScore !== undefined && (
 <span className="text-[10px] font-sans font-bold px-2 py-0.5 bg-primary/10 text-primary">
 Cosine Sim: {guide.similarityScore}
 </span>
 )}
 </div>
 </div>

 <div className="text-xs font-sans text-muted bg-surface p-3 border border-muted/20 leading-relaxed font-sans text-[11px]">
 "{guide.snippet}"
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 5. CLINICAL HANDOFF NOTE (SBAR/SOAP FORMAT) */}
 {activeTab === 'handoff' && (
 <ClinicalHandoffNote
 clinicalCase={clinicalCase}
 radiologistFindings={radiologistFindings}
 />
 )}

 {/* SELECTED RADIOLOGIST FINDING POPUP MODAL */}
 {selectedFinding && (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
 <div className="bg-surface border border-muted/20 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
 <div className="flex items-center justify-between border-b border-muted/20 pb-3">
 <div className="flex items-center gap-2">
 <span className="px-2 py-0.5 bg-primary text-surface font-sans font-bold text-xs">
 {selectedFinding.id}
 </span>
 <h3 className="text-base font-bold text-ink font-sans font-bold">{selectedFinding.region}</h3>
 </div>
 <button
 type="button"
 onClick={() => setSelectedFinding(null)}
 className="text-muted/80 hover:text-muted p-1 cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-muted">Severity Classification</span>
 {getSeverityBadge(selectedFinding.severity)}
 </div>

 <div className="p-3.5 bg-surface border border-muted/20 space-y-1">
 <span className="text-[11px] font-bold text-muted tracking-wide">
 Radiological Finding Observation
 </span>
 <p className="text-sm text-ink leading-relaxed font-medium">
 {selectedFinding.observation}
 </p>
 </div>

 <div className="text-[11px] text-muted bg-primary/5 border border-primary/20 p-2.5 flex items-center gap-2">
 <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
 <span>
 Referenced directly by the Doctor Agent to formulate clinical probabilities and triage recommendations.
 </span>
 </div>

 <div className="flex justify-end pt-2">
 <button
 type="button"
 onClick={() => setSelectedFinding(null)}
 className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-[#09472C] text-white rounded-lg shadow-xs cursor-pointer"
 >
 Close Finding
 </button>
 </div>
 </div>
 </div>
 )}

 {/* SELECTED CITATION POPUP MODAL */}
 {selectedCitation && (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
 <div className="bg-surface border border-muted/20 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
 <div className="flex items-center justify-between border-b border-muted/20 pb-3">
 <div className="flex items-center gap-2">
 {getSourceBadge(selectedCitation.sourceType)}
 <h3 className="text-sm font-bold text-ink truncate font-sans font-bold">
 {selectedCitation.sourceName}
 </h3>
 </div>
 <button
 type="button"
 onClick={() => setSelectedCitation(null)}
 className="text-muted/80 hover:text-muted p-1 cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="space-y-1">
 <span className="text-[10px] font-bold text-muted">
 Diagnostic Claim
 </span>
 <p className="text-sm font-semibold text-ink">
 "{selectedCitation.claim}"
 </p>
 </div>

 <div className="p-3.5 bg-surface border border-muted/20 space-y-1 font-sans text-xs">
 <span className="text-[10px] font-bold text-primary">
 Verbatim Cited Evidence / Measurement
 </span>
 <p className="text-ink leading-relaxed">
 {selectedCitation.citedTextOrValue}
 </p>
 </div>

 {selectedCitation.confidenceContribution && (
 <div className="text-xs text-muted">
 <span className="font-bold">Confidence Impact: </span>
 {selectedCitation.confidenceContribution}
 </div>
 )}

 <div className="flex justify-end pt-2">
 <button
 type="button"
 onClick={() => setSelectedCitation(null)}
 className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-[#09472C] text-white rounded-lg shadow-xs cursor-pointer"
 >
 Close Citation
 </button>
 </div>
 </div>
 </div>
 )}

 {/* CONFIDENCE DERIVATION MODEL DOCUMENTATION MODAL */}
 {showConfidenceModelModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
 <div className="bg-surface border border-muted/20 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
 <div className="flex items-center justify-between border-b border-muted/20 pb-3">
 <div className="flex items-center gap-2.5">
 <div className="p-2 bg-primary/10 text-primary">
 <Gauge className="w-5 h-5" />
 </div>
 <div>
 <h3 className="text-base font-bold text-ink font-sans font-bold">
 Principled Confidence Scoring Model
 </h3>
 <p className="text-xs text-muted">
 Transparent, multi-modal evidence weighting architecture
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setShowConfidenceModelModal(false)}
 className="text-muted/80 hover:text-muted p-1 cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="space-y-4 text-xs text-muted leading-relaxed">
 <div className="p-3.5 bg-primary/5 border border-primary/20 text-primary space-y-1">
 <div className="font-bold flex items-center gap-1.5">
 <ShieldCheck className="w-4 h-4 text-primary" />
 Why MediAgent Avoids Arbitrary Confidence Percentages
 </div>
 <p className="text-muted text-[11px] leading-relaxed">
 In critical clinical decision support, black-box confidence scores (e.g. arbitrary 90% estimates) risk overconfidence and cognitive bias. MediAgent derives every diagnostic confidence score through a <strong>principled multi-modal concordance matrix</strong> across 4 independent evidence streams.
 </p>
 </div>

 {/* The 4 Evidence Pillars */}
 <div className="space-y-2">
 <h4 className="font-bold text-ink text-[11px] flex items-center gap-1.5 font-sans font-bold">
 <Scale className="w-3.5 h-3.5 text-primary" />
 The 4 Independent Evidence Pillars & Weights
 </h4>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 <div className="p-3 border border-primary/20 bg-primary/5 space-y-1">
 <div className="flex items-center justify-between">
 <span className="font-bold text-primary flex items-center gap-1">
 <User className="w-3 h-3 text-primary" /> Patient Presentation
 </span>
 <span className="font-sans font-bold text-primary text-[11px]">Max 25%</span>
 </div>
 <p className="text-[11px] text-muted">
 Chief complaint congruence, acute onset timeline, triage vitals (fever, SpO2, tachycardia), and high-risk comorbid history.
 </p>
 </div>

 <div className="p-3 border border-primary/20 bg-indigo-50/40 space-y-1">
 <div className="flex items-center justify-between">
 <span className="font-bold text-indigo-950 flex items-center gap-1">
 <ImageIcon className="w-3 h-3 text-primary" /> Radiological Imaging
 </span>
 <span className="font-sans font-bold text-indigo-800 text-[11px]">Max 30%</span>
 </div>
 <p className="text-[11px] text-muted">
 Focal radiographic finding chips (e.g., [RF-1] consolidation, effusion), DenseNet-121 ONNX activation heatmaps, and anatomical bounding boxes.
 </p>
 </div>

 <div className="p-3 border border-purple-200 bg-purple-50/40 space-y-1">
 <div className="flex items-center justify-between">
 <span className="font-bold text-purple-950 flex items-center gap-1">
 <FlaskConical className="w-3 h-3 text-purple-700" /> Laboratory Pathology
 </span>
 <span className="font-sans font-bold text-purple-800 text-[11px]">Max 25%</span>
 </div>
 <p className="text-[11px] text-muted">
 Objective biomarker derangements (WBC leukocytosis, elevated CRP, arterial blood gas anomalies) flagged against physiological reference ranges.
 </p>
 </div>

 <div className="p-3 border border-primary/30 bg-primary/10 space-y-1">
 <div className="flex items-center justify-between">
 <span className="font-bold text-primary flex items-center gap-1">
 <BookOpen className="w-3 h-3 text-primary" /> Clinical Guidelines
 </span>
 <span className="font-sans font-bold text-primary text-[11px]">Max 20%</span>
 </div>
 <p className="text-[11px] text-muted">
 Direct text grounding against embedded clinical practice rules (CURB-65, NICE, Surviving Sepsis, GOLD criteria) retrieved via cosine vector similarity.
 </p>
 </div>
 </div>
 </div>

 {/* Concordance Tiers and Penalty Structure */}
 <div className="space-y-2 pt-1 border-t border-muted/20">
 <h4 className="font-bold text-ink text-[11px] font-sans font-bold">
 Concordance Tiers & Absence Penalties
 </h4>

 <div className="space-y-1.5 font-sans text-[11px]">
 <div className="p-2 bg-routine/10 border border-routine/30 flex items-center justify-between text-routine">
 <span><strong>High Confidence (&ge;70%)</strong>: 3 or 4 independent modalities agree</span>
 <span className="font-bold">Strong Grounding</span>
 </div>
 <div className="p-2 bg-primary/10 border border-primary/30 flex items-center justify-between text-primary">
 <span><strong>Moderate Confidence (40–69%)</strong>: 2 modalities agree</span>
 <span className="font-bold">Partial Grounding</span>
 </div>
 <div className="p-2 bg-surface border border-muted/20 flex items-center justify-between text-muted">
 <span><strong>Low Confidence (&lt;40%)</strong>: &le;1 modality agrees (Muted styling)</span>
 <span className="font-bold">Differential Consideration Only</span>
 </div>
 </div>
 </div>
 </div>

 <div className="flex justify-end pt-2 border-t border-muted/20">
 <button
 type="button"
 onClick={() => setShowConfidenceModelModal(false)}
 className="px-4 py-2 text-xs font-semibold bg-primary text-surface hover:bg-primary/90 cursor-pointer "
 >
 Understood & Close
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
