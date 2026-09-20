import React from 'react';
import { X, Clock, Trash2, ChevronRight, AlertOctagon, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import type { ClinicalCase } from '../types/clinical';

interface CaseHistoryDrawerProps {
 isOpen: boolean;
 onClose: () => void;
 cases: ClinicalCase[];
 selectedCaseId: string | null;
 onSelectCase: (caseId: string) => void;
 onDeleteCase: (caseId: string) => void;
}

export const CaseHistoryDrawer: React.FC<CaseHistoryDrawerProps> = ({
 isOpen,
 onClose,
 cases,
 selectedCaseId,
 onSelectCase,
 onDeleteCase,
}) => {
 if (!isOpen) return null;

 const getUrgencyBadge = (urgency?: string) => {
 switch (urgency?.toLowerCase()) {
 case 'emergency':
 return (
 <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emergency/15 text-emergency border border-emergency/40">
 <AlertOctagon className="w-3 h-3" /> EMERGENCY
 </span>
 );
 case 'urgent':
 return (
 <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-primary/15 text-primary border border-primary/40">
 <AlertTriangle className="w-3 h-3" /> URGENT
 </span>
 );
 default:
 return (
 <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-routine/15 text-routine border border-routine/40">
 <CheckCircle className="w-3 h-3" /> ROUTINE
 </span>
 );
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex justify-end">
 {/* Backdrop */}
 <div
 className="fixed inset-0 bg-ink text-surface/50 backdrop-blur-xs transition-opacity"
 onClick={onClose}
 />

 {/* Drawer Panel */}
 <div
 id="case-history-drawer"
 className="relative w-full max-w-md bg-surface h-full shadow-2xl flex flex-col z-10 border-l border-muted/20"
 >
 <div className="p-4 border-b border-muted/20 flex items-center justify-between bg-surface">
 <div className="flex items-center gap-2">
 <Database className="w-4 h-4 text-primary" />
 <h3 className="font-bold text-ink text-sm font-sans font-bold">Saved Clinical Cases</h3>
 <span className="text-xs font-sans text-muted">({cases.length})</span>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-muted/10 transition-colors cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="p-3 bg-primary/5 border-b border-muted/20 text-primary text-xs">
 Persistent storage via Cloud Firestore. Click any case to load the diagnostic synthesis.
 </div>

 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {cases.map((c) => {
 const isSelected = selectedCaseId === c.id;
 const doctorUrgency = c.agentResults?.doctor?.urgencyLevel;

 return (
 <div
 key={c.id}
 id={`case-card-${c.id}`}
 onClick={() => {
 onSelectCase(c.id);
 onClose();
 }}
 className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
 isSelected
 ? 'bg-primary/5 border-primary ring-1 ring-primary'
 : 'bg-surface border-muted/20 hover:border-muted/20 hover:bg-background'
 }`}
 >
 <div className="flex items-start justify-between gap-2 mb-1.5">
 <span className="text-xs font-bold text-ink line-clamp-1">{c.title}</span>
 {getUrgencyBadge(doctorUrgency)}
 </div>

 <p className="text-xs text-muted line-clamp-2 leading-relaxed">
 {c.patient?.chiefComplaint || 'Clinical evaluation'}
 </p>

 <div className="mt-3 pt-2 border-t border-muted/20 flex items-center justify-between text-[11px] text-muted/80">
 <div className="flex items-center gap-1 font-sans">
 <Clock className="w-3 h-3" />
 <span>
 {new Date(c.updatedAt || c.createdAt).toLocaleDateString()} {new Date(c.updatedAt || c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>

 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 onDeleteCase(c.id);
 }}
 className="text-muted/80 hover:text-emergency p-1 cursor-pointer"
 title="Delete case from Firestore"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 );
 })}

 {cases.length === 0 && (
 <div className="text-center py-12 text-muted/80 text-xs">
 No saved cases found in Firestore yet. Run your first triage to persist records.
 </div>
 )}
 </div>
 </div>
 </div>
 );
};
