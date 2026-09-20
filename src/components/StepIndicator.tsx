import React from 'react';
import { UserCheck, Layers, Bot, FileText, Check } from 'lucide-react';

export type WorkflowStep = 'intake' | 'diagnostics' | 'processing' | 'report';

interface StepIndicatorProps {
  currentStep: WorkflowStep;
  onStepClick: (step: WorkflowStep) => void;
  canNavigateToReport: boolean;
  canNavigateToProcessing: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  onStepClick,
  canNavigateToReport,
  canNavigateToProcessing,
}) => {
  const steps: { id: WorkflowStep; label: string; sub: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'intake', label: '1. Patient Intake', sub: 'Adaptive Interview & Vitals', icon: UserCheck },
    { id: 'diagnostics', label: '2. Labs & Imaging', sub: 'Radiology & Chemistry', icon: Layers },
    { id: 'processing', label: '3. Multi-Agent Triage', sub: '4 Agents & CDS Pipeline', icon: Bot },
    { id: 'report', label: '4. Clinical Report', sub: 'Differential & Care Plan', icon: FileText },
  ];

  const stepOrder: WorkflowStep[] = ['intake', 'diagnostics', 'processing', 'report'];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div id="workflow-step-indicator" className="bg-surface border-b border-muted/20 py-3 px-4 sm:px-6 transition-colors">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isPassed = currentIndex > idx;
          const isClickable =
            (step.id === 'intake') ||
            (step.id === 'diagnostics') ||
            (step.id === 'processing' && canNavigateToProcessing) ||
            (step.id === 'report' && canNavigateToReport);

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                id={`step-nav-${step.id}`}
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2.5 text-left transition-all ${
                  isClickable ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors shrink-0 ${
                    isActive
                      ? 'bg-primary text-white shadow-xs'
                      : isPassed
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-muted/5 text-muted border border-muted/20 group-hover:border-muted/40'
                  }`}
                >
                  {isPassed ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="hidden md:block">
                  <div className={`text-xs font-semibold tracking-tight transition-colors ${
                    isActive ? 'text-primary' : isPassed ? 'text-ink' : 'text-muted'
                  }`}>
                    {step.label}
                  </div>
                  <div className="text-[11px] text-muted/80">{step.sub}</div>
                </div>
              </button>

              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2.5 sm:mx-4 transition-colors rounded-full ${
                    currentIndex > idx ? 'bg-primary' : 'bg-muted/15'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
