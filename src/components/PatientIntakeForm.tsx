import React, { useState } from 'react';
import {
  Heart,
  Thermometer,
  Wind,
  Gauge,
  User,
  Clock,
  AlertCircle,
  FileCheck,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { PatientDemographics } from '../types/clinical';
import { AdaptiveInterviewSection } from './AdaptiveInterviewSection';

interface PatientIntakeFormProps {
  patient: PatientDemographics;
  onChange: (updated: PatientDemographics) => void;
  onSelectScenario: (scenarioId: string) => void;
  selectedScenarioId: string | null;
  onNext: () => void;
  onReset?: () => void;
}

export const PatientIntakeForm: React.FC<PatientIntakeFormProps> = ({
  patient,
  onChange,
  selectedScenarioId,
  onNext,
  onReset,
}) => {
  const updateField = <K extends keyof PatientDemographics>(field: K, value: PatientDemographics[K]) => {
    onChange({ ...patient, [field]: value });
  };

  const updateVitals = (vitalKey: keyof PatientDemographics['vitals'], value: number) => {
    onChange({
      ...patient,
      vitals: {
        ...patient.vitals,
        [vitalKey]: value,
      },
    });
  };

  // Helper flags for vitals
  const getHrBadge = (hr: number) => {
    if (hr < 50) return { label: 'Bradycardia', color: 'bg-primary/10 text-primary' };
    if (hr > 120) return { label: 'Marked Tachycardia', color: 'bg-emergency/10 text-emergency' };
    if (hr > 100) return { label: 'Tachycardia', color: 'bg-primary/10 text-primary' };
    return { label: 'Normal (60-100)', color: 'bg-routine/10 text-routine' };
  };

  const getBpBadge = (sbp: number, dbp: number) => {
    if (sbp < 90) return { label: 'Hypotension (Shock Risk)', color: 'bg-emergency/10 text-emergency' };
    if (sbp >= 180 || dbp >= 110) return { label: 'Hypertensive Crisis', color: 'bg-emergency/10 text-emergency' };
    if (sbp >= 140 || dbp >= 90) return { label: 'Hypertension', color: 'bg-primary/10 text-primary' };
    return { label: 'Normal (< 120/80)', color: 'bg-routine/10 text-routine' };
  };

  const getRrBadge = (rr: number) => {
    if (rr >= 30) return { label: 'Severe Tachypnea', color: 'bg-emergency/10 text-emergency' };
    if (rr > 20) return { label: 'Tachypnea', color: 'bg-primary/10 text-primary' };
    return { label: 'Normal (12-20)', color: 'bg-routine/10 text-routine' };
  };

  const getSpo2Badge = (spo2: number) => {
    if (spo2 < 90) return { label: 'Severe Hypoxia', color: 'bg-emergency/10 text-emergency' };
    if (spo2 < 95) return { label: 'Mild Hypoxemia', color: 'bg-primary/10 text-primary' };
    return { label: 'Normal (>= 95%)', color: 'bg-routine/10 text-routine' };
  };

  const getTempBadge = (temp: number) => {
    if (temp >= 39.0) return { label: 'High Fever', color: 'bg-emergency/10 text-emergency' };
    if (temp >= 38.0) return { label: 'Febrile', color: 'bg-primary/10 text-primary' };
    if (temp < 36.0) return { label: 'Hypothermic', color: 'bg-blue-100 text-blue-800' };
    return { label: 'Afebrile (36.5-37.5)', color: 'bg-routine/10 text-routine' };
  };

  const hrStatus = getHrBadge(patient.vitals.heartRate);
  const bpStatus = getBpBadge(patient.vitals.bloodPressureSystolic, patient.vitals.bloodPressureDiastolic);
  const rrStatus = getRrBadge(patient.vitals.respiratoryRate);
  const spo2Status = getSpo2Badge(patient.vitals.oxygenSaturation);
  const tempStatus = getTempBadge(patient.vitals.temperature);

  const [attemptedProceedWithoutAnswers, setAttemptedProceedWithoutAnswers] = useState(false);

  const followUpQuestions = patient.followUpQuestions || [];
  const unansweredCount = followUpQuestions.filter((q) => !q.answer || q.answer.trim().length === 0).length;
  const isIntakeComplete = followUpQuestions.length > 0 && unansweredCount === 0;

  const handleAutoAnswer = () => {
    const updated = followUpQuestions.map((q) => ({
      ...q,
      answer: q.answer || q.suggestedAnswers?.[0] || 'Confirmed on clinical evaluation.',
      answeredAt: new Date().toISOString(),
    }));
    onChange({
      ...patient,
      followUpQuestions: updated,
      intakeComplete: true,
    });
    setAttemptedProceedWithoutAnswers(false);
  };

  const handleProceedClick = () => {
    if (followUpQuestions.length > 0 && unansweredCount > 0) {
      setAttemptedProceedWithoutAnswers(true);
      const el = document.getElementById('adaptive-interviewer-agent-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    setAttemptedProceedWithoutAnswers(false);
    onNext();
  };

  return (
    <div id="patient-intake-section" className="space-y-6">
      {/* Main Intake Form Container */}
      <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
        {/* Header with Top Action Bar */}
        <div className="border-b border-muted/20 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">1. Patient Presentation &amp; Structured History</h2>
              <p className="text-xs text-muted">
                Simulates the structured clinical intake and adaptive interview.
              </p>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-muted/20 text-muted hover:text-ink hover:bg-muted/5 transition-colors cursor-pointer"
                title="Reset intake form"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {unansweredCount > 0 && (
              <button
                type="button"
                onClick={handleAutoAnswer}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                title="Auto-fill recommended clinical answers for interviewer follow-ups"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Fill Follow-ups</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleProceedClick}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-[#09472C] text-white shadow-xs transition-colors cursor-pointer"
            >
              <span>Next: Diagnostics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Demographics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="patient-age-input" className="block text-xs font-semibold text-muted mb-1">
              Patient Age (years) <span className="text-red-500">*</span>
            </label>
            <input
              id="patient-age-input"
              type="number"
              min={1}
              max={110}
              value={patient.age}
              onChange={(e) => updateField('age', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
              required
            />
          </div>

          <div>
            <label htmlFor="patient-gender-select" className="block text-xs font-semibold text-muted mb-1">
              Biological Sex <span className="text-red-500">*</span>
            </label>
            <select
              id="patient-gender-select"
              value={patient.gender}
              onChange={(e) => updateField('gender', e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / Non-Binary</option>
            </select>
          </div>

          <div>
            <label htmlFor="symptom-duration-input" className="block text-xs font-semibold text-muted mb-1">
              Symptom Duration <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="symptom-duration-input"
                type="text"
                value={patient.symptomDuration}
                onChange={(e) => updateField('symptomDuration', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink pl-8"
                placeholder="e.g. 4 days, 18 hours, 30 minutes"
                required
              />
              <Clock className="w-4 h-4 text-muted absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Chief Complaint */}
        <div>
          <label htmlFor="chief-complaint-input" className="block text-xs font-semibold text-muted mb-1">
            Chief Complaint &amp; Presentation at Triage <span className="text-red-500">*</span>
          </label>
          <input
            id="chief-complaint-input"
            type="text"
            value={patient.chiefComplaint}
            onChange={(e) => updateField('chiefComplaint', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
            placeholder="e.g. Crushing retrosternal chest pain radiating to left jaw, sudden shortness of breath..."
            required
          />
        </div>

        {/* Detailed History / HPI */}
        <div>
          <label htmlFor="symptom-description-textarea" className="block text-xs font-semibold text-muted mb-1">
            History of Present Illness (HPI)
          </label>
          <textarea
            id="symptom-description-textarea"
            rows={3}
            value={patient.symptomDescription}
            onChange={(e) => updateField('symptomDescription', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
            placeholder="Describe onset, triggers, quality, aggravating/alleviating factors, radiation, severity..."
          />
        </div>

        {/* Clinical Background (PMH, Meds, Allergies) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label htmlFor="past-medical-history-input" className="block text-xs font-semibold text-muted mb-1">
              Past Medical History
            </label>
            <input
              id="past-medical-history-input"
              type="text"
              value={patient.pastMedicalHistory}
              onChange={(e) => updateField('pastMedicalHistory', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
              placeholder="e.g. Hypertension, COPD, T2DM"
            />
          </div>

          <div>
            <label htmlFor="current-medications-input" className="block text-xs font-semibold text-muted mb-1">
              Current Medications
            </label>
            <input
              id="current-medications-input"
              type="text"
              value={patient.currentMedications}
              onChange={(e) => updateField('currentMedications', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
              placeholder="e.g. Aspirin 81mg, Metformin 500mg"
            />
          </div>

          <div>
            <label htmlFor="allergies-input" className="block text-xs font-semibold text-muted mb-1">
              Allergies
            </label>
            <input
              id="allergies-input"
              type="text"
              value={patient.allergies}
              onChange={(e) => updateField('allergies', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
              placeholder="e.g. Penicillin, Sulfa, NKDA"
            />
          </div>
        </div>

        {/* Adaptive Interviewer Agent Section */}
        <AdaptiveInterviewSection patient={patient} onChange={onChange} />

        {/* Vital Signs Grid */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-ink">
              Objective Vital Signs at Triage
            </h3>
            <span className="text-[11px] text-muted">Evaluated against standard clinical criteria</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Heart Rate */}
            <div className="bg-surface border border-muted/20 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted font-medium flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  Heart Rate
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${hrStatus.color}`}>
                  {hrStatus.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  id="vital-heart-rate-input"
                  type="number"
                  min={30}
                  max={250}
                  value={patient.vitals.heartRate}
                  onChange={(e) => updateVitals('heartRate', parseInt(e.target.value) || 0)}
                  className="w-20 text-lg font-bold bg-transparent border-b border-muted/30 focus:border-primary focus:outline-none text-ink font-mono"
                />
                <span className="text-xs text-muted">bpm</span>
              </div>
            </div>

            {/* Blood Pressure */}
            <div className="bg-surface border border-muted/20 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted font-medium flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-blue-500" />
                  BP (Sys/Dia)
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${bpStatus.color}`}>
                  {bpStatus.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  id="vital-bp-systolic-input"
                  type="number"
                  min={50}
                  max={260}
                  value={patient.vitals.bloodPressureSystolic}
                  onChange={(e) => updateVitals('bloodPressureSystolic', parseInt(e.target.value) || 0)}
                  className="w-12 text-lg font-bold bg-transparent border-b border-muted/30 focus:border-primary focus:outline-none text-ink font-mono text-center"
                />
                <span className="text-muted font-mono font-bold">/</span>
                <input
                  id="vital-bp-diastolic-input"
                  type="number"
                  min={30}
                  max={160}
                  value={patient.vitals.bloodPressureDiastolic}
                  onChange={(e) => updateVitals('bloodPressureDiastolic', parseInt(e.target.value) || 0)}
                  className="w-12 text-lg font-bold bg-transparent border-b border-muted/30 focus:border-primary focus:outline-none text-ink font-mono text-center"
                />
                <span className="text-xs text-muted">mmHg</span>
              </div>
            </div>

            {/* Respiratory Rate */}
            <div className="bg-surface border border-muted/20 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted font-medium flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-teal-500" />
                  Resp Rate
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${rrStatus.color}`}>
                  {rrStatus.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  id="vital-respiratory-rate-input"
                  type="number"
                  min={6}
                  max={60}
                  value={patient.vitals.respiratoryRate}
                  onChange={(e) => updateVitals('respiratoryRate', parseInt(e.target.value) || 0)}
                  className="w-16 text-lg font-bold bg-transparent border-b border-muted/30 focus:border-primary focus:outline-none text-ink font-mono"
                />
                <span className="text-xs text-muted">/min</span>
              </div>
            </div>

            {/* Oxygen Saturation */}
            <div className="bg-surface border border-muted/20 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted font-medium flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-sky-500" />
                  SpO2
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${spo2Status.color}`}>
                  {spo2Status.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  id="vital-spo2-input"
                  type="number"
                  min={50}
                  max={100}
                  value={patient.vitals.oxygenSaturation}
                  onChange={(e) => updateVitals('oxygenSaturation', parseInt(e.target.value) || 0)}
                  className="w-16 text-lg font-bold bg-transparent border-b border-muted/30 focus:border-primary focus:outline-none text-ink font-mono"
                />
                <span className="text-xs text-muted">%</span>
              </div>
            </div>

            {/* Temperature */}
            <div className="bg-surface border border-muted/20 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted font-medium flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                  Temp
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tempStatus.color}`}>
                  {tempStatus.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  id="vital-temp-input"
                  type="number"
                  step="0.1"
                  min={32.0}
                  max={43.0}
                  value={patient.vitals.temperature}
                  onChange={(e) => updateVitals('temperature', parseFloat(e.target.value) || 0)}
                  className="w-16 text-lg font-bold bg-transparent border-b border-muted/30 focus:border-primary focus:outline-none text-ink font-mono"
                />
                <span className="text-xs text-muted">°C</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning if questions pending */}
        {attemptedProceedWithoutAnswers && followUpQuestions.length > 0 && unansweredCount > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-semibold">
                Please answer the {unansweredCount} Interviewer follow-up question{unansweredCount > 1 ? 's' : ''} above, or click auto-answer below.
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoAnswer}
              className="px-3 py-1.5 bg-primary hover:bg-[#09472C] text-white shadow-xs rounded-lg font-semibold shrink-0 transition-colors cursor-pointer"
            >
              Auto-Answer &amp; Proceed
            </button>
          </div>
        )}

        {/* Clean Sticky/Docked Bottom Navigation Bar */}
        <div className="pt-4 border-t border-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-muted">
            <span className="font-medium">Step 1 of 4: Patient Intake</span>
            <span>•</span>
            {isIntakeComplete ? (
              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full bg-routine/10 text-routine border border-routine/20">
                <CheckCircle2 className="w-3 h-3 text-routine" /> Ready for Diagnostics
              </span>
            ) : followUpQuestions.length > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> {unansweredCount} Follow-Up{unansweredCount > 1 ? 's' : ''} Pending
              </span>
            ) : (
              <span>Proceed to add Imaging &amp; Labs</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {unansweredCount > 0 && (
              <button
                type="button"
                onClick={handleAutoAnswer}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                Auto-Answer All
              </button>
            )}

            <button
              id="proceed-to-diagnostics-btn"
              type="button"
              onClick={handleProceedClick}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary hover:bg-[#09472C] text-white shadow-xs transition-all cursor-pointer"
            >
              <span>{isIntakeComplete ? 'Proceed to Labs & Imaging' : 'Complete Intake & Proceed'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
