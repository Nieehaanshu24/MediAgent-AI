import React, { useRef, useState } from 'react';
import {
 Upload,
 Image as ImageIcon,
 FlaskConical,
 Plus,
 Trash2,
 ChevronLeft,
 ChevronRight,
 ChevronDown,
 ChevronUp,
 Bot,
 AlertTriangle,
 Info,
 Sparkles,
 CheckCircle2,
 RefreshCw,
 Layers,
 AlertCircle,
 Eye,
 EyeOff,
} from 'lucide-react';
import type { ImagingStudy, LabPanelData, LabMarker, RadiologistFinding } from '../types/clinical';
import { evaluateLabMarker, partitionLabMarkers, isMarkerFlagged } from '../utils/labReference';

interface DiagnosticsFormProps {
 imaging: ImagingStudy;
 onImagingChange: (updated: ImagingStudy) => void;
 labs: LabPanelData;
 onLabsChange: (updated: LabPanelData) => void;
 onBack: () => void;
 onRunTriage: () => void;
}

export const DiagnosticsForm: React.FC<DiagnosticsFormProps> = ({
 imaging,
 onImagingChange,
 labs,
 onLabsChange,
 onBack,
 onRunTriage,
}) => {
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [dragActive, setDragActive] = useState(false);
 const [isOnnxRunning, setIsOnnxRunning] = useState(false);
 const [onnxQuickResult, setOnnxQuickResult] = useState<any>(null);
 const [onnxError, setOnnxError] = useState<string | null>(null);

 const [isRadiologistRunning, setIsRadiologistRunning] = useState(false);
 const [radiologistError, setRadiologistError] = useState<string | null>(null);

 // New marker draft state
 const [newMarkerName, setNewMarkerName] = useState('');
 const [newMarkerValue, setNewMarkerValue] = useState('');
 const [newMarkerUnit, setNewMarkerUnit] = useState('');
 const [newMarkerRef, setNewMarkerRef] = useState('');
 const [showAllNormalMarkers, setShowAllNormalMarkers] = useState(false);

 // Lab Document OCR State
 const labDocInputRef = useRef<HTMLInputElement>(null);
 const [isOcrRunning, setIsOcrRunning] = useState(false);
 const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);
 const [ocrError, setOcrError] = useState<string | null>(null);

 const handleLabDocUpload = async (file: File) => {
   setIsOcrRunning(true);
   setOcrError(null);
   setOcrSuccessMsg(null);
   try {
     const reader = new FileReader();
     reader.onload = async (e) => {
       const fileData = e.target?.result as string;
       const res = await fetch('/api/ocr/extract-lab', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           fileData,
           filename: file.name,
         }),
       });
       if (!res.ok) throw new Error(`OCR service returned HTTP ${res.status}`);
       const data = await res.json();
       if (data.markers && data.markers.length > 0) {
         const currentMarkers = [...labs.markers];
         const newMarkers = [...currentMarkers];
         for (const m of data.markers) {
           const idx = newMarkers.findIndex((x) => x.name.toLowerCase() === m.name.toLowerCase());
           if (idx >= 0) {
             newMarkers[idx] = { ...newMarkers[idx], value: m.value, unit: m.unit, referenceRange: m.referenceRange };
           } else {
             newMarkers.push({ name: m.name, value: m.value, unit: m.unit, referenceRange: m.referenceRange });
           }
         }
         onLabsChange({
           ...labs,
           rawReportText: data.rawText || labs.rawReportText,
           markers: newMarkers,
         });
         setOcrSuccessMsg(`Extracted ${data.markers.length} lab analytes via ${data.engine || 'PyMuPDF OCR'}!`);
       } else {
         setOcrSuccessMsg(`Document processed. Recorded in raw lab notes.`);
       }
     };
     reader.readAsDataURL(file);
   } catch (err: any) {
     console.error('Lab OCR failed:', err);
     setOcrError(err.message || 'Failed to parse lab document');
   } finally {
     setIsOcrRunning(false);
   }
 };

 const runRadiologistAnalysis = async (customDataUrl?: string, customFileName?: string) => {
 const targetUrl = customDataUrl || imaging.imageDataUrl;
 if (!targetUrl) return;
 setIsRadiologistRunning(true);
 setRadiologistError(null);
 try {
 const res = await fetch('/api/agents/radiologist', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 imaging: {
 ...imaging,
 imageDataUrl: targetUrl,
 fileName: customFileName || imaging.fileName,
 },
 clinicalContext: imaging.clinicalIndication || 'Diagnostic triage evaluation',
 }),
 });
 if (!res.ok) {
 throw new Error(`Radiologist Agent returned HTTP ${res.status}`);
 }
 const data = await res.json();
 onImagingChange({
 ...imaging,
 imageDataUrl: targetUrl,
 fileName: customFileName || imaging.fileName,
 structuredFindings: data.findings || [],
 overallImpression: data.overallImpression || data.radiologicalImpression || '',
 });
 } catch (err: any) {
 console.error('Radiologist agent execution failed:', err);
 setRadiologistError(err.message || 'Failed to generate structured findings');
 } finally {
 setIsRadiologistRunning(false);
 }
 };

 const runOnnxPreCheck = async () => {
 if (!imaging.imageDataUrl) return;
 setIsOnnxRunning(true);
 setOnnxError(null);
 try {
 const res = await fetch('/api/radiology/predict', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ imageDataUrl: imaging.imageDataUrl }),
 });
 if (!res.ok) {
 throw new Error(`Inference returned HTTP ${res.status}`);
 }
 const data = await res.json();
 setOnnxQuickResult(data);
 } catch (err: any) {
 setOnnxError(err.message || 'ONNX inference failed');
 } finally {
 setIsOnnxRunning(false);
 }
 };

 const handleFileUpload = (file: File) => {
 if (!file) return;
 const reader = new FileReader();
 reader.onload = (e) => {
 const dataUrl = e.target?.result as string;
 onImagingChange({
 ...imaging,
 imageDataUrl: dataUrl,
 fileName: file.name,
 });
 // When an image is uploaded, trigger the Radiologist Agent to extract structured findings
 runRadiologistAnalysis(dataUrl, file.name);
 };
 reader.readAsDataURL(file);
 };

 const handleDrag = (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 if (e.type === 'dragenter' || e.type === 'dragover') {
 setDragActive(true);
 } else if (e.type === 'dragleave') {
 setDragActive(false);
 }
 };

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setDragActive(false);
 if (e.dataTransfer.files && e.dataTransfer.files[0]) {
 handleFileUpload(e.dataTransfer.files[0]);
 }
 };

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

 const addMarker = () => {
 if (!newMarkerName.trim() || !newMarkerValue.trim()) return;

 const rawMarker: LabMarker = {
 name: newMarkerName.trim(),
 value: newMarkerValue.trim(),
 unit: newMarkerUnit.trim() || 'units',
 referenceRange: newMarkerRef.trim() || 'Standard',
 status: 'NORMAL',
 };

 const evaluated = evaluateLabMarker(rawMarker);

 onLabsChange({
 ...labs,
 markers: [...labs.markers, evaluated],
 });

 setNewMarkerName('');
 setNewMarkerValue('');
 setNewMarkerUnit('');
 setNewMarkerRef('');
 };

 const removeMarker = (index: number) => {
 const updated = [...labs.markers];
 updated.splice(index, 1);
 onLabsChange({ ...labs, markers: updated });
 };

 const updateMarkerValue = (index: number, val: string) => {
 const updated = [...labs.markers];
 const marker = { ...updated[index], value: val };
 updated[index] = evaluateLabMarker(marker);
 onLabsChange({ ...labs, markers: updated });
 };

 const getMarkerStatusBadge = (status: LabMarker['status']) => {
 switch (status) {
 case 'CRITICAL_HIGH':
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emergency/15 text-emergency border border-emergency/40">
 <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
 CRITICAL HIGH
 </span>
 );
 case 'CRITICAL_LOW':
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emergency/15 text-emergency border border-emergency/40">
 <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
 CRITICAL LOW
 </span>
 );
 case 'ABNORMAL_HIGH':
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-primary/15 text-primary border border-primary/40">
 HIGH
 </span>
 );
 case 'ABNORMAL_LOW':
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-primary/15 text-primary border border-primary/40">
 LOW
 </span>
 );
 default:
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-routine/15 text-routine border border-routine/40">
 NORMAL
 </span>
 );
 }
 };

 return (
 <div id="diagnostics-form-section" className="space-y-6">
 {/* Top Action Bar for Immediate Navigation */}
 <div className="bg-surface border border-muted/20 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <button
 id="top-back-to-intake-btn"
 type="button"
 onClick={onBack}
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-muted/20 text-muted hover:text-ink hover:bg-muted/5 transition-colors cursor-pointer"
 >
 <ChevronLeft className="w-3.5 h-3.5" />
 <span>Back to Patient Intake</span>
 </button>
 <div className="text-xs text-muted">
 <span className="font-semibold text-ink">Step 2: Diagnostics</span>
 <span className="mx-2">•</span>
 <span>{imaging.imageDataUrl ? 'Imaging Attached' : 'No Imaging'}</span>
 <span className="mx-2">•</span>
 <span>{labs.markers?.length || 0} Lab Biomarkers</span>
 </div>
 </div>

 <button
 id="top-run-multi-agent-triage-btn"
 type="button"
 onClick={onRunTriage}
 className="flex items-center justify-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-primary hover:bg-[#09472C] text-white shadow-xs transition-all cursor-pointer"
 >
 <Bot className="w-4 h-4" />
 <span>Run Multi-Agent Triage Pipeline</span>
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>

 {/* 1. RADIOLOGY & IMAGING STUDY (FULL-WIDTH PACS-STYLE VIEWER & ANNOTATED FINDINGS) */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
 <div className="border-b border-muted/20 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2 text-primary">
 <ImageIcon className="w-5 h-5" />
 <h2 className="text-base font-bold font-sans font-bold">Diagnostic Imaging (Radiologist Agent)</h2>
 </div>
 <div className="flex items-center gap-2">
 {imaging.structuredFindings && imaging.structuredFindings.length > 0 && (
 <span className="text-[11px] font-sans px-2 py-0.5 bg-primary/5 text-primary border border-primary/20 font-semibold">
 {imaging.structuredFindings.length} Structured Finding Chips
 </span>
 )}
 <span className="text-[11px] font-sans px-2 py-0.5 bg-surface text-muted ">
 Multimodal Vision &amp; ONNX
 </span>
 </div>
 </div>

 {/* Modality & Clinical Indication */}
 <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
 <div className="sm:col-span-4">
 <label htmlFor="study-modality-select" className="block text-xs font-semibold text-muted mb-1">
 Study Modality
 </label>
 <select
 id="study-modality-select"
 value={imaging.modality}
 onChange={(e) => onImagingChange({ ...imaging, modality: e.target.value as any })}
 className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
 >
 <option value="Chest X-Ray (PA/AP)">Chest X-Ray (PA/AP)</option>
 <option value="Chest CT">Chest CT</option>
 <option value="Abdominal X-Ray">Abdominal X-Ray</option>
 <option value="Ultrasound">Abdominal / Pelvic Ultrasound</option>
 <option value="Other">Other Clinical Scan</option>
 </select>
 </div>

 <div className="sm:col-span-8">
 <label htmlFor="imaging-indication-input" className="block text-xs font-semibold text-muted mb-1">
 Clinical Indication / Exam Query
 </label>
 <input
 id="imaging-indication-input"
 type="text"
 value={imaging.clinicalIndication}
 onChange={(e) => onImagingChange({ ...imaging, clinicalIndication: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink"
 placeholder="e.g. Evaluate for consolidation, cardiomegaly, or pneumothorax"
 />
 </div>
 </div>

 {/* Scan Image & Structured Findings Side-by-Side */}
 <div>
 <label className="block text-xs font-semibold text-muted mb-2">
 Medical Scan Image &amp; Annotated Radiologist Findings
 </label>

 {imaging.imageDataUrl ? (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
 {/* LEFT: IMAGE VIEWER & ONNX PRE-CHECK */}
 <div className="lg:col-span-6 space-y-3">
 <div className="relative overflow-hidden border border-muted/20 rounded-xl bg-muted/5 flex items-center justify-center min-h-[280px] max-h-[340px]">
 <img
 src={imaging.imageDataUrl}
 alt="Radiological scan study"
 className="max-h-[320px] w-auto object-contain"
 />
 <div className="absolute top-2 right-2 bg-ink text-surface/80 backdrop-blur-sm text-[10px] font-sans text-muted px-2 py-1 border border-muted/20">
 {imaging.fileName || 'Diagnostic Scan'}
 </div>
 </div>

 <div className="flex items-center justify-between text-xs px-0.5">
 <span className="text-muted font-sans text-[11px]">
 {imaging.modality}
 </span>
 <div className="flex items-center gap-2">
 <button
 id="change-scan-btn"
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="text-primary hover:text-primary font-semibold cursor-pointer"
 >
 Replace Image
 </button>
 <span className="text-muted">•</span>
 <button
 id="remove-scan-btn"
 type="button"
 onClick={() => {
 onImagingChange({
 ...imaging,
 imageDataUrl: undefined,
 fileName: undefined,
 structuredFindings: undefined,
 overallImpression: undefined,
 });
 setOnnxQuickResult(null);
 }}
 className="text-emergency hover:text-red-800 cursor-pointer"
 >
 Clear Scan
 </button>
 </div>
 </div>

 {/* ONNX Direct Test Pre-Check */}
 <div className="bg-surface border border-muted/20 p-3 space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
 <Bot className="w-3.5 h-3.5 text-primary" />
 <span>DenseNet-121 ONNX Inference Pre-Check</span>
 </div>
 <button
 type="button"
 id="run-onnx-precheck-btn"
 onClick={runOnnxPreCheck}
 disabled={isOnnxRunning}
 className="px-2.5 py-1 text-[11px] font-semibold bg-primary text-surface hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
 >
 {isOnnxRunning ? 'Running Inference...' : 'Test ONNX Model'}
 </button>
 </div>

 {onnxError && (
 <p className="text-[11px] text-emergency">{onnxError}</p>
 )}

 {onnxQuickResult && (
 <div className="space-y-1.5 pt-1 text-xs">
 <div className="flex items-center justify-between text-[11px] text-muted font-sans">
 <span>Latency: {onnxQuickResult.executionTimeMs}ms</span>
 <span>Flagged: {onnxQuickResult.positiveFindings.length} pathology</span>
 </div>
 <div className="grid grid-cols-1 gap-1">
 {onnxQuickResult.classes.map((c: any) => (
 <div
 key={c.index}
 className={`px-2 py-1 flex items-center justify-between text-[11px] ${
 c.flaggedPositive
 ? 'bg-primary/15 text-primary font-semibold border border-primary/40'
 : 'bg-surface text-muted border border-muted/20'
 }`}
 >
 <span>
 {c.index}: {c.label}
 </span>
 <span className="font-sans">
 {(c.probability * 100).toFixed(1)}% (logit: {c.logit.toFixed(2)})
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* RIGHT: ANNOTATED LIST OF STRUCTURED FINDINGS (NEXT TO IMAGE) */}
 <div
 id="radiologist-structured-findings-container"
 className="lg:col-span-6 bg-surface border border-muted/20 p-4 space-y-3.5 flex flex-col justify-between"
 >
 <div>
 <div className="flex items-center justify-between pb-2.5 border-b border-muted/20">
 <div className="flex items-center gap-1.5">
 <Layers className="w-4 h-4 text-primary" />
 <h3 className="text-xs font-bold text-ink font-sans font-bold">
 Radiologist Agent Structured Findings
 </h3>
 </div>
 <button
 type="button"
 id="re-analyze-scan-btn"
 onClick={() => runRadiologistAnalysis()}
 disabled={isRadiologistRunning}
 className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary disabled:opacity-50 cursor-pointer"
 >
 <RefreshCw className={`w-3 h-3 ${isRadiologistRunning ? 'animate-spin' : ''}`} />
 <span>{isRadiologistRunning ? 'Analyzing...' : 'Re-analyze Scan'}</span>
 </button>
 </div>

 {radiologistError && (
 <div className="mt-2 p-2 bg-emergency/5 border border-emergency/25 rounded-lg text-xs text-emergency font-medium">
 {radiologistError}
 </div>
 )}

 {isRadiologistRunning ? (
 <div className="p-8 text-center space-y-2">
 <RefreshCw className="w-6 h-6 text-primary animate-spin mx-auto" />
 <p className="text-xs font-semibold text-ink">
 Radiologist Agent is analyzing scan...
 </p>
 <p className="text-[11px] text-muted">
 Extracting anatomical regions, severity grading, and structured finding chips.
 </p>
 </div>
 ) : (
 <div className="space-y-3 mt-3">
 {/* Overall Impression Line */}
 {imaging.overallImpression ? (
 <div
 id="radiologist-overall-impression-banner"
 className="p-3 bg-primary/5 border border-primary/20 text-primary space-y-1"
 >
 <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
 <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
 <span>Overall Impression</span>
 </div>
 <p className="text-xs font-semibold text-ink leading-relaxed">
 {imaging.overallImpression}
 </p>
 </div>
 ) : (
 <div className="p-3 bg-surface border border-muted/20 text-xs text-muted">
 Overall impression will be produced upon radiologist analysis.
 </div>
 )}

 {/* Annotated Findings List (Rendered as structured chips) */}
 <div>
 <div className="flex items-center justify-between text-[11px] font-semibold text-muted mb-2">
 <span>Annotated Region Observations ({imaging.structuredFindings?.length || 0})</span>
 <span className="text-primary font-sans">Referenceable Finding Chips</span>
 </div>

 {imaging.structuredFindings && imaging.structuredFindings.length > 0 ? (
 <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
 {imaging.structuredFindings.map((f, fIdx) => (
 <div
 key={f.id || fIdx}
 id={`finding-chip-${f.id || fIdx}`}
 className="p-2.5 border border-muted/20 bg-surface hover:border-primary/30 transition-all space-y-1 "
 >
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5">
 <span className="px-1.5 py-0.5 font-sans font-bold text-[10px] bg-ink text-surface">
 {f.id || `RF-${fIdx + 1}`}
 </span>
 <span className="text-xs font-bold text-ink">
 {f.region}
 </span>
 </div>
 {getSeverityBadge(f.severity)}
 </div>
 <p className="text-xs text-muted leading-snug pl-0.5">
 {f.observation}
 </p>
 </div>
 ))}
 </div>
 ) : (
 <div className="p-4 bg-surface border border-muted/20 text-center space-y-2">
 <p className="text-xs text-muted">
 No structured findings generated yet.
 </p>
 <button
 type="button"
 onClick={() => runRadiologistAnalysis()}
 className="px-3 py-1.5 text-xs font-semibold bg-primary text-surface hover:bg-primary/90 cursor-pointer"
 >
 Extract Structured Findings
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Grounding Explainer Footer */}
 <div className="pt-2 border-t border-muted/20 text-[11px] text-muted flex items-center gap-1.5">
 <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
 <span>
 Each finding chip (<span className="font-sans font-bold text-ink">[RF-1]</span>, etc.) is visibly g and referenced by the Doctor Agent.
 </span>
 </div>
 </div>
 </div>
 ) : (
 <div
 id="imaging-dropzone"
 onDragEnter={handleDrag}
 onDragLeave={handleDrag}
 onDragOver={handleDrag}
 onDrop={handleDrop}
 onClick={() => fileInputRef.current?.click()}
 className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
 dragActive
 ? 'border-primary bg-primary/5'
 : 'border-muted/20 hover:border-primary bg-surface hover:bg-surface'
 }`}
 >
 <Upload className="w-9 h-9 text-muted/80 mx-auto mb-2" />
 <p className="text-sm font-semibold text-ink">
 Click to browse or drag &amp; drop medical scan
 </p>
 <p className="text-xs text-muted mt-1">
 Supports Chest X-ray, CT, Ultrasound (PNG, JPG, SVG, WebP)
 </p>
 <p className="text-[11px] text-primary font-medium mt-2">
 Upon upload, the Radiologist Agent automatically generates structured findings and referenceable chips.
 </p>
 </div>
 )}

 <input
 ref={fileInputRef}
 type="file"
 accept="image/*,.svg"
 className="hidden"
 onChange={(e) => {
 if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
 }}
 />

 {/* Model Reliability & Dataset Spec Banner */}
 <div className="mt-4 bg-primary/10 border border-primary/30 p-3 text-xs text-primary space-y-1.5">
 <div className="flex items-center gap-1.5 font-bold text-primary">
 <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
 <span>ONNX Model Reliability &amp; Validation Notice</span>
 </div>
 <p className="text-[11px] leading-relaxed text-primary">
 Real inference model: <strong>DenseNet-121 ONNX</strong>, trained on a ~5,600-image sample of <strong>NIH ChestX-ray14</strong> (Validation Mean AUC: <strong>0.834</strong>). Solid for educational coursework demonstration, but <strong>explicitly not clinical-grade</strong>. Note weaker predictive power on under-represented classes (Edema and Cardiomegaly each had &lt;150 positive training samples in this run). Output probabilities guide rather than dictate final triage.
 </p>
 </div>
 </div>
 </div>

 {/* 2. LABORATORY DATA PANEL (LAB ANALYST AGENT) */}
 <div className="bg-surface border border-muted/20 rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
 {(() => {
 const { evaluated, flagged, normal } = partitionLabMarkers(labs.markers);
 return (
 <>
 <div className="border-b border-muted/20 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2 text-primary">
 <FlaskConical className="w-5 h-5" />
 <h2 className="text-base font-bold font-sans font-bold">Laboratory Panel (Lab Analyst Agent)</h2>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-sans px-2 py-0.5 bg-emergency/10 text-emergency border border-emergency/30 font-semibold rounded-md">
 {flagged.length} Flagged Out-of-Range
 </span>
 <span className="text-[11px] font-sans px-2 py-0.5 bg-surface text-muted ">
 {normal.length} Normal
 </span>
 </div>
 </div>

 {/* OCR & Document Processing Dropzone (PyMuPDF / Clinical Tokenizer) */}
 <div className="bg-primary/5 border border-primary/20 p-4 space-y-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div>
 <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
 <Sparkles className="w-4 h-4 text-primary" />
 <span>Automated Lab Report Document Processing (PyMuPDF OCR)</span>
 </div>
 <p className="text-[11px] text-muted mt-0.5">
 Upload hospital lab reports (PDF, PNG, JPG, or TXT) to automatically extract analytes and reference ranges into the panel.
 </p>
 </div>
 <div>
 <button
 type="button"
 disabled={isOcrRunning}
 onClick={() => labDocInputRef.current?.click()}
 className="px-3 py-1.5 text-xs font-bold bg-primary text-surface hover:bg-primary/90 cursor-pointer flex items-center gap-1.5 rounded-lg transition-all disabled:opacity-50"
 >
 {isOcrRunning ? (
 <>
 <RefreshCw className="w-3.5 h-3.5 animate-spin" />
 <span>Running PyMuPDF OCR...</span>
 </>
 ) : (
 <>
 <Upload className="w-3.5 h-3.5" />
 <span>Upload Lab Report (PDF / Image)</span>
 </>
 )}
 </button>
 <input
 ref={labDocInputRef}
 type="file"
 accept=".pdf,.png,.jpg,.jpeg,.txt"
 className="hidden"
 onChange={(e) => {
 if (e.target.files?.[0]) handleLabDocUpload(e.target.files[0]);
 }}
 />
 </div>
 </div>

 {ocrSuccessMsg && (
 <div className="p-2.5 bg-routine/15 border border-routine/30 text-routine text-xs font-semibold flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-routine shrink-0" />
 <span>{ocrSuccessMsg}</span>
 </div>
 )}

 {ocrError && (
 <div className="p-2.5 bg-emergency/15 border border-emergency/30 text-emergency text-xs font-semibold flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-emergency shrink-0" />
 <span>{ocrError}</span>
 </div>
 )}
 </div>

 {/* FLAGGED OUT-OF-RANGE MARKERS (SURFACED PROMINENTLY) */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-primary" />
 <span className="text-xs font-bold text-ink">
 Flagged Out-of-Range Markers ({flagged.length})
 </span>
 </div>
 <span className="text-[11px] text-muted font-sans">
 Automated Reference Range Comparison &amp; Clinical Interpretation
 </span>
 </div>

 {flagged.length > 0 ? (
 <div className="space-y-2">
 {flagged.map((marker) => {
 const origIndex = labs.markers.findIndex((m) => m.name === marker.name);
 return (
 <div
 key={marker.name}
 className={`p-3 border transition-all ${
 marker.status === 'CRITICAL_HIGH' || marker.status === 'CRITICAL_LOW'
 ? 'bg-emergency/10 border-emergency/30'
 : 'bg-primary/10 border-primary/30'
 }`}
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs font-bold text-ink">{marker.name}</span>
 {getMarkerStatusBadge(marker.status)}
 </div>

 <div className="flex items-center gap-3 self-end sm:self-auto">
 <div className="flex items-center gap-1">
 <span className="text-[11px] text-muted font-medium">Value:</span>
 <input
 type="text"
 value={marker.value}
 onChange={(e) => origIndex !== -1 && updateMarkerValue(origIndex, e.target.value)}
 className="w-20 px-2 py-0.5 border border-muted/20 font-sans font-bold text-xs bg-surface text-ink focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg focus:outline-none"
 />
 <span className="text-[11px] text-muted font-sans">{marker.unit}</span>
 </div>

 <div className="text-[11px] text-muted font-sans hidden md:block">
 Ref: {marker.referenceRange}
 </div>

 {origIndex !== -1 && (
 <button
 type="button"
 onClick={() => removeMarker(origIndex)}
 className="text-muted/80 hover:text-emergency cursor-pointer p-1"
 title="Remove marker"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>

 {/* One-Line Clinical Interpretation */}
 {marker.interpretation && (
 <div className="mt-2 pt-1.5 border-t border-black/5 flex items-start gap-1.5 text-xs text-muted">
 <span className="font-bold text-ink shrink-0">Interpretation:</span>
 <span className="italic leading-snug">{marker.interpretation}</span>
 </div>
 )}
 </div>
 );
 })}
 </div>
 ) : (
 <div className="p-4 border border-routine/30 bg-routine/10 text-center space-y-1">
 <p className="text-xs font-bold text-routine">
 All loaded laboratory markers are currently within standard reference ranges.
 </p>
 <p className="text-[11px] text-routine">
 No acute biochemical critical elevations or reductions detected.
 </p>
 </div>
 )}
 </div>

 {/* NORMAL VALUES (COLLAPSED INTO "SHOW ALL" SECTION) */}
 <div className="border border-muted/20 overflow-hidden bg-surface">
 <button
 type="button"
 onClick={() => setShowAllNormalMarkers(!showAllNormalMarkers)}
 className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface transition-colors cursor-pointer"
 >
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-muted">
 {showAllNormalMarkers ? 'Hide Normal Analytes' : 'Show All Normal Analytes'}
 </span>
 <span className="text-[11px] font-sans px-2 py-0.5 bg-surface text-muted">
 {normal.length} markers within reference interval
 </span>
 </div>
 <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
 {showAllNormalMarkers ? (
 <>
 <span>Collapse</span>
 <ChevronUp className="w-4 h-4" />
 </>
 ) : (
 <>
 <span>Expand Table</span>
 <ChevronDown className="w-4 h-4" />
 </>
 )}
 </div>
 </button>

 {showAllNormalMarkers && (
 <div className="border-t border-muted/20 bg-surface p-2">
 {normal.length > 0 ? (
 <div className="max-h-[220px] overflow-y-auto">
 <table className="w-full text-left text-xs border-collapse">
 <thead className="bg-surface text-muted font-semibold sticky top-0 border-b border-muted/20">
 <tr>
 <th className="p-2">Marker / Analyte</th>
 <th className="p-2">Value</th>
 <th className="p-2">Ref Range</th>
 <th className="p-2">Status</th>
 <th className="p-2 w-8"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-muted/20">
 {normal.map((marker) => {
 const origIndex = labs.markers.findIndex((m) => m.name === marker.name);
 return (
 <tr key={marker.name} className="hover:bg-surface">
 <td className="p-2 font-medium text-ink">{marker.name}</td>
 <td className="p-2 font-sans font-bold text-ink">
 <div className="flex items-center gap-1">
 <input
 type="text"
 value={marker.value}
 onChange={(e) => origIndex !== -1 && updateMarkerValue(origIndex, e.target.value)}
 className="w-16 px-1.5 py-0.5 border border-muted/20 font-sans text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg focus:outline-none"
 />
 <span className="text-[11px] text-muted font-normal">{marker.unit}</span>
 </div>
 </td>
 <td className="p-2 text-muted text-[11px]">{marker.referenceRange}</td>
 <td className="p-2">{getMarkerStatusBadge('NORMAL')}</td>
 <td className="p-2 text-right">
 {origIndex !== -1 && (
 <button
 type="button"
 onClick={() => removeMarker(origIndex)}
 className="text-muted/80 hover:text-emergency cursor-pointer p-1"
 title="Remove marker"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="p-4 text-center text-xs text-muted/80">
 No normal markers recorded.
 </p>
 )}
 </div>
 )}
 </div>
 </>
 );
 })()}

 {/* Add Custom Marker Inline Form */}
 <div className="bg-surface p-3 border border-muted/20 space-y-2">
 <span className="text-[11px] font-semibold text-muted">
 Add Custom Analyte (Auto-Evaluated Against Reference Range)
 </span>
 <div className="grid grid-cols-12 gap-2">
 <input
 type="text"
 placeholder="Marker name (e.g. D-dimer, Potassium, Troponin)"
 value={newMarkerName}
 onChange={(e) => setNewMarkerName(e.target.value)}
 className="col-span-4 px-2 py-1.5 text-xs bg-surface border border-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg focus:outline-none"
 />
 <input
 type="text"
 placeholder="Value (e.g. 780)"
 value={newMarkerValue}
 onChange={(e) => setNewMarkerValue(e.target.value)}
 className="col-span-3 px-2 py-1.5 text-xs bg-surface border border-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg focus:outline-none"
 />
 <input
 type="text"
 placeholder="Unit (ng/mL)"
 value={newMarkerUnit}
 onChange={(e) => setNewMarkerUnit(e.target.value)}
 className="col-span-2 px-2 py-1.5 text-xs bg-surface border border-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg focus:outline-none"
 />
 <input
 type="text"
 placeholder="Ref (optional)"
 value={newMarkerRef}
 onChange={(e) => setNewMarkerRef(e.target.value)}
 className="col-span-2 px-2 py-1.5 text-xs bg-surface border border-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg focus:outline-none"
 />
 <button
 id="add-custom-marker-btn"
 type="button"
 onClick={addMarker}
 className="col-span-1 flex items-center justify-center bg-primary hover:bg-[#09472C] text-white shadow-xs rounded-lg text-xs transition-colors cursor-pointer"
 title="Add to panel"
 >
 <Plus className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Raw Report Text Area */}
 <div>
 <label htmlFor="raw-lab-notes" className="block text-xs font-semibold text-muted mb-1">
 Raw Pathology / Lab Report Transcript (Optional)
 </label>
 <textarea
 id="raw-lab-notes"
 rows={2}
 value={labs.rawReportText || ''}
 onChange={(e) => onLabsChange({ ...labs, rawReportText: e.target.value })}
 className="w-full px-3 py-2 text-xs border border-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-lg bg-surface text-ink font-sans"
 placeholder="Paste raw lab results, blood gas parameters, or culture notes here..."
 />
 </div>
 </div>

 {/* Navigation Footer */}
 <div className="bg-surface border border-muted/20 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ">
 <button
 id="back-to-intake-btn"
 type="button"
 onClick={onBack}
 className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-muted hover:bg-surface transition-colors cursor-pointer"
 >
 <ChevronLeft className="w-4 h-4" />
 <span>Back to Patient Intake</span>
 </button>

 <div className="flex flex-col sm:flex-row items-center gap-3">
 <div className="flex items-center gap-1.5 text-xs text-muted text-center sm:text-left">
 <Info className="w-3.5 h-3.5 text-primary shrink-0" />
 <span>
 {!imaging.imageDataUrl && (!labs.markers || labs.markers.length === 0)
 ? 'Symptoms-only path: Doctor Agent will highlight diagnostic gaps & cap confidence'
 : 'Triggers live inference across all 4 agents + RAG retrieval'}
 </span>
 </div>

 <button
 id="run-multi-agent-triage-btn"
 type="button"
 onClick={onRunTriage}
 className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold bg-primary hover:bg-[#09472C] text-white shadow-xs rounded-lg transition-all cursor-pointer w-full sm:w-auto"
 >
 <Bot className="w-4 h-4" />
 <span>
 {!imaging.imageDataUrl && (!labs.markers || labs.markers.length === 0)
 ? 'Run Triage (Symptoms-Only)'
 : 'Run Multi-Agent Triage Pipeline'}
 </span>
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 );
};
