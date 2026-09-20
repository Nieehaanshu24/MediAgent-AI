/**
 * MediAgent AI — Multi-Agent Clinical Decision-Support Triage Educational Prototype
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { QuickStartPanel } from './components/QuickStartPanel';
import { StepIndicator, type WorkflowStep } from './components/StepIndicator';
import { PatientIntakeForm } from './components/PatientIntakeForm';
import { DiagnosticsForm } from './components/DiagnosticsForm';
import { AgentProcessingView } from './components/AgentProcessingView';
import { FinalReportView } from './components/FinalReportView';
import { CaseHistoryDrawer } from './components/CaseHistoryDrawer';
import { SampleCaseLoaderModal } from './components/SampleCaseLoaderModal';
import { AuthScreen } from './components/AuthScreen';
import { CLINICAL_SCENARIOS, type ClinicalScenario } from './data/clinicalScenarios';
import type {
 ClinicalCase,
 PatientDemographics,
 ImagingStudy,
 LabPanelData,
 LivePipelineProgress,
} from './types/clinical';

export default function App() {
 const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
 const [currentStep, setCurrentStep] = useState<WorkflowStep>('intake');
 const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>('case-pneumonia-sepsis');
 const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);

 // Active Case Inputs
 const initialScenario = CLINICAL_SCENARIOS[0];
 const [patient, setPatient] = useState<PatientDemographics>(initialScenario.patient);
 const [imaging, setImaging] = useState<ImagingStudy>(initialScenario.imaging);
 const [labs, setLabs] = useState<LabPanelData>(initialScenario.labs);

 // Active Case Record & Agent Results
 const [activeCase, setActiveCase] = useState<ClinicalCase | null>(null);
 const [isProcessing, setIsProcessing] = useState<boolean>(false);
 const [processingError, setProcessingError] = useState<string | null>(null);
 const [liveProgress, setLiveProgress] = useState<LivePipelineProgress | null>(null);

 // Firestore History & App State
 const [savedCases, setSavedCases] = useState<ClinicalCase[]>([]);
 const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
 const [dbConnected, setDbConnected] = useState<boolean>(true);

 // Warm Dark Mode State
 const [darkMode, setDarkMode] = useState<boolean>(() => {
 return localStorage.getItem('mediagent_theme') === 'dark';
 });

 useEffect(() => {
 if (darkMode) {
 document.documentElement.classList.add('dark');
 localStorage.setItem('mediagent_theme', 'dark');
 } else {
 document.documentElement.classList.remove('dark');
 localStorage.setItem('mediagent_theme', 'light');
 }
 }, [darkMode]);

 const toggleDarkMode = () => {
 setDarkMode((prev) => !prev);
 };

 // Initial fetch of saved cases from Firestore backend
 useEffect(() => {
 fetchSavedCases();
 checkHealth();
 }, []);

 const checkHealth = async () => {
 try {
 const res = await fetch('/api/health');
 if (res.ok) {
 setDbConnected(true);
 }
 } catch (err) {
 console.warn('Backend health check warning:', err);
 }
 };

 const fetchSavedCases = async () => {
 try {
 const res = await fetch('/api/cases');
 if (res.ok) {
 const data: ClinicalCase[] = await res.json();
 setSavedCases(data);
 }
 } catch (err) {
 console.warn('Failed to fetch cases from Firestore:', err);
 }
 };

 const handleSelectScenario = (scenarioId: string | ClinicalScenario) => {
 let sc: ClinicalScenario | undefined;
 if (typeof scenarioId === 'string') {
 sc = CLINICAL_SCENARIOS.find((s) => s.id === scenarioId);
 } else {
 sc = scenarioId;
 }
 if (!sc) return;

 setSelectedScenarioId(sc.id);
 setPatient({ ...sc.patient });
 setImaging({ ...sc.imaging });
 setLabs({ ...sc.labs });
 setActiveCase(null);
 };

 const handleStartNewCase = () => {
 setSelectedScenarioId(null);
 setPatient({
 age: 45,
 gender: 'male',
 chiefComplaint: '',
 symptomDuration: '',
 symptomDescription: '',
 pastMedicalHistory: '',
 currentMedications: '',
 allergies: '',
 vitals: {
 heartRate: 75,
 bloodPressureSystolic: 120,
 bloodPressureDiastolic: 80,
 respiratoryRate: 16,
 oxygenSaturation: 98,
 temperature: 37.0,
 },
 });
 setImaging({
 modality: 'Chest X-Ray (PA/AP)',
 clinicalIndication: '',
 });
 setLabs({
 markers: [
 { name: 'White Blood Cell Count (WBC)', value: 7.2, unit: '10^3/uL', referenceRange: '4.5 - 11.0', status: 'NORMAL' },
 { name: 'Hemoglobin', value: 14.5, unit: 'g/dL', referenceRange: '13.5 - 17.5', status: 'NORMAL' },
 { name: 'Platelet Count', value: 250, unit: '10^3/uL', referenceRange: '150 - 450', status: 'NORMAL' },
 ],
 rawReportText: '',
 });
 setActiveCase(null);
 setCurrentStep('intake');
 };

 const handleRunTriage = async () => {
 setIsProcessing(true);
 setProcessingError(null);
 setCurrentStep('processing');

 const initialProgress: LivePipelineProgress = {
 interviewer: {
 status: 'running',
 message: 'Synthesizing patient history, chief complaint & adaptive follow-up responses...',
 },
 radiologist: {
 status: 'running',
 message: 'Running DenseNet-121 ONNX neural model & generating structured radiologic findings...',
 },
 labAnalyst: {
 status: 'running',
 message: 'Screening laboratory biomarkers against clinical reference thresholds & critical limits...',
 },
 rag: {
 status: 'waiting',
 message: 'Waiting for specialist agent outputs to formulate RAG vector query...',
 },
 doctor: {
 status: 'waiting',
 message: 'Waiting for multi-modal specialist consensus & guideline retrieval...',
 },
 elapsedMs: 0,
 };
 setLiveProgress(initialProgress);

 try {
 const response = await fetch('/api/triage/stream', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 caseId: activeCase?.id,
 title: `${patient.age}${patient.gender.charAt(0).toUpperCase()} - ${patient.chiefComplaint.slice(0, 40)}`,
 patient,
 imaging,
 labs,
 }),
 });

 if (!response.ok) {
 throw new Error(`Server responded with status ${response.status}`);
 }

 if (!response.body) {
 // Fallback to standard endpoint
 const fbResponse = await fetch('/api/triage/run', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 caseId: activeCase?.id,
 title: `${patient.age}${patient.gender.charAt(0).toUpperCase()} - ${patient.chiefComplaint.slice(0, 40)}`,
 patient,
 imaging,
 labs,
 }),
 });
 const completedCase: ClinicalCase = await fbResponse.json();
 setActiveCase(completedCase);
 fetchSavedCases();
 return;
 }

 const reader = response.body.getReader();
 const decoder = new TextDecoder();
 let buffer = '';

 while (true) {
 const { done, value } = await reader.read();
 if (done) break;

 buffer += decoder.decode(value, { stream: true });
 const blocks = buffer.split('\n\n');
 buffer = blocks.pop() || '';

 for (const block of blocks) {
 if (!block.trim()) continue;
 const eventMatch = block.match(/event:\s*([^\n]+)/);
 const dataMatch = block.match(/data:\s*([^\n]+)/);

 if (eventMatch && dataMatch) {
 const eventType = eventMatch[1].trim();
 try {
 const data = JSON.parse(dataMatch[1].trim());

 if (eventType === 'agent_status') {
 setLiveProgress((prev) => {
 const current: LivePipelineProgress = prev || initialProgress;
 const agentKey = data.agent as keyof LivePipelineProgress;
 if (agentKey in current) {
 return {
 ...current,
 [agentKey]: {
 status: data.status,
 message: data.message,
 executionTimeMs: data.executionTimeMs,
 preview: data.preview,
 startedAt: data.startedAt,
 },
 };
 }
 return current;
 });
 } else if (eventType === 'complete') {
 if (data.clinicalCase) {
 setActiveCase(data.clinicalCase);
 fetchSavedCases();
 }
 } else if (eventType === 'error') {
 throw new Error(data.error || 'Pipeline execution error');
 }
 } catch (parseErr) {
 console.warn('SSE parse error:', parseErr);
 }
 }
 }
 }
 } catch (err: any) {
 console.error('Streaming triage pipeline error, falling back to /api/triage/run:', err);
 try {
 const fbResponse = await fetch('/api/triage/run', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 caseId: activeCase?.id,
 title: `${patient.age}${patient.gender.charAt(0).toUpperCase()} - ${patient.chiefComplaint.slice(0, 40)}`,
 patient,
 imaging,
 labs,
 }),
 });
 if (fbResponse.ok) {
 const completedCase: ClinicalCase = await fbResponse.json();
 setActiveCase(completedCase);
 fetchSavedCases();
 return;
 }
 } catch (fbErr) {
 console.error('Fallback also failed:', fbErr);
 }
 setProcessingError(err.message || 'An unexpected error occurred during multi-agent inference.');
 } finally {
 setIsProcessing(false);
 }
 };

 const handleSelectSavedCase = async (caseId: string) => {
 // Instant local fallback
 const existing = savedCases.find((c) => c.id === caseId);
 if (existing) {
 setActiveCase(existing);
 setPatient(existing.patient);
 if (existing.imaging) setImaging(existing.imaging);
 if (existing.labs) setLabs(existing.labs);
 if (existing.agentResults?.doctor) {
 setCurrentStep('report');
 } else {
 setCurrentStep('intake');
 }
 }

 try {
 const res = await fetch(`/api/cases/${caseId}`);
 if (res.ok) {
 const c: ClinicalCase = await res.json();
 setActiveCase(c);
 setPatient(c.patient);
 if (c.imaging) setImaging(c.imaging);
 if (c.labs) setLabs(c.labs);

 if (c.agentResults?.doctor) {
 setCurrentStep('report');
 } else {
 setCurrentStep('intake');
 }
 }
 } catch (err) {
 console.error('Failed to load saved case:', err);
 }
 };

 const handleDeleteCase = async (caseId: string) => {
 try {
 const res = await fetch(`/api/cases/${caseId}`, { method: 'DELETE' });
 if (res.ok) {
 setSavedCases((prev) => prev.filter((c) => c.id !== caseId));
 if (activeCase?.id === caseId) {
 setActiveCase(null);
 setCurrentStep('intake');
 }
 }
 } catch (err) {
 console.error('Failed to delete case:', err);
 }
 };

 const canNavigateToReport = !!activeCase?.agentResults?.doctor;
 const canNavigateToProcessing = isProcessing || !!activeCase;

 if (!isAuthenticated) {
 return <AuthScreen onLogin={() => setIsAuthenticated(true)} />;
 }

 return (
 <div className="min-h-screen bg-background text-ink flex flex-col font-sans">
 {/* App Header */}
 <Header
 onNewCase={handleStartNewCase}
 onOpenHistory={() => setIsDrawerOpen(true)}
 onOpenSampleCases={() => setIsSampleModalOpen(true)}
 casesCount={savedCases.length}
 dbConnected={dbConnected}
 darkMode={darkMode}
 onToggleDarkMode={toggleDarkMode}
 />

 {/* 4-Step Process Bar */}
 <StepIndicator
 currentStep={currentStep}
 onStepClick={(step) => setCurrentStep(step)}
 canNavigateToReport={canNavigateToReport}
 canNavigateToProcessing={canNavigateToProcessing}
 />

 {/* Main View Container */}
 <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
 {currentStep === 'intake' && (
 <PatientIntakeForm
 patient={patient}
 onChange={setPatient}
 onSelectScenario={handleSelectScenario}
 selectedScenarioId={selectedScenarioId}
 onNext={() => setCurrentStep('diagnostics')}
 />
 )}

 {currentStep === 'diagnostics' && (
 <DiagnosticsForm
 imaging={imaging}
 onImagingChange={setImaging}
 labs={labs}
 onLabsChange={setLabs}
 onBack={() => setCurrentStep('intake')}
 onRunTriage={handleRunTriage}
 />
 )}

 {currentStep === 'processing' && (
 <AgentProcessingView
 clinicalCase={activeCase}
 isProcessing={isProcessing}
 processingError={processingError}
 liveProgress={liveProgress}
 onViewReport={() => setCurrentStep('report')}
 onRetry={handleRunTriage}
 />
 )}

 {currentStep === 'report' && activeCase && (
 <FinalReportView
 clinicalCase={activeCase}
 onEditCase={() => setCurrentStep('diagnostics')}
 onNewCase={handleStartNewCase}
 />
 )}
 </main>

 {/* Saved Cases History Drawer */}
 <CaseHistoryDrawer
 isOpen={isDrawerOpen}
 onClose={() => setIsDrawerOpen(false)}
 cases={savedCases}
 selectedCaseId={activeCase?.id || null}
 onSelectCase={handleSelectSavedCase}
 onDeleteCase={handleDeleteCase}
 />

 {/* Sample Case Loader Modal */}
 <SampleCaseLoaderModal
 isOpen={isSampleModalOpen}
 onClose={() => setIsSampleModalOpen(false)}
 onSelectScenario={handleSelectScenario}
 selectedScenarioId={selectedScenarioId}
 />

 {/* Persistent Bottom Academic / Prototype Notice */}
 <footer className="bg-ink text-surface border-t border-slate-800 text-muted/80 text-xs py-4 px-4 text-center print:hidden">
 <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
 <span>MediAgent AI • Multi-Agent Clinical Decision-Support Triage Educational Prototype</span>
 <span className="text-[11px] font-sans text-primary">
 Explainable AI • Vector G RAG • Cloud Firestore
 </span>
 </div>
 </footer>
 </div>
 );
}
