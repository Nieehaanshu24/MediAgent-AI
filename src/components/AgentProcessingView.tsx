import React, { useEffect, useState } from 'react';
import {
 Bot,
 UserCheck,
 ImageIcon,
 FlaskConical,
 BookOpen,
 Stethoscope,
 CheckCircle2,
 Loader2,
 AlertCircle,
 Clock,
 ArrowRight,
 Zap,
 Activity,
 Sparkles,
} from 'lucide-react';
import type { ClinicalCase, LivePipelineProgress, LiveAgentStatus } from '../types/clinical';

interface AgentProcessingViewProps {
 clinicalCase: ClinicalCase | null;
 isProcessing: boolean;
 processingError: string | null;
 liveProgress?: LivePipelineProgress | null;
 onViewReport: () => void;
 onRetry: () => void;
}

interface AgentDisplayConfig {
 id: 'interviewer' | 'radiologist' | 'labAnalyst' | 'rag' | 'doctor';
 name: string;
 role: string;
 icon: React.ComponentType<{ className?: string }>;
 defaultWaitingText: string;
 defaultRunningText: string;
}

const AGENT_CONFIGS: AgentDisplayConfig[] = [
 {
 id: 'interviewer',
 name: 'Interviewer Agent',
 role: 'Adaptive Clinical History, Follow-Ups & Vitals Synthesis',
 icon: UserCheck,
 defaultWaitingText: 'Waiting in queue for intake ingestion...',
 defaultRunningText: 'Analyzing patient history, chief complaint & adaptive follow-up responses...',
 },
 {
 id: 'radiologist',
 name: 'Radiologist Agent',
 role: 'DenseNet-121 ONNX Classifier & Region Observations',
 icon: ImageIcon,
 defaultWaitingText: 'Waiting for radiological image payload...',
 defaultRunningText: 'Running DenseNet-121 ONNX model & extracting structured image findings...',
 },
 {
 id: 'labAnalyst',
 name: 'Lab Analyst Agent',
 role: 'Biochemical Pathology & Derived Clinical Indices',
 icon: FlaskConical,
 defaultWaitingText: 'Waiting for biomarker panel inputs...',
 defaultRunningText: 'Screening laboratory biomarkers against clinical reference ranges & critical alerts...',
 },
 {
 id: 'rag',
 name: 'Clinical Guidelines RAG',
 role: 'Vector Embeddings & Live Cosine Similarity Search',
 icon: BookOpen,
 defaultWaitingText: 'Waiting for specialist agent outputs to construct search query...',
 defaultRunningText: 'Querying vector embeddings index for evidence-based clinical guidelines...',
 },
 {
 id: 'doctor',
 name: 'Doctor Agent (Synthesizer)',
 role: 'Final Triage, G Citations & Urgency Stratification',
 icon: Stethoscope,
 defaultWaitingText: 'Waiting for multi-modal evidence integration...',
 defaultRunningText: 'Synthesizing multi-modal findings, resolving discrepancies & computing CDS triage...',
 },
];

export const AgentProcessingView: React.FC<AgentProcessingViewProps> = ({
 clinicalCase,
 isProcessing,
 processingError,
 liveProgress,
 onViewReport,
 onRetry,
}) => {
 const [elapsedTimer, setElapsedTimer] = useState(0);

 // Real client-side elapsed timer tracking duration of the actual in-flight HTTP request
 useEffect(() => {
 let interval: NodeJS.Timeout | null = null;
 if (isProcessing) {
 setElapsedTimer(0);
 const start = Date.now();
 interval = setInterval(() => {
 setElapsedTimer(Math.floor((Date.now() - start) / 100) / 10);
 }, 100);
 }
 return () => {
 if (interval) clearInterval(interval);
 };
 }, [isProcessing]);

 const timing = clinicalCase?.agentExecutionTimes;
 const isDone = clinicalCase?.status === 'completed' && !isProcessing;

 // Resolve true agent status reflecting real request state
 const getAgentStatus = (agentId: 'interviewer' | 'radiologist' | 'labAnalyst' | 'rag' | 'doctor'): {
 status: LiveAgentStatus;
 executionTimeMs?: number;
 snippet: string;
 } => {
 // If we have live progress events from the SSE stream
 if (liveProgress && liveProgress[agentId]) {
 const live = liveProgress[agentId];
 const snippet =
 live.status === 'done'
 ? live.preview || 'Agent inference completed successfully'
 : live.status === 'running'
 ? live.message || AGENT_CONFIGS.find((a) => a.id === agentId)?.defaultRunningText || 'Processing...'
 : AGENT_CONFIGS.find((a) => a.id === agentId)?.defaultWaitingText || 'Waiting in queue';

 return {
 status: live.status,
 executionTimeMs: live.executionTimeMs,
 snippet,
 };
 }

 // Fallback based on completed clinicalCase payload
 if (isDone) {
 let time: number | undefined;
 let snippet = '';

 if (agentId === 'interviewer') {
 time = timing?.interviewerMs;
 snippet = clinicalCase?.agentResults?.interviewer?.clinicalSummary || 'Interviewer analysis completed.';
 } else if (agentId === 'radiologist') {
 time = timing?.radiologistMs;
 snippet =
 clinicalCase?.agentResults?.radiologist?.overallImpression ||
 clinicalCase?.agentResults?.radiologist?.radiologicalImpression ||
 'Radiology analysis completed.';
 } else if (agentId === 'labAnalyst') {
 time = timing?.labAnalystMs;
 snippet = clinicalCase?.agentResults?.labAnalyst?.labImpression || 'Biochemical evaluation completed.';
 } else if (agentId === 'rag') {
 time = timing?.ragRetrievalMs;
 const gCount = clinicalCase?.agentResults?.retrievedGuidelines?.length || 0;
 snippet = `Retrieved ${gCount} evidence-based clinical guidelines matching multi-modal presentation.`;
 } else if (agentId === 'doctor') {
 time = timing?.doctorMs;
 snippet =
 clinicalCase?.agentResults?.doctor?.clinicalExecutiveSummary ||
 `Triage: ${clinicalCase?.agentResults?.doctor?.urgencyLevel.toUpperCase()} — Full multi-agent consensus finalized.`;
 }

 return {
 status: 'done',
 executionTimeMs: time,
 snippet,
 };
 }

 // While processing without SSE events yet
 if (isProcessing) {
 return {
 status: 'running',
 snippet: AGENT_CONFIGS.find((a) => a.id === agentId)?.defaultRunningText || 'Executing request...',
 };
 }

 return {
 status: 'waiting',
 snippet: AGENT_CONFIGS.find((a) => a.id === agentId)?.defaultWaitingText || 'Waiting in queue',
 };
 };

 return (
 <div id="agent-processing-view" className="max-w-4xl mx-auto space-y-6">
 {/* Header status banner */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs ">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center gap-3.5">
 <div
 className={`w-12 h-12 rounded-xl flex items-center justify-center text-surface transition-colors ${
 isDone
 ? 'bg-routine'
 : isProcessing
 ? 'bg-primary ring-4 ring-primary/20 animate-pulse'
 : 'bg-surface'
 }`}
 >
 <Bot className="w-7 h-7" />
 </div>

 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-lg font-bold text-ink font-sans font-bold">
 {isProcessing
 ? 'Collaborative Multi-Agent Execution'
 : isDone
 ? 'Multi-Agent Triage Pipeline Complete'
 : 'Multi-Agent Processing'}
 </h2>
 {isProcessing && (
 <span className="inline-flex items-center gap-1 text-[11px] font-sans px-2 py-0.5 bg-primary/10 text-primary font-bold border border-primary/30">
 <span className="w-1.5 h-1.5 bg-primary/90 animate-ping" />
 LIVE PIPELINE
 </span>
 )}
 </div>

 <p className="text-xs text-muted mt-0.5 font-sans">
 {isProcessing
 ? `Real Request State • In-Flight: ${elapsedTimer.toFixed(1)}s elapsed • Real-Time Model Streams`
 : isDone
 ? `Total Execution: ${((timing?.totalMs || elapsedTimer * 1000) / 1000).toFixed(2)}s • Saved to Cloud Firestore`
 : 'Ready to initiate multi-agent clinical decision support'}
 </p>
 </div>
 </div>

 {isDone && (
 <button
 id="view-final-report-btn"
 type="button"
 onClick={onViewReport}
 className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-primary hover:bg-[#09472C] text-white rounded-lg shadow-xs transition-all cursor-pointer shrink-0"
 >
 <span>View Clinical Report</span>
 <ArrowRight className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Error Card */}
 {processingError && (
 <div className="bg-emergency/10 border-2 border-emergency/30 p-4 text-emergency flex items-start gap-3 shadow-xs">
 <AlertCircle className="w-5 h-5 text-emergency shrink-0 mt-0.5" />
 <div className="flex-1">
 <h3 className="text-sm font-bold font-sans font-bold">Inference Execution Error</h3>
 <p className="text-xs text-emergency mt-0.5 font-sans leading-relaxed">{processingError}</p>
 <button
 id="retry-triage-btn"
 type="button"
 onClick={onRetry}
 className="mt-3 px-4 py-1.5 bg-emergency hover:bg-red-700 text-surface text-xs font-semibold cursor-pointer shadow-xs"
 >
 Retry Pipeline
 </button>
 </div>
 </div>
 )}

 {/* Real-time Agent Cards */}
 <div className="space-y-3">
 {AGENT_CONFIGS.map((agentCfg, idx) => {
 const Icon = agentCfg.icon;
 const { status, executionTimeMs, snippet } = getAgentStatus(agentCfg.id);

 const isRunning = status === 'running';
 const isCompleted = status === 'done';
 const isWaiting = status === 'waiting';

 return (
 <div
 key={agentCfg.id}
 id={`agent-card-${agentCfg.id}`}
 className={`p-4 border transition-all duration-200 ${
 isRunning
 ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
 : isCompleted
 ? 'bg-surface border-muted/20 '
 : 'bg-surface border-muted/20 opacity-60'
 }`}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-3.5">
 <div
 className={`w-10 h-10 flex items-center justify-center shrink-0 transition-colors ${
 isCompleted
 ? 'bg-primary/10 text-primary'
 : isRunning
 ? 'bg-primary text-surface '
 : 'bg-surface text-muted'
 }`}
 >
 <Icon className="w-5 h-5" />
 </div>

 <div>
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-sans font-bold text-muted/80">0{idx + 1}</span>
 <h3 className="text-sm font-bold text-ink font-sans font-bold">{agentCfg.name}</h3>
 <span className="text-xs text-muted hidden sm:inline">• {agentCfg.role}</span>
 </div>

 <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed font-sans">
 {snippet}
 </p>
 </div>
 </div>

 <div className="shrink-0 flex items-center gap-2">
 {/* Live Status Indicators reflecting REAL request state */}
 {isRunning && (
 <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-bold border border-primary/30 shadow-xs">
 <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
 <span>Running</span>
 </div>
 )}

 {isCompleted && (
 <div className="flex items-center gap-2">
 {executionTimeMs !== undefined && executionTimeMs > 0 && (
 <span className="text-[11px] font-sans text-muted flex items-center gap-1">
 <Clock className="w-3 h-3 text-muted/80" />
 {executionTimeMs}ms
 </span>
 )}
 <div className="flex items-center gap-1 text-routine text-xs font-bold px-2.5 py-1 bg-routine/15 border border-routine/40">
 <CheckCircle2 className="w-3.5 h-3.5 text-routine" />
 <span>Done</span>
 </div>
 </div>
 )}

 {isWaiting && (
 <span className="text-[11px] font-sans text-muted/80 px-2.5 py-1 bg-surface border border-muted/20">
 Waiting
 </span>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Completion CTA Bar */}
 {isDone && (
 <div className="bg-ink text-surface p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-primary/60">
 <div>
 <div className="flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-amber-300" />
 <h3 className="text-sm font-bold tracking-tight font-sans font-bold">Multi-Modal Consensus Ready for Clinical Review</h3>
 </div>
 <p className="text-xs text-surface/80 mt-1 font-sans">
 CDS Urgency Level: <span className="font-bold text-amber-300 underline underline-offset-2">{clinicalCase.agentResults?.doctor?.urgencyLevel || 'EVALUATED'}</span>. Synthesized with evidence citations & guideline criteria.
 </p>
 </div>
 <button
 id="proceed-to-final-report-btn"
 type="button"
 onClick={onViewReport}
 className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-2"
 >
 <span>Open Full Clinical Report</span>
 <ArrowRight className="w-4 h-4" />
 </button>
 </div>
 )}
 </div>
 );
};
