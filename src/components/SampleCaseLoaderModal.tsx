import React from 'react';
import {
 Sparkles,
 X,
 FileText,
 AlertOctagon,
 AlertTriangle,
 CheckCircle,
 Activity,
 ImageIcon,
 FlaskConical,
 User,
 ArrowRight,
 ShieldCheck,
} from 'lucide-react';
import { CLINICAL_SCENARIOS, type ClinicalScenario } from '../data/clinicalScenarios';

interface SampleCaseLoaderModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelectScenario: (scenario: ClinicalScenario) => void;
 selectedScenarioId?: string | null;
}

export const SampleCaseLoaderModal: React.FC<SampleCaseLoaderModalProps> = ({
 isOpen,
 onClose,
 onSelectScenario,
 selectedScenarioId,
}) => {
 if (!isOpen) return null;

 return (
 <div
 id="sample-case-loader-modal"
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
 >
 <div className="bg-surface border border-muted/20 shadow-2xl rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
 {/* Header */}
 <div className="p-5 sm:p-6 bg-surface text-ink flex items-center justify-between border-b border-muted/20 shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
 <Sparkles className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-base font-bold text-ink">Load Realistic Clinical Scenario</h2>
 <p className="text-xs text-muted">
 Pre-fills intake & diagnostic forms for instant live multi-agent demo
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-muted/10 transition-colors cursor-pointer"
 title="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Notice */}
 <div className="bg-primary/10 border-b border-primary/30 px-5 py-2.5 text-xs text-primary flex items-center gap-2">
 <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
 <span>
 <strong>Authentic Pipeline:</strong> Loading a preset pre-fills all form fields (patient history, vitals, simulated imaging, lab panel). Triggering triage executes real Gemini model inference, ONNX computer vision, live guideline RAG, and Firestore persistence.
 </span>
 </div>

 {/* Scenarios Grid */}
 <div className="p-5 overflow-y-auto space-y-3 flex-1">
 {CLINICAL_SCENARIOS.map((sc) => {
 const isSelected = selectedScenarioId === sc.id;
 const isEmergency = sc.expectedUrgency === 'emergency';
 const isUrgent = sc.expectedUrgency === 'urgent';

 return (
 <div
 key={sc.id}
 id={`sample-scenario-${sc.id}`}
 onClick={() => {
 onSelectScenario(sc);
 onClose();
 }}
 className={`p-4 border transition-all cursor-pointer text-left hover: ${
 isSelected
 ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
 : 'border-muted/20 hover:border-primary/30 hover:bg-surface'
 }`}
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <span
 className={`inline-flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 border ${
 isEmergency
 ? 'bg-emergency/15 text-emergency border border-emergency/30 rounded-md'
 : isUrgent
 ? 'bg-primary/15 text-primary border-primary/30'
 : 'bg-routine/15 text-routine border-routine/30'
 }`}
 >
 {isEmergency ? (
 <AlertOctagon className="w-3 h-3" />
 ) : isUrgent ? (
 <AlertTriangle className="w-3 h-3" />
 ) : (
 <CheckCircle className="w-3 h-3" />
 )}
 {sc.expectedUrgency}
 </span>
 <span className="text-xs font-semibold text-muted tracking-wide">
 {sc.category}
 </span>
 </div>

 <span className="text-[11px] font-sans text-muted/80">
 {sc.patient.age}yo {sc.patient.gender} • Case ID: {sc.id}
 </span>
 </div>

 <h3 className="text-sm font-bold text-ink mt-2 font-sans font-bold">{sc.name}</h3>
 <p className="text-xs text-muted mt-1 leading-relaxed">{sc.shortDescription}</p>

 {/* Key clinical highlights */}
 <div className="mt-3 pt-3 border-t border-muted/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted font-sans">
 <div className="flex items-center gap-3">
 <span className="flex items-center gap-1" title="Vitals">
 <Activity className="w-3 h-3 text-rose-500" />
 HR {sc.patient.vitals.heartRate} | SpO2 {sc.patient.vitals.oxygenSaturation}% | BP {sc.patient.vitals.bloodPressureSystolic}/{sc.patient.vitals.bloodPressureDiastolic}
 </span>
 <span className="flex items-center gap-1 hidden sm:flex" title="Imaging Modality">
 <ImageIcon className="w-3 h-3 text-indigo-500" />
 {sc.imaging.modality}
 </span>
 <span className="flex items-center gap-1 hidden sm:flex" title="Lab Markers">
 <FlaskConical className="w-3 h-3 text-routine" />
 {sc.labs.markers.length} lab markers
 </span>
 </div>

 <span className="text-primary font-bold flex items-center gap-1 text-xs">
 <span>Pre-fill Case</span>
 <ArrowRight className="w-3.5 h-3.5" />
 </span>
 </div>
 </div>
 );
 })}
 </div>

 {/* Footer */}
 <div className="p-4 bg-surface border-t border-muted/20 flex items-center justify-between shrink-0">
 <span className="text-xs text-muted">
 Click any scenario to pre-fill the forms and immediately run or modify.
 </span>
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-1.5 text-xs font-semibold border border-muted/20 bg-surface text-muted hover:bg-surface cursor-pointer"
 >
 Cancel
 </button>
 </div>
 </div>
 </div>
 );
};
