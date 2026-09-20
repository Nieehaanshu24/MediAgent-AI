import React, { useState } from 'react';
import {
 Printer,
 Copy,
 Check,
 Download,
 AlertOctagon,
 AlertTriangle,
 CheckCircle2,
 FileText,
 Activity,
 Heart,
 ImageIcon,
 FlaskConical,
 BookOpen,
 Stethoscope,
 ShieldAlert,
 User,
 Clock,
 ExternalLink,
} from 'lucide-react';
import type { ClinicalCase, RadiologistFinding } from '../types/clinical';
import { partitionLabMarkers, evaluateLabMarker } from '../utils/labReference';
import { resolveMultiAgentUrgency } from './FinalReportView';

interface ClinicalHandoffNoteProps {
 clinicalCase: ClinicalCase;
 radiologistFindings: RadiologistFinding[];
 onClose?: () => void;
}

export const ClinicalHandoffNote: React.FC<ClinicalHandoffNoteProps> = ({
 clinicalCase,
 radiologistFindings,
 onClose,
}) => {
 const [copied, setCopied] = useState(false);
 const patient = clinicalCase.patient;
 const vitals = patient?.vitals;
 const doctor = clinicalCase.agentResults?.doctor;
 const interviewer = clinicalCase.agentResults?.interviewer;
 const radiologist = clinicalCase.agentResults?.radiologist;
 const labAnalyst = clinicalCase.agentResults?.labAnalyst;
 const guidelines = clinicalCase.agentResults?.retrievedGuidelines || [];

 const rawMarkers =
 labAnalyst?.processedMarkers && labAnalyst.processedMarkers.length > 0
 ? labAnalyst.processedMarkers
 : clinicalCase.labs?.markers || (clinicalCase as any).labData?.markers || [];
 const { flagged: flaggedLabs, normal: normalLabs } = partitionLabMarkers(rawMarkers);

 const urgencyResult = resolveMultiAgentUrgency(clinicalCase, radiologistFindings);
 const UrgencyIcon = urgencyResult.icon;

 const handlePrint = () => {
 window.print();
 };

 const generateMarkdownNote = (): string => {
 const timestamp = new Date(clinicalCase.updatedAt || clinicalCase.createdAt).toLocaleString();
 const primaryCondition = doctor?.probableConditions?.[0];

 return `================================================================================
CLINICAL HANDOFF & CDS TRANSFER SUMMARY (SBAR FORMAT)
MediAgent AI Multi-Agent Clinical Decision Support
Date/Time: ${timestamp} | Case ID: ${clinicalCase.id}
================================================================================

[PATIENT IDENTIFIER & DEMOGRAPHICS]
Patient: ${patient.age}yo ${patient.gender.toUpperCase()}
Chief Complaint: ${patient.chiefComplaint} (Duration: ${patient.symptomDuration})
Past Medical History: ${patient.pastMedicalHistory || 'None documented'}
Current Medications: ${patient.currentMedications || 'None documented'}
Allergies: ${patient.allergies || 'NKDA'}

[TRIAGE VITALS]
HR: ${vitals?.heartRate ?? 'N/A'} bpm | BP: ${vitals?.bloodPressureSystolic ?? 'N/A'}/${vitals?.bloodPressureDiastolic ?? 'N/A'} mmHg
RR: ${vitals?.respiratoryRate ?? 'N/A'} /min | SpO2: ${vitals?.oxygenSaturation ?? 'N/A'}% | Temp: ${vitals?.temperature ?? 'N/A'} °C

--------------------------------------------------------------------------------
S - SITUATION
--------------------------------------------------------------------------------
* CDS TRIAGE LEVEL: ${urgencyResult.badgeLabel}
* PRIMARY RATIONALE: ${urgencyResult.oneLineRationale}
* PRIMARY WORKING IMPRESSION: ${primaryCondition?.condition || 'Pending multi-modal evaluation'} (${primaryCondition?.probabilityScore || 0}% Probability)
* REASON FOR ESCALATION: ${doctor?.urgencyRationale || 'Multi-modal diagnostic consensus'}

--------------------------------------------------------------------------------
B - BACKGROUND
--------------------------------------------------------------------------------
* History of Present Illness:
 ${patient.symptomDescription}

* Patient-Reported Red Flags & Adaptive Responses:
${(patient.followUpQuestions || interviewer?.adaptiveFollowUps || [])
 .map((q) => ` - Q: ${q.question}\n A: ${q.answer || 'Not answered'}`)
 .join('\n') || ' - Standard review of systems completed.'}

--------------------------------------------------------------------------------
A - ASSESSMENT (MULTI-AGENT SYNTHESIS)
--------------------------------------------------------------------------------
1. PROBABLE DIFFERENTIAL DIAGNOSES:
${(doctor?.probableConditions || [])
 .map(
 (c, i) =>
 ` ${i + 1}. ${c.condition} (ICD-10: ${c.icdCodeEstimate || 'N/A'}) - ${c.probabilityScore}% Probability [${c.evidenceStrength?.toUpperCase() || 'MODERATE'} Concordance]\n Rationale: ${c.rationale}`
 )
 .join('\n\n')}

2. RADIOLOGICAL FINDINGS (${clinicalCase.imaging?.modality || 'Imaging'}):
${radiologistFindings
 .map((f) => ` * [${f.id}] ${f.region}: ${f.observation} (Severity: ${f.severity})`)
 .join('\n') || ' * No acute focal lesions identified.'}
 Impression: ${radiologist?.overallImpression || radiologist?.radiologicalImpression || 'Completed'}

3. CRITICAL & FLAGGED LABORATORY PATHOLOGY:
${flaggedLabs
 .map((m) => ` * ${m.name}: ${m.value} ${m.unit || ''} (Ref: ${m.referenceRange}) [${m.status}]`)
 .join('\n') || ' * All screened baseline biomarkers within standard physiological limits.'}
 Lab Impression: ${labAnalyst?.labImpression || 'Completed'}

4. EVIDENCE-BASED CLINICAL GUIDELINES GROUNDED:
${guidelines
 .map((g) => ` * [${g.source}] ${g.title}: "${g.snippet}"`)
 .join('\n') || ' * Standard emergency medicine clinical decision rules referenced.'}

--------------------------------------------------------------------------------
R - RECOMMENDATIONS & IMMEDIATE ACTION PLAN
--------------------------------------------------------------------------------
${(doctor?.recommendedNextSteps || [])
 .map((s, i) => ` ${i + 1}. [${s.category}] (${s.timeframe}): ${s.action}\n Guideline Basis: ${s.groundingCitation}`)
 .join('\n\n')}

================================================================================
AUTHENTICATION:
AI CDS Multi-Agent Prototype • Case Record Persisted in Cloud Firestore
Disclaimer: Educational Decision Support Prototype Only. Not a Medical Device.
================================================================================
`;
 };

 const handleCopy = () => {
 const text = generateMarkdownNote();
 navigator.clipboard.writeText(text);
 setCopied(true);
 setTimeout(() => setCopied(false), 2500);
 };

 const handleDownload = () => {
 const text = generateMarkdownNote();
 const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `clinical_handoff_${clinicalCase.id}_${Date.now()}.txt`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 };

 return (
 <div id="clinical-handoff-note-container" className="space-y-6">
 {/* Top Action Toolbar (Hidden during print) */}
      <div className="bg-surface border border-muted/20 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink font-sans">Clinical Handoff Note (SBAR Format)</h3>
            <p className="text-xs text-muted">
              Structured physician-to-physician shift transfer & EHR documentation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-surface text-ink hover:bg-muted/5 border border-muted/20 shadow-xs transition-colors cursor-pointer"
            title="Copy plain text note to clipboard for EHR"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-routine" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to EHR!' : 'Copy EHR Note'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-surface text-ink hover:bg-muted/5 border border-muted/20 shadow-xs transition-colors cursor-pointer"
            title="Download text file"
          >
            <Download className="w-3.5 h-3.5 text-muted" />
            <span>Export .TXT</span>
          </button>

          <button
            type="button"
            id="print-handoff-note-btn"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-[#09472C] text-white shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Clinical Note</span>
          </button>
        </div>
      </div>

      {/* Styled Printable Clinical Document */}
      <div
        id="printable-handoff-document"
        className="bg-surface border border-muted/20 rounded-xl p-8 text-ink font-sans shadow-xs print:border-none print:shadow-none print:p-0"
      >
        {/* Document Header */}
        <div className="border-b border-muted/20 pb-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-sans tracking-widest text-primary font-bold">
                CLINICAL CDS SHIFT HANDOFF TRANSFER NOTE
              </div>
              <h1 className="text-xl font-bold font-sans tracking-tight text-ink mt-0.5">
                PATIENT HANDOFF &bull; CASE #{clinicalCase.id}
              </h1>
            </div>
            <div className="text-left sm:text-right text-xs font-sans text-muted">
              <div>{new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}</div>
              <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
 {/* Patient Banner Bar */}
 <div className="mt-4 p-4 bg-surface border border-muted/20 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
 <div>
 <span className="text-muted text-[10px] block ">Patient / Age / Sex</span>
 <strong className="text-ink text-sm">
 {patient.age}yo {patient.gender.toUpperCase()}
 </strong>
 </div>
 <div>
 <span className="text-muted text-[10px] block ">Chief Complaint</span>
 <strong className="text-ink truncate block" title={patient.chiefComplaint}>
 {patient.chiefComplaint}
 </strong>
 </div>
 <div>
 <span className="text-muted text-[10px] block ">Duration</span>
 <strong className="text-ink">{patient.symptomDuration || 'Acute'}</strong>
 </div>
 <div>
 <span className="text-muted text-[10px] block ">Allergies</span>
 <strong className="text-ink">{patient.allergies || 'NKDA'}</strong>
 </div>
 </div>
 </div>

 {/* Vital Signs Grid */}
 <div className="mb-6 p-4 bg-surface border border-muted/20 rounded-xl">
 <div className="text-[10px] font-sans text-muted font-bold mb-2 flex items-center gap-1.5">
 <Activity className="w-3.5 h-3.5 text-primary" />
 <span>Triage Vital Signs & Physiological Status</span>
 </div>
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs font-sans">
 <div className="p-2.5 bg-surface border border-muted/20 rounded-lg text-center">
 <span className="text-[10px] text-muted block">HR</span>
 <span
 className={`font-bold text-sm ${
 vitals?.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 55)
 ? 'text-emergency'
 : 'text-ink'
 }`}
 >
 {vitals?.heartRate ?? 'N/A'}{' '}
 <span className="text-[10px] text-muted/80 font-normal">bpm</span>
 </span>
 </div>

 <div className="p-2.5 bg-surface border border-muted/20 rounded-lg text-center">
 <span className="text-[10px] text-muted block">BP</span>
 <span
 className={`font-bold text-sm ${
 vitals?.bloodPressureSystolic &&
 (vitals.bloodPressureSystolic < 90 || vitals.bloodPressureSystolic >= 140)
 ? 'text-emergency'
 : 'text-ink'
 }`}
 >
 {vitals?.bloodPressureSystolic ?? 'N/A'}/{vitals?.bloodPressureDiastolic ?? 'N/A'}
 </span>
 </div>

 <div className="p-2.5 bg-surface border border-muted/20 rounded-lg text-center">
 <span className="text-[10px] text-muted block">RR</span>
 <span
 className={`font-bold text-sm ${
 vitals?.respiratoryRate && vitals.respiratoryRate > 20 ? 'text-emergency' : 'text-ink'
 }`}
 >
 {vitals?.respiratoryRate ?? 'N/A'}{' '}
 <span className="text-[10px] text-muted/80 font-normal">/min</span>
 </span>
 </div>

 <div className="p-2.5 bg-surface border border-muted/20 rounded-lg text-center">
 <span className="text-[10px] text-muted block">SpO2</span>
 <span
 className={`font-bold text-sm ${
 vitals?.oxygenSaturation && vitals.oxygenSaturation < 95
 ? 'text-emergency'
 : 'text-ink'
 }`}
 >
 {vitals?.oxygenSaturation ?? 'N/A'}%
 </span>
 </div>

 <div className="p-2.5 bg-surface border border-muted/20 rounded-lg text-center">
 <span className="text-[10px] text-muted block">TEMP</span>
 <span
 className={`font-bold text-sm ${
 vitals?.temperature && vitals.temperature >= 38.0 ? 'text-emergency' : 'text-ink'
 }`}
 >
 {vitals?.temperature ?? 'N/A'}°C
 </span>
 </div>

 <div className="p-2.5 bg-surface border border-muted/20 rounded-lg text-center">
 <span className="text-[10px] text-muted block">TRIAGE</span>
 <span
 className={`font-bold text-xs ${
 urgencyResult.level === 'emergency'
 ? 'text-emergency'
 : urgencyResult.level === 'urgent'
 ? 'text-primary'
 : 'text-routine'
 }`}
 >
 {urgencyResult.level}
 </span>
 </div>
 </div>
 </div>

 {/* SECTION S: SITUATION */}
 <div className="mb-6">
 <div className="border-b border-muted/20 pb-2 mb-3 flex items-center justify-between">
 <h2 className="text-sm font-black text-ink flex items-center gap-2 font-sans font-bold">
 <span className="w-5 h-5 bg-ink text-surface flex items-center justify-center text-xs">
 S
 </span>
 <span>Situation & Triage Acuity</span>
 </h2>
 <span
 className={`text-xs font-sans font-bold px-2 py-0.5 border ${
 urgencyResult.level === 'emergency'
 ? 'bg-emergency/15 text-emergency border-emergency/40'
 : urgencyResult.level === 'urgent'
 ? 'bg-primary/15 text-primary border-primary/40'
 : 'bg-routine/15 text-routine border-routine/40'
 }`}
 >
 {urgencyResult.badgeLabel}
 </span>
 </div>

 <div
            className={`p-4 rounded-xl border ${
              urgencyResult.level === 'emergency'
                ? 'bg-emergency/5 border-emergency/25 text-ink'
                : urgencyResult.level === 'urgent'
                ? 'bg-amber-500/5 border-amber-500/25 text-ink'
                : 'bg-routine/5 border-routine/25 text-ink'
            }`}
          >
            <div className="text-sm font-bold text-ink">{urgencyResult.title}</div>
            <div className="text-xs mt-1 font-sans leading-relaxed text-ink font-medium">
              <strong className="text-ink">Clinical Rationale:</strong> {urgencyResult.oneLineRationale}
            </div>

 {/* Diagnostic Limitations Notice if partial or symptoms-only */}
 {(doctor?.dataCompletenessLevel === 'symptoms_only' ||
 doctor?.dataCompletenessLevel === 'partial' ||
 (doctor?.missingDataSources && doctor.missingDataSources.length > 0)) && (
 <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 text-ink rounded-lg font-medium text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    Data Completeness Notice ({doctor?.dataCompletenessLevel === 'symptoms_only' ? 'Symptoms-Only Intake' : 'Partial Diagnostics'}):
                  </span>
                </div>
                <p className="leading-relaxed text-muted">
                  {doctor?.diagnosticLimitationsNotice ||
                    'Assessment formulated on intake presentation. Confirmatory imaging/labs deferred, capping certainty.'}
                </p>
                {doctor?.missingDataSources && (
                  <div className="text-ink pt-0.5">
                    <strong>Pending Modalities: </strong>
                    {doctor.missingDataSources.map((m) => `${m.label} (${m.status})`).join('; ')}
                  </div>
                )}
              </div>
            )}
 </div>

 <div className="text-xs text-muted mt-1.5 font-sans leading-relaxed">
 <strong>Primary Working Assessment:</strong>{' '}
 {doctor?.probableConditions?.[0]?.condition || 'Under evaluation'} (Probability:{' '}
 {doctor?.probableConditions?.[0]?.probabilityScore || 0}%).{' '}
 {doctor?.clinicalExecutiveSummary}
 </div>
 </div>
 </div>

 {/* SECTION B: BACKGROUND */}
 <div className="mb-6">
 <div className="border-b border-muted/20 pb-2 mb-3">
 <h2 className="text-sm font-black text-ink flex items-center gap-2 font-sans font-bold">
 <span className="w-5 h-5 bg-ink text-surface flex items-center justify-center text-xs">
 B
 </span>
 <span>Background & Clinical History</span>
 </h2>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
 <div className="p-3.5 bg-surface border border-muted/20 rounded-lg">
 <h4 className="font-bold text-ink text-[11px] mb-1 font-sans font-bold">
 History of Present Illness (HPI)
 </h4>
 <p className="text-muted font-sans">{patient.symptomDescription}</p>

 <div className="mt-3 pt-2 border-t border-muted/20 space-y-1 font-sans text-[11px]">
 <div>
 <strong>Past Medical History:</strong> {patient.pastMedicalHistory || 'None'}
 </div>
 <div>
 <strong>Current Medications:</strong> {patient.currentMedications || 'None'}
 </div>
 </div>
 </div>

 <div className="p-3.5 bg-surface border border-muted/20 rounded-lg">
 <h4 className="font-bold text-ink text-[11px] mb-1 font-sans font-bold">
 Patient-Reported Red Flags & Adaptive Triage Follow-Ups
 </h4>
 <div className="space-y-2 mt-2">
 {(patient.followUpQuestions || interviewer?.adaptiveFollowUps || []).length > 0 ? (
 (patient.followUpQuestions || interviewer?.adaptiveFollowUps || []).map((q, idx) => (
 <div key={idx} className="bg-surface p-2 border border-muted/20 text-[11px]">
 <span className="font-bold text-ink block">Q: {q.question}</span>
 <span className="text-primary font-sans font-medium block mt-0.5">
 A: {q.answer || 'No response recorded'}
 </span>
 </div>
 ))
 ) : (
 <p className="text-muted italic">No red-flag follow-up alerts recorded.</p>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* SECTION A: ASSESSMENT */}
 <div className="mb-6">
 <div className="border-b border-muted/20 pb-2 mb-3">
 <h2 className="text-sm font-black text-ink flex items-center gap-2 font-sans font-bold">
 <span className="w-5 h-5 bg-ink text-surface flex items-center justify-center text-xs">
 A
 </span>
 <span>Assessment & Multi-Modal Specialist Findings</span>
 </h2>
 </div>

 {/* Differential Diagnosis Table */}
 <div className="overflow-x-auto mb-4">
 <table className="w-full text-left text-xs border border-muted/20 border-collapse">
 <thead>
 <tr className="bg-surface border-b border-muted/20 font-sans text-[11px] text-muted">
 <th className="p-2 border-r border-muted/20">#</th>
 <th className="p-2 border-r border-muted/20">Condition & ICD-10</th>
 <th className="p-2 border-r border-muted/20">Probability</th>
 <th className="p-2 border-r border-muted/20">Multi-Modal Concordance</th>
 <th className="p-2">Diagnostic Rationale & Referenced Findings</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-muted/20 font-sans">
 {(doctor?.probableConditions || []).map((cond, cIdx) => (
 <tr key={cIdx} className={cIdx === 0 ? 'bg-primary/5 font-medium' : ''}>
 <td className="p-2 font-sans text-center border-r border-muted/20">{cIdx + 1}</td>
 <td className="p-2 border-r border-muted/20">
 <strong className="text-ink">{cond.condition}</strong>
 <span className="text-[10px] text-muted font-sans block">
 ICD: {cond.icdCodeEstimate || 'N/A'}
 </span>
 </td>
 <td className="p-2 font-sans font-bold text-ink border-r border-muted/20">
 {cond.probabilityScore}%
 </td>
 <td className="p-2 border-r border-muted/20">
 <span
 className={`inline-block px-1.5 py-0.5 text-[10px] font-sans font-bold border ${
 cond.evidenceStrength === 'strong'
 ? 'bg-routine/15 text-routine border-routine/40'
 : cond.evidenceStrength === 'moderate'
 ? 'bg-primary/15 text-primary border-primary/40'
 : 'bg-surface text-muted border-muted/20'
 }`}
 >
 {cond.evidenceStrength || 'Moderate'}
 </span>
 </td>
 <td className="p-2 text-muted text-[11px] leading-relaxed">
 {cond.rationale}
 {cond.referencedFindingIds && cond.referencedFindingIds.length > 0 && (
 <div className="mt-1 flex items-center gap-1 font-sans text-[10px] text-primary">
 <strong>Imaging Chips:</strong> {cond.referencedFindingIds.join(', ')}
 </div>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Diagnostic Modalities Summary */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
 {/* Radiology */}
 <div className="p-3.5 bg-surface border border-muted/20 rounded-lg">
 <div className="flex items-center gap-1.5 font-bold text-[11px] text-primary mb-2">
 <ImageIcon className="w-3.5 h-3.5 text-primary" />
 <span>Radiology Findings ({clinicalCase.imaging?.modality || 'Study'})</span>
 </div>
 <ul className="space-y-1.5 text-ink text-[11px]">
 {radiologistFindings.map((f) => (
 <li key={f.id} className="flex items-start gap-1.5">
 <span className="font-sans font-bold text-primary shrink-0">[{f.id}]</span>
 <span>
 <strong>{f.region}:</strong> {f.observation}{' '}
 <span className="text-[10px] font-sans text-muted">({f.severity})</span>
 </span>
 </li>
 ))}
 </ul>
 <div className="mt-2 pt-2 border-t border-muted/20 text-[11px] text-muted italic">
 Impression: {radiologist?.overallImpression || radiologist?.radiologicalImpression}
 </div>
 </div>

 {/* Pathology / Labs */}
 <div className="p-3.5 bg-surface border border-muted/20 rounded-lg">
 <div className="flex items-center gap-1.5 font-bold text-[11px] text-routine mb-2">
 <FlaskConical className="w-3.5 h-3.5 text-routine" />
 <span>Pathology & Flagged Laboratory Biomarkers</span>
 </div>
 {flaggedLabs.length > 0 ? (
 <ul className="space-y-1 text-[11px] font-sans">
 {flaggedLabs.map((m, idx) => (
 <li key={idx} className="flex items-center justify-between gap-2">
 <span className="text-ink truncate">{m.name}</span>
 <span className="font-bold text-emergency shrink-0">
 {m.value} {m.unit || ''}{' '}
 <span className="text-[9px] px-1 py-0.2 bg-emergency/15 text-emergency border border-emergency/30">
 {m.status}
 </span>
 </span>
 </li>
 ))}
 </ul>
 ) : (
 <p className="text-muted text-[11px]">
 All screened baseline biomarkers within standard physiological limits.
 </p>
 )}
 <div className="mt-2 pt-2 border-t border-muted/20 text-[11px] text-muted italic">
 Lab Impression: {labAnalyst?.labImpression}
 </div>
 </div>
 </div>
 </div>

 {/* SECTION R: RECOMMENDATIONS & PLAN */}
 <div className="mb-6">
 <div className="border-b border-muted/20 pb-2 mb-3">
 <h2 className="text-sm font-black text-ink flex items-center gap-2 font-sans font-bold">
 <span className="w-5 h-5 bg-ink text-surface flex items-center justify-center text-xs">
 R
 </span>
 <span>Recommendations & Priority Action Plan</span>
 </h2>
 </div>

 <div className="space-y-2">
 {(doctor?.recommendedNextSteps || []).map((step, idx) => (
 <div
 key={idx}
 className="p-3 bg-surface border border-muted/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
 >
 <div className="flex items-start gap-2.5">
 <span className="w-5 h-5 rounded-md bg-primary/10 text-primary font-sans font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
 {idx + 1}
 </span>
 <div>
 <span className="font-bold text-ink">{step.action}</span>
 <span className="text-[11px] text-muted font-sans block mt-0.5">
 Guideline Basis: {step.groundingCitation}
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
 <span className="px-2 py-0.5 text-[10px] font-sans bg-surface text-ink font-bold">
 {step.category}
 </span>
 <span className="px-2 py-0.5 text-[10px] font-sans text-primary bg-primary/10 font-bold">
 {step.timeframe}
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Clinical Disclaimer & Signature Block */}
 <div className="mt-8 pt-4 border-t border-muted/20 text-muted text-[11px] font-sans flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <div>
 <strong>ELECTRONIC PROVIDER CDS SIGNATURE:</strong> MediAgent-CDS-Engine v2.4
 </div>
 <div className="text-[10px] text-muted/80 mt-0.5">
 Verified with Firestore DB persistence • RAG Guidelines Index: WHO / NICE / BTS / ACC
 </div>
 </div>

 <div className="text-left sm:text-right text-[10px] text-primary bg-primary/10 p-2 border border-primary/30 max-w-sm">
 <strong>PROTOTYPE NOTICE:</strong> Educational prototype only. Not certified for autonomous clinical diagnosis or patient triage.
 </div>
 </div>
 </div>
 );
};
