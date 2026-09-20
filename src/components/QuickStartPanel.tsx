import React, { useState } from 'react';
import { Sparkles, Zap, ChevronRight, UserPlus, Heart, Activity, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { CLINICAL_SCENARIOS, ClinicalScenario } from '../data/clinicalScenarios';
import type { PatientDemographics, ImagingStudy, LabPanelData } from '../types/clinical';

interface QuickStartPanelProps {
  onSelectScenario: (scenario: ClinicalScenario, autoRun?: boolean) => void;
  onStartBlankCase: () => void;
  selectedScenarioId: string | null;
  className?: string;
}

export const QuickStartPanel: React.FC<QuickStartPanelProps> = ({
  onSelectScenario,
  onStartBlankCase,
  selectedScenarioId,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section
      id="quick-start-panel"
      className={`bg-surface border border-muted/20 rounded-xl p-5 sm:p-6 shadow-xs transition-all ${className}`}
    >
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">Clinical Quick Start</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                1-Click Triage
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Select a clinical presentation to inspect or trigger full multi-agent triage instantly.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="quick-start-blank-case-btn"
            type="button"
            onClick={onStartBlankCase}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-muted/20 text-ink hover:bg-muted/5 transition-colors cursor-pointer"
            title="Start from scratch with normal baseline vitals"
          >
            <UserPlus className="w-3.5 h-3.5 text-muted" />
            <span>Blank Patient</span>
          </button>

          <button
            id="quick-start-toggle-expand-btn"
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-muted/20 text-muted hover:text-ink hover:bg-muted/5 transition-colors cursor-pointer"
            aria-expanded={isExpanded}
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scenario Cards Grid */}
      {isExpanded && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {CLINICAL_SCENARIOS.map((sc) => {
              const isSelected = selectedScenarioId === sc.id;
              const isEmergency = sc.expectedUrgency === 'emergency';
              const isUrgent = sc.expectedUrgency === 'urgent';

              return (
                <div
                  key={sc.id}
                  id={`quick-start-card-${sc.id}`}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-primary/5 border-primary ring-1 ring-primary shadow-xs'
                      : 'bg-surface border-muted/20 hover:border-primary/40 hover:bg-primary/[0.02]'
                  }`}
                >
                  {/* Top: Category & Urgency Badges */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-medium text-muted">{sc.category}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isEmergency
                            ? 'bg-emergency/10 text-emergency border border-emergency/30'
                            : isUrgent
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-routine/10 text-routine border border-routine/30'
                        }`}
                      >
                        {sc.expectedUrgency.toUpperCase()}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-sm font-bold text-ink leading-snug line-clamp-1">{sc.name}</h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                      {sc.shortDescription}
                    </p>

                    {/* Vitals Snapshot */}
                    <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-muted/10 text-[11px] text-muted font-mono">
                      <span className="inline-flex items-center gap-1">
                        <Activity className="w-3 h-3 text-primary" />
                        BP {sc.patient.vitals.bloodPressureSystolic}/{sc.patient.vitals.bloodPressureDiastolic}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-500" />
                        HR {sc.patient.vitals.heartRate}
                      </span>
                      <span>•</span>
                      <span>O₂ {sc.patient.vitals.oxygenSaturation}%</span>
                      <span>•</span>
                      <span>T {sc.patient.vitals.temperature}°C</span>
                    </div>
                  </div>

                  {/* Ergonomic Button Placements on Card */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-muted/10">
                    <button
                      id={`inspect-scenario-btn-${sc.id}`}
                      type="button"
                      onClick={() => onSelectScenario(sc, false)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-muted/20 text-ink hover:bg-muted/5'
                      }`}
                    >
                      {isSelected ? 'Currently Loaded' : 'Review & Customize'}
                    </button>

                    <button
                      id={`quick-run-scenario-btn-${sc.id}`}
                      type="button"
                      onClick={() => onSelectScenario(sc, true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-[#09472C] text-white shadow-xs transition-all cursor-pointer"
                      title="Load and immediately trigger multi-agent clinical decision-support pipeline"
                    >
                      <Zap className="w-3 h-3 text-amber-300" />
                      <span>1-Click Triage</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-muted pt-1 px-1">
            <span>💡 1-Click Triage analyzes history, PACS imaging, and lab panels with all 4 AI agents.</span>
            {selectedScenarioId && (
              <span className="text-primary font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Case loaded in form
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
