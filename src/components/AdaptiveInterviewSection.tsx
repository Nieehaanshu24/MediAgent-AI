import React, { useState, useEffect } from 'react';
import {
 HelpCircle,
 Sparkles,
 CheckCircle2,
 AlertTriangle,
 RefreshCw,
 MessageSquareQuote,
 Check,
 Stethoscope,
 Info,
} from 'lucide-react';
import type { PatientDemographics, AdaptiveFollowUpQuestion } from '../types/clinical';

interface AdaptiveInterviewSectionProps {
 patient: PatientDemographics;
 onChange: (updated: PatientDemographics) => void;
}

export const AdaptiveInterviewSection: React.FC<AdaptiveInterviewSectionProps> = ({
 patient,
 onChange,
}) => {
 const [isLoading, setIsLoading] = useState(false);
 const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
 const [lastAnalyzedComplaint, setLastAnalyzedComplaint] = useState<string>(
 patient.chiefComplaint || ''
 );

 const questions = patient.followUpQuestions || [];
 const unansweredCount = questions.filter((q) => !q.answer || q.answer.trim().length === 0).length;
 const isComplete = questions.length > 0 && unansweredCount === 0;

 // Fallback heuristic questions if offline / API unavailable
 const generateFallbackQuestions = (complaint: string): AdaptiveFollowUpQuestion[] => {
 const cc = (complaint || '').toLowerCase();
 if (cc.includes('chest') || cc.includes('angina') || cc.includes('pressure') || cc.includes('tightness')) {
 return [
 {
 id: `afq-${Date.now()}-1`,
 question: 'Does the chest discomfort radiate to your left arm, neck, jaw, back, or shoulder blade, and is it triggered or worsened by exertion?',
 reasoning: 'Triage Logic: Radiation to the left arm or jaw with exertional provocation significantly elevates the pre-test probability of Acute Coronary Syndrome (ACS) over non-ischemic causes.',
 suggestedAnswers: [
 'Yes, radiates to left arm and jaw, aggravated by exertion',
 'No radiation; sharp and worse with deep breathing or coughing',
 'Dull localized pressure without radiation, not related to exertion',
 ],
 },
 {
 id: `afq-${Date.now()}-2`,
 question: 'When the chest discomfort began, did you experience cold sweating (diaphoresis), shortness of breath, or nausea/vomiting?',
 reasoning: 'Triage Logic: Autonomic signs (diaphoresis, nausea) in conjunction with chest pain serve as major red-flag risk factors for acute myocardial infarction.',
 suggestedAnswers: [
 'Yes, broke out in cold sweat with nausea',
 'Mild shortness of breath only, no nausea or sweating',
 'No autonomic symptoms, pain is isolated to chest wall',
 ],
 },
 ];
 }

 if (cc.includes('breath') || cc.includes('dyspnea') || cc.includes('short of breath') || cc.includes('wheez')) {
 return [
 {
 id: `afq-${Date.now()}-1`,
 question: 'Does your shortness of breath worsen when lying flat (orthopnea), or have you woken up gasping for air at night (paroxysmal nocturnal dyspnea)?',
 reasoning: 'Triage Logic: Orthopnea and PND distinguish elevated left-ventricular filling pressures (acute pulmonary edema / CHF) from parenchymal pneumonia or bronchospasm.',
 suggestedAnswers: [
 'Yes, cannot sleep flat and need 2-3 pillows',
 'No change with lying flat; worse with coughing and exertion',
 'Sudden acute onset without positional changes',
 ],
 },
 {
 id: `afq-${Date.now()}-2`,
 question: 'Are you coughing up any sputum, and if so, what color is it (e.g. rust-colored, green/yellow, pink frothy, or clear)?',
 reasoning: 'Triage Logic: Purulent or rust-colored sputum points toward bacterial consolidation (pneumonia), whereas pink frothy sputum indicates pulmonary edema, and clear sputum suggests viral or reactive airway disease.',
 suggestedAnswers: [
 'Yes, thick purulent green/rust-colored sputum',
 'Dry hacking cough without sputum production',
 'Coughing up clear thin secretions',
 ],
 },
 ];
 }

 if (cc.includes('abdom') || cc.includes('belly') || cc.includes('stomach') || cc.includes('appendi')) {
 return [
 {
 id: `afq-${Date.now()}-1`,
 question: 'Did the pain begin around your navel (belly button) before moving to the lower right side, and does walking or coughing intensify it?',
 reasoning: 'Triage Logic: Classical visceral-to-somatic migration (periumbilical to RLQ McBurney point) has high specificity for acute appendicitis; exacerbation by jarring movements indicates parietal peritoneal irritation.',
 suggestedAnswers: [
 'Yes, started near belly button and migrated to sharp lower right pain',
 'Constant generalized crampy pain across entire abdomen',
 'Pain started directly in right upper quadrant under the ribs',
 ],
 },
 {
 id: `afq-${Date.now()}-2`,
 question: 'Have you experienced complete loss of appetite (anorexia), vomiting, or inability to pass gas or stool?',
 reasoning: 'Triage Logic: Anorexia is present in >80% of acute appendicitis cases; failure to pass gas/stool points to acute mechanical bowel obstruction or paralytic ileus.',
 suggestedAnswers: [
 'Complete loss of appetite and vomited twice',
 'Able to eat small amounts, mild nausea only',
 'No nausea, normal bowel movements today',
 ],
 },
 ];
 }

 return [
 {
 id: `afq-${Date.now()}-1`,
 question: 'Did your symptoms begin suddenly within minutes, or develop gradually over hours to days, and are they worsening right now?',
 reasoning: 'Triage Logic: Rate of symptom progression differentiates acute catastrophic events (vascular, ischemic, rupture) from subacute inflammatory or indolent processes.',
 suggestedAnswers: [
 'Sudden acute onset and rapidly worsening',
 'Gradual progression over several days',
 'Intermittent episodes that come and go',
 ],
 },
 {
 id: `afq-${Date.now()}-2`,
 question: 'Are there specific actions, movements, or positions that relieve or worsen the discomfort?',
 reasoning: 'Triage Logic: Identifying aggravating and relieving factors delineates somatic/musculoskeletal pain from visceral, vascular, or inflammatory pathology.',
 suggestedAnswers: [
 'Worsens significantly with movement and deep breathing',
 'Constant unremitting discomfort unaffected by position',
 'Partially relieved by rest or medication',
 ],
 },
 ];
 };

 const fetchAdaptiveQuestions = async (forced = false) => {
 if (!patient.chiefComplaint || patient.chiefComplaint.trim().length < 4) return;
 if (!forced && questions.length > 0 && lastAnalyzedComplaint === patient.chiefComplaint) return;

 setIsLoading(true);
 try {
 const res = await fetch('/api/interviewer/followup', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 chiefComplaint: patient.chiefComplaint,
 symptomDescription: patient.symptomDescription,
 age: patient.age,
 gender: patient.gender,
 vitals: patient.vitals,
 pastMedicalHistory: patient.pastMedicalHistory,
 }),
 });

 if (res.ok) {
 const data = await res.json();
 if (Array.isArray(data.questions) && data.questions.length > 0) {
 onChange({
 ...patient,
 followUpQuestions: data.questions,
 intakeComplete: false,
 });
 setLastAnalyzedComplaint(patient.chiefComplaint);
 setIsLoading(false);
 return;
 }
 }
 // Fallback
 const fallback = generateFallbackQuestions(patient.chiefComplaint);
 onChange({
 ...patient,
 followUpQuestions: fallback,
 intakeComplete: false,
 });
 setLastAnalyzedComplaint(patient.chiefComplaint);
 } catch {
 const fallback = generateFallbackQuestions(patient.chiefComplaint);
 onChange({
 ...patient,
 followUpQuestions: fallback,
 intakeComplete: false,
 });
 setLastAnalyzedComplaint(patient.chiefComplaint);
 } finally {
 setIsLoading(false);
 }
 };

 // Auto-generate if empty and chief complaint is provided
 useEffect(() => {
 if (patient.chiefComplaint && patient.chiefComplaint.trim().length >= 5 && (!patient.followUpQuestions || patient.followUpQuestions.length === 0)) {
 fetchAdaptiveQuestions();
 }
 }, [patient.chiefComplaint]);

 const handleSelectAnswer = (questionId: string, answerText: string) => {
 const updated = (patient.followUpQuestions || []).map((q) => {
 if (q.id === questionId) {
 return {
 ...q,
 answer: answerText,
 answeredAt: new Date().toISOString(),
 };
 }
 return q;
 });

 const allAnswered = updated.every((q) => q.answer && q.answer.trim().length > 0);
 onChange({
 ...patient,
 followUpQuestions: updated,
 intakeComplete: allAnswered,
 });
 };

 const handleAutoFillAnswers = () => {
 const updated = (patient.followUpQuestions || []).map((q) => {
 const answer = q.answer || (q.suggestedAnswers && q.suggestedAnswers[0]) || 'Confirmed positive finding on clinical inquiry.';
 return {
 ...q,
 answer,
 answeredAt: new Date().toISOString(),
 };
 });

 onChange({
 ...patient,
 followUpQuestions: updated,
 intakeComplete: true,
 });
 };

 const hasComplaintChanged =
 patient.chiefComplaint &&
 lastAnalyzedComplaint &&
 patient.chiefComplaint.trim() !== lastAnalyzedComplaint.trim();

 return (
 <div
 id="adaptive-interviewer-agent-card"
 className="bg-surface border border-muted/20 rounded-xl overflow-hidden shadow-xs"
 >
 {/* Header */}
 <div className="bg-surface border-b border-muted/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
 <Stethoscope className="w-5 h-5" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-xs font-sans font-bold tracking-widest text-primary">
 Interviewer Agent
 </span>
 <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
 Adaptive Triage Logic
 </span>
 </div>
 <h3 className="text-sm sm:text-base font-bold text-ink tracking-tight">
 Adaptive Follow-Up Questions (1-2 Queries Based on Chief Complaint)
 </h3>
 </div>
 </div>

 <div className="flex items-center gap-2 self-start sm:self-auto">
 <button
 type="button"
 id="refresh-adaptive-questions-btn"
 onClick={() => fetchAdaptiveQuestions(true)}
 disabled={isLoading || !patient.chiefComplaint}
 className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-surface hover:bg-muted/5 text-ink border border-muted/20 transition-colors disabled:opacity-50 cursor-pointer"
 title="Re-run triage query analysis for current chief complaint"
 >
 <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
 <span>{isLoading ? 'Analyzing...' : 'Re-ask Questions'}</span>
 </button>
 </div>
 </div>

 <div className="p-5 space-y-4">
 {/* Notice banner if complaint changed */}
 {hasComplaintChanged && (
 <div className="flex items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/30 text-xs text-primary">
 <div className="flex items-center gap-2">
 <Info className="w-4 h-4 text-primary shrink-0" />
 <span>
 Chief complaint has been modified. Would you like the Interviewer Agent to adapt its follow-up questions?
 </span>
 </div>
 <button
 type="button"
 onClick={() => fetchAdaptiveQuestions(true)}
 className="px-2.5 py-1 text-xs font-bold bg-primary hover:bg-primary text-surface shrink-0 transition-colors"
 >
 Update Questions
 </button>
 </div>
 )}

 {/* Empty / Loading States */}
 {isLoading && (
 <div className="p-8 text-center bg-surface border border-muted/20 space-y-2">
 <div className="inline-flex p-3 bg-primary/5 text-primary animate-pulse">
 <Sparkles className="w-6 h-6 animate-spin" />
 </div>
 <h4 className="text-sm font-bold text-ink font-sans font-bold">
 Interviewer Agent Formulating Targeted Triage Questions...
 </h4>
 <p className="text-xs text-muted max-w-md mx-auto">
 Evaluating chief complaint <span className="font-semibold text-muted">"{patient.chiefComplaint}"</span> to select high-yield clinical questions that differentiate critical versus non-critical etiologies.
 </p>
 </div>
 )}

 {!isLoading && questions.length === 0 && (
 <div className="p-6 text-center bg-surface border border-dashed border-muted/20 space-y-3">
 <MessageSquareQuote className="w-8 h-8 text-muted/80 mx-auto" />
 <div>
 <h4 className="text-sm font-bold text-muted font-sans font-bold">No Follow-Up Questions Generated Yet</h4>
 <p className="text-xs text-muted max-w-md mx-auto mt-1">
 Enter a chief complaint above (e.g., chest pain, shortness of breath, acute abdominal pain), then click below to let the Interviewer Agent adaptively question the patient.
 </p>
 </div>
 <button
 type="button"
 id="generate-questions-btn"
 onClick={() => fetchAdaptiveQuestions(true)}
 disabled={!patient.chiefComplaint || patient.chiefComplaint.trim().length < 4}
 className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-surface disabled:opacity-50 transition-colors "
 >
 <Sparkles className="w-3.5 h-3.5" />
 <span>Generate Adaptive Follow-Up Questions</span>
 </button>
 </div>
 )}

 {/* List of Adaptive Follow-Up Questions */}
 {!isLoading && questions.length > 0 && (
 <div className="space-y-4">
 {questions.map((q, idx) => {
 const isAnswered = !!q.answer && q.answer.trim().length > 0;
 const customVal = customInputs[q.id] ?? '';

 return (
 <div
 key={q.id || idx}
 id={`adaptive-question-${idx + 1}`}
 className={` border transition-all ${
 isAnswered
 ? 'bg-surface border-muted/20'
 : 'bg-primary/10 border-primary/40 '
 } p-4 space-y-3`}
 >
 {/* Question Header */}
 <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
 <div className="flex items-start gap-2.5">
 <span
 className={`w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
 isAnswered
 ? 'bg-primary text-surface'
 : 'bg-primary/100 text-surface animate-pulse'
 }`}
 >
 {idx + 1}
 </span>
 <div>
 <div className="text-[11px] font-sans text-muted font-semibold mb-0.5">
 Follow-Up Question {idx + 1} of {questions.length}
 </div>
 <h4 className="text-sm sm:text-base font-bold text-ink leading-snug font-sans font-bold">
 {q.question}
 </h4>
 </div>
 </div>

 <div className="self-end sm:self-start shrink-0">
 {isAnswered ? (
 <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-routine/15 text-routine border border-routine/40">
 <Check className="w-3 h-3 text-routine" /> Answered
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-primary/15 text-primary border border-primary/40">
 <HelpCircle className="w-3 h-3 text-primary" /> Response Required
 </span>
 )}
 </div>
 </div>

 {/* Inline Reasoning Note (Triage Logic) for Evaluators */}
 <div
 id={`question-reasoning-${idx + 1}`}
 className="p-3 bg-primary/5 border border-primary/20 text-xs text-primary space-y-1 rounded-lg"
 >
 <div className="flex items-center gap-1.5 font-bold text-[10px] text-primary">
 <Info className="w-3.5 h-3.5 text-primary shrink-0" />
 <span>Evaluator Note — Interviewer Triage Logic</span>
 </div>
 <p className="leading-relaxed font-medium">
 {q.reasoning}
 </p>
 </div>

 {/* Quick Selectable Answers (Suggested options) */}
 {q.suggestedAnswers && q.suggestedAnswers.length > 0 && (
 <div className="space-y-1.5">
 <div className="text-[11px] font-semibold text-muted flex items-center justify-between">
 <span>Click to Select Patient Response:</span>
 <span className="text-[10px] font-normal text-muted">1-click rapid selection</span>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
 {q.suggestedAnswers.map((sug, sIdx) => {
 const isSelected = q.answer === sug;
 return (
 <button
 key={sIdx}
 type="button"
 onClick={() => handleSelectAnswer(q.id, sug)}
 className={`text-left text-xs p-2.5 border transition-all leading-snug flex items-start justify-between gap-2 ${
 isSelected
 ? 'bg-primary text-surface border-primary font-semibold shadow-xs ring-2 ring-primary/30'
 : 'bg-surface text-ink border-muted/20 hover:bg-primary/5 hover:border-primary/30'
 }`}
 >
 <span>{sug}</span>
 {isSelected && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70" />}
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Or Custom Response Field */}
 <div className="pt-1">
 <div className="flex items-center gap-2">
 <input
 type="text"
 placeholder="Or enter custom patient response..."
 value={customVal || (q.answer && !q.suggestedAnswers?.includes(q.answer) ? q.answer : '')}
 onChange={(e) => setCustomInputs({ ...customInputs, [q.id]: e.target.value })}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && customVal.trim()) {
 handleSelectAnswer(q.id, customVal.trim());
 }
 }}
 className="flex-1 px-3 py-1.5 text-xs border border-muted/20 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
 />
 <button
 type="button"
 onClick={() => {
 if (customVal.trim()) {
 handleSelectAnswer(q.id, customVal.trim());
 }
 }}
 disabled={!customVal.trim()}
 className="px-3 py-1.5 text-xs font-semibold bg-ink text-surface hover:bg-ink/80 disabled:opacity-40 transition-colors"
 >
 Apply
 </button>
 </div>
 </div>

 {/* Recorded Answer Display */}
 {q.answer && (
 <div className="text-xs bg-surface p-2.5 border border-primary/30 flex items-start gap-2">
 <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
 <div className="flex-1">
 <span className="font-bold text-primary">Recorded Answer: </span>
 <span className="text-ink font-medium">"{q.answer}"</span>
 </div>
 </div>
 )}
 </div>
 );
 })}

 {/* Intake Completion Status Bar */}
 <div className="pt-2 border-t border-muted/20">
 {isComplete ? (
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-routine/10 border border-routine/40 text-routine">
 <div className="flex items-center gap-2.5">
 <CheckCircle2 className="w-5 h-5 text-routine shrink-0" />
 <div>
 <div className="text-xs font-black text-routine">
 ✓ Intake Complete • Interviewer Logic Satisfied
 </div>
 <p className="text-xs text-routine font-medium">
 All {questions.length} adaptive follow-up questions answered. Present illness narrative is enriched for multi-agent synthesis.
 </p>
 </div>
 </div>
 <span className="text-[11px] font-sans px-2.5 py-1 bg-routine text-surface font-bold shrink-0 self-start sm:self-auto">
 Intake Validated
 </span>
 </div>
 ) : (
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-primary/10 border border-primary/40 text-primary">
 <div className="flex items-center gap-2.5">
 <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
 <div>
 <div className="text-xs font-bold text-primary">
 Intake Incomplete • {unansweredCount} Follow-Up Question{unansweredCount > 1 ? 's' : ''} Pending
 </div>
 <p className="text-xs text-primary">
 The Interviewer Agent requires patient responses to its targeted questions before intake can be marked complete.
 </p>
 </div>
 </div>
 <button
 type="button"
 id="auto-fill-followup-answers-btn"
 onClick={handleAutoFillAnswers}
 className="px-3 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-surface shrink-0 transition-colors shadow-xs"
 >
 Auto-Fill Typical Answers
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
};
