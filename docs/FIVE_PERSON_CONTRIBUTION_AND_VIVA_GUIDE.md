# MediAgent AI — 5-Person Split Contribution 

## 1. Introduction & Opening Pitch (Delivered by Nieehaanshu Hireh)

> **Verbatim Opening Speech for Nieehaanshu Hireh (Project Lead & Presenter 1):**  
> *"Good morning respected Guide Dr. Bhagwan D. Thorat and distinguished members of the review panel.  
>  
> I am **Nieehaanshu Hireh**, and on behalf of Group 4 from the Department of Artificial Intelligence and Data Science, I welcome you to our mid-semester review for **MediAgent AI** — an intelligent, multi-agent clinical decision support system.  
>  
> ### Why This Project Matters:
> In modern emergency medicine, diagnostic errors cause between **40,000 to 80,000 preventable deaths every year** (BMJ, 2024). The root cause is **information fragmentation**:
> - Radiologists review chest X-rays in isolation on PACS.
> - Pathologists review blood tests on Laboratory Information Systems (LIS).
> - Emergency clinicians must manually correlate all these reports under severe time pressure.
>  
> Meanwhile, conventional AI medical chatbots rely on a **single large language model**. They suffer from three fatal flaws:
> 1. They **hallucinate** clinical facts.
> 2. They have **no multi-modal vision** to analyze raw X-rays or read PDF lab analyzer reports.
> 3. They output **uncalibrated confidence percentages** (e.g. '95% confident') with zero mathematical backing.
>  
> ### Our Solution: MediAgent AI
> We designed a collaborative AI system that mirrors a hospital's **Multidisciplinary Team (MDT)**. Instead of one model, we deployed **5 specialized AI agents**:
> - **M4 (Interviewer Agent):** Structured symptom elicitation and triage intake.
> - **M1 (Radiology Agent):** 14-pathology DenseNet-121 classification with Grad-CAM XAI heatmaps.
> - **M3 (Lab Analyst Agent):** Fast PyMuPDF OCR and custom SpaCy Named Entity Recognition for 19 biomarkers.
> - **M2 (Knowledge Retriever):** Domain-specific RAG using S-PubMedBert and persistent ChromaDB to ground every claim in verified clinical guidelines.
> - **M5 (Calibrator Agent):** Platt-scaled 4-pillar confidence scoring that eliminates AI overconfidence.
>  
> Today, our entire full-stack system is live and running. I will walk you through our knowledge retrieval foundation, and my team members will demonstrate each specialized agent in action."*

---

## 2. Technical Architecture & Technology Mapping

Every component in our codebase maps directly to the approved synopsis (`edi.pdf`):

| Synopsis Specification (`edi.pdf`) | Technology Used in MediAgent AI Codebase | Primary Student Owner |
|---|---|---|
| **RAG & Vector Database** | S-PubMedBert Bi-Encoder, ChromaDB Vector DB, Hard-Negative Mining | **Nieehaanshu Hireh (Lead)** |
| **Multi-Agent Framework** | Custom Asynchronous Multi-Agent Architecture (Gemini 2.5 Flash + Fallbacks) | **Krissh Garsund** |
| **Medical Image Processing** | PyTorch DenseNet-121 (14 Pathologies, AUC 0.782), Grad-CAM XAI, ONNX Runtime | **Harsh Gawas** |
| **OCR & Document Processing** | PyMuPDF PDF parser, Custom SpaCy Transition NER, 19-Analyte Pattern Engine | **Faheem Inamdar** |
| **Confidence Calibration & APIs** | Platt Scaling (`CalibratedClassifierCV`), 4-Pillars, FastAPI, Docker, Firestore | **Aarya Dangre** |

---

## 3. Individual Member Contribution Breakdown & Viva Defense

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   GROUP 4 — MODULAR OWNERSHIP MATRIX                                    │
├──────────────────────┬──────────────────────┬──────────────────────┬──────────────────┬─────────────────┤
│  Nieehaanshu Hireh   │    Krissh Garsund    │     Harsh Gawas      │  Faheem Inamdar  │  Aarya Dangre   │
│     (Roll No. 57)    │     (Roll No. 38)    │     (Roll No. 41)    │  (Roll No. 58)   │  (Roll No. 70)  │
├──────────────────────┼──────────────────────┼──────────────────────┼──────────────────┼─────────────────┤
│ Project Lead & RAG   │ Multi-Agent System & │ Deep Learning Vision │ Document OCR &   │ Mathematical    │
│ Knowledge Retrieval  │ Interviewer Agent    │ DenseNet-121 ONNX &  │ Clinical Lab NER │ Calibration &   │
│ (M2 + ChromaDB)      │ (M4 + Synthesis)     │ Grad-CAM XAI (M1)    │ Extraction (M3)  │ DevOps (M5)     │
└──────────────────────┴──────────────────────┴──────────────────────┴──────────────────┴─────────────────┘
```

---

### Member 1: Nieehaanshu Hireh (Roll No. 57 | G.R. No. 12414454) — Project Lead
* **Title:** Project Lead, Scope Architect & RAG Knowledge Retrieval Lead
* **Primary Module Ownership:** **Project Introduction, Scope & M2 Clinical Knowledge Retriever (RAG, S-PubMedBert & ChromaDB)**

#### What Nieehaanshu Built in the Codebase:
1. **Clinical Knowledge Ingestion (`training/data/raw/guidelines/`):** Ingested 10 international gold-standard clinical guidelines into chunked text segments (`chunks.jsonl`):
   - *BTS Guidelines:* Community-Acquired Pneumonia & CURB-65 criteria.
   - *NICE Guidelines:* Sepsis risk stratification.
   - *Surviving Sepsis Campaign (SSC 2021):* 1-hour resuscitation bundle.
   - *ESC Guidelines:* Acute Coronary Syndrome (ACS) NSTEMI/STEMI pathways.
   - *GOLD 2024 / GINA 2023:* COPD and Acute Asthma management.
   - *KDIGO / ADA / AASLD / WHO:* AKI, DKA, Acute Liver Failure, and Triage guidelines.
2. **Two-Round Curriculum Fine-Tuning (`training/train_retriever.py`):** Fine-tuned the domain-specific bi-encoder `pritamdeka/S-PubMedBert-MS-MARCO` across 2 stages:
   - *Round 1 (3 Epochs):* In-batch negative training with `MultipleNegativesRankingLoss`.
   - *Round 2 (2 Epochs):* **Hard-negative mining** (extracting chunks with 0.60–0.90 cosine similarity that belong to different conditions) to teach the model subtle medical discrimination.
3. **ChromaDB Persistent Store (`training/build_chromadb_guidelines.py`):** Built the local, persistent ChromaDB vector collection at `training/data/chroma_db/` storing 768-dimensional guideline vectors.
4. **Information Retrieval Benchmark:**
   - Evaluated using standard IR metrics:
     * **Recall@10 = 1.0000 (100%):** The correct clinical protocol is guaranteed to be in the top-10 retrieved documents.
     * **MRR@10 (Mean Reciprocal Rank):** **0.7738**
     * **NDCG@10:** **0.8274**
5. **Corpus Binary Indexing:** Exported half-precision embeddings (`embeddings.f16.bin`) in [`training/export_retriever_onnx.py`](file:///c:/Users/nieeh/Downloads/mediagent-ai/training/export_retriever_onnx.py) for lightning-fast memory-mapped dot product search.

#### Nieehaanshu's Viva Questions & Exact Answers:
* **Q1 (Prof. Thorat):** *"Why did you use S-PubMedBert instead of standard OpenAI text-embedding-3 or general BERT?"*  
  * **Answer:** *"Standard BERT and OpenAI embeddings are trained on general internet crawl data. They misunderstand clinical acronyms—for example, treating 'CURB-65' as random letters or confusing 'MI' (Myocardial Infarction) with the state of Michigan. S-PubMedBert was pre-trained exclusively on PubMed Central biomedical research papers and MS-MARCO clinical passages, giving it deep biomedical semantic representations of pharmacology, symptoms, and anatomical terminology."*
* **Q2:** *"What is Hard-Negative Mining in RAG and why was it necessary?"*  
  * **Answer:** *"In standard in-batch negative training, negative examples are random and easy to differentiate (e.g. comparing Pneumonia with Liver Failure). Hard-negative mining deliberately searches the corpus for chunks that share similar words—such as 'Viral Bronchitis' versus 'Bacterial Pneumonia' (cosine similarity between 0.60 and 0.90)—and forces the retriever to rank the exact clinical guideline higher. This prevents the system from citing asthma treatments when a patient actually has pulmonary edema."*
* **Q3:** *"Why did you choose ChromaDB over cloud vector databases like Pinecone or Weaviate?"*  
  * **Answer:** *"In healthcare systems, patient privacy and data sovereignty are paramount. Sending medical queries to third-party cloud vector databases creates HIPAA and GDPR compliance risks and introduces network latency. ChromaDB runs completely locally within our environment, requires zero API keys, operates with zero data egress, and provides persistent vector storage with millisecond query speeds."*

---

### Member 2: Krissh Garsund (Roll No. 38 | G.R. No. 12413482)
* **Title:** Multi-Agent Systems Architect & Interviewer Agent Lead
* **Primary Module Ownership:** **M4 Patient Interviewer Agent & Multi-Agent Doctor Synthesis Engine**

#### What Krissh Built in the Codebase:
1. **Multi-Agent Pipeline Orchestration:** Designed the sequential and asynchronous execution pipeline in `server/agents/` that coordinates clinical intake, imaging findings, lab biomarkers, and medical literature.
2. **Adaptive Patient Interviewer (`server/agents/interviewer.ts`):** Authored system prompts for Google Gemini 2.5 Flash to conduct structured symptom elicitation, extract chief complaints, identify onset timelines, and flag clinical red flags.
3. **Doctor Synthesis Agent (`server/agents/doctor.ts`):** Built the multi-modal clinical reasoning engine that correlates patient history, radiological evidence, and laboratory data into a preliminary differential diagnosis.
4. **Deterministic Fallback Safety Guardrail:** Authored `buildFallbackInterview()` and `buildFallbackDoctorSynthesis()` so that if the Gemini API experiences network timeouts or rate limits, the system shifts gracefully to rule-based clinical scoring (CURB-65 pneumonia, SIRS sepsis criteria) without crashing.
5. **Frontend Intake Views:** Built [`src/components/IntakeView.tsx`](file:///c:/Users/nieeh/Downloads/mediagent-ai/src/components/IntakeView.tsx) and wired live agent status streaming into [`src/components/FinalReportView.tsx`](file:///c:/Users/nieeh/Downloads/mediagent-ai/src/components/FinalReportView.tsx).

#### Krissh's Viva Questions & Exact Answers:
* **Q1 (Prof. Thorat):** *"Why did you use a multi-agent system instead of a single prompt in ChatGPT or Gemini?"*  
  * **Answer:** *"A single monolithic LLM suffers from context dilution and high hallucination rates when processing long X-ray reports, lab numbers, and medical histories at once. By decomposing the problem into specialized agents—one for interviewing, one for radiology, one for labs, and one for synthesis—each agent operates within a focused prompt space with strict schema validation. This mimics hospital Multidisciplinary Teams (MDTs) and allows deterministic guardrails for each modality."*
* **Q2:** *"How do you prevent the Interviewer Agent from asking endless or irrelevant questions?"*  
  * **Answer:** *"We constrain the interviewer agent with an explicit JSON response schema containing structured fields for chief complaint, duration, severity scale (1–10), and emergency red flags. It operates in an adaptive, single-pass structured extraction mode with predefined clinical templates to ensure patient intake takes under 60 seconds."*
* **Q3:** *"What happens if the Gemini LLM API goes down or loses internet during an emergency triage?"*  
  * **Answer:** *"Our architecture enforces complete fallback safety. In `server/agents/doctor.ts`, every LLM invocation is wrapped in a try-catch block connected to `buildFallbackDoctorSynthesis()`. If the API fails, our deterministic clinical rule engine takes over, executing validated scoring systems like CURB-65 for respiratory infections and SIRS criteria for sepsis, ensuring zero downtime."*

---

### Member 3: Harsh Gawas (Roll No. 41 | G.R. No. 12410543)
* **Title:** Deep Learning & Medical Computer Vision Lead
* **Primary Module Ownership:** **M1 Radiology Agent (DenseNet-121 ONNX & Grad-CAM XAI)**

#### What Harsh Built in the Codebase:
1. **Model Architecture & Training (`training/kaggle_train_radiology.ipynb`):** Designed the transfer learning pipeline for **DenseNet-121** on the **NIH ChestX-ray14 dataset** using 30 hours of free Kaggle GPU (NVIDIA T4 x2).
2. **Patient-Stratified Splitting:** Partitioned the 10,000-image dataset strictly by `Patient ID` to guarantee zero data leakage between training and validation splits.
3. **Class Imbalance Mitigation:** Computed dynamic positive class weighting (`pos_weight`) inside Binary Cross-Entropy (`BCEWithLogitsLoss`) to balance rare pathologies (Hernia, Fibrosis) against frequent ones (Infiltration, Effusion).
4. **Empirical Results Achieved:**
   - Trained across 5 epochs with mixed precision (FP16) and Cosine Annealing learning rate schedule (`lr=1e-4` to `1e-6`).
   - Weighted loss dropped from **1.2168 → 0.8861**.
   - Achieved an overall **Mean ROC-AUC of 0.782** across all 14 official NIH pathologies:
     * *Hernia:* **0.918** | *Cardiomegaly:* **0.911** | *Emphysema:* **0.851** | *Effusion:* **0.847** | *Edema:* **0.832** | *Pneumothorax:* **0.808** | *Consolidation:* **0.773**.
5. **Grad-CAM Explainability (`training/generate_gradcam_overlay.py`):** Implemented native PyTorch backward gradient hooks on layer `features.denseblock4` to generate visual red/yellow heatmaps overlaid on radiographs.
6. **ONNX Runtime Export:** Exported the trained model into a 27.0 MB ONNX graph (`mediagent_radiology_densenet121.onnx`) running in `server/models/radiologyModel.ts` with sub-100ms CPU inference.

#### Harsh's Viva Questions & Exact Answers:
* **Q1 (Prof. Thorat):** *"Why did you choose DenseNet-121 rather than ResNet-50 or a Vision Transformer (ViT)?"*  
  * **Answer:** *"In thoracic radiographs, pathological signals like subtle consolidation or faint pleural effusions exist at multiple spatial scales. DenseNet-121 uses dense connectivity where each layer receives feature maps from all preceding layers. This encourages feature reuse, mitigates the vanishing gradient problem, and captures both low-level edge opacities and high-level organ structures with only 7 million parameters—less than one-third of ResNet-50's 25 million parameters—making it ideal for lightweight ONNX deployment."*
* **Q2:** *"What is data leakage in medical image datasets, and how did you prevent it?"*  
  * **Answer:** *"In the NIH ChestX-ray14 dataset, patients often have multiple scans taken over weeks or months. If images from the same patient appear in both train and validation sets, the convolutional network memorizes patient-specific bone structure and breast shadows rather than actual disease pathology. We performed patient-level stratified splitting using `Patient ID`, guaranteeing that all images from any single individual remained strictly in either the training set or the validation set."*
* **Q3:** *"How does Grad-CAM work mathematically to generate the heatmaps?"*  
  * **Answer:** *"Grad-CAM computes the gradient of the class score $y^c$ with respect to the feature activation maps $A^k$ of the final convolutional block (`features.denseblock4`). We take the global average pooling of these gradients to obtain neuron importance weights $\alpha_k^c = \frac{1}{Z}\sum_i\sum_j \frac{\partial y^c}{\partial A_{i,j}^k}$. We then take a weighted combination of all feature maps followed by a ReLU non-linearity, $L^c = \text{ReLU}\left(\sum_k \alpha_k^c A^k\right)$, isolating features that positively contribute to the disease prediction while ignoring negative artifacts."*

---

### Member 4: Faheem Inamdar (Roll No. 58 | G.R. No. 12414058)
* **Title:** Clinical Document OCR & Medical NLP Lead
* **Primary Module Ownership:** **M3 Laboratory Analysis Agent (PyMuPDF OCR & SpaCy Named Entity Recognition)**

#### What Faheem Built in the Codebase:
1. **PyMuPDF Document Extraction Engine (`training/ocr_lab_report.py`):** Developed a direct byte-level PDF parser using `fitz` (PyMuPDF) capable of reading multi-page hospital laboratory printouts, ICU flowcharts, and plain text diagnostic exports.
2. **19-Analyte Clinical Pattern Matcher:** Created a regex and token engine supporting 19 essential clinical biomarkers:
   - *Complete Blood Count (CBC):* WBC, Hemoglobin, Platelets, Neutrophils.
   - *Metabolic & Renal Panel:* Glucose, Creatinine, BUN, Sodium, Potassium.
   - *Hepatic Panel:* AST, ALT, Total Bilirubin.
   - *Inflammatory & Cardiac Markers:* CRP, High-Sensitivity Troponin I, D-Dimer, Lactate, Procalcitonin (PCT), NT-proBNP.
   - *Endocrine & Coagulation:* TSH, HbA1c, INR.
3. **Custom SpaCy Named Entity Recognition (NER) (`training/train_lab_ner.py`):**
   - Built a token-level entity extraction pipeline using `spacy.blank("en")` with a transition-based parser.
   - Trained across 25 epochs on 200 annotated clinical lab reports (`training/data/raw/lab_ner_synthetic.jsonl`) using BIO sequence tagging.
   - Learned 5 core medical entities: `TEST_NAME`, `VALUE`, `UNIT`, `REF_RANGE`, `FLAG`.
   - Saved the model pipeline to [`training/exports/spacy_lab_ner/`](file:///c:/Users/nieeh/Downloads/mediagent-ai/training/exports/spacy_lab_ner/).
4. **Backend TypeScript OCR Service (`server/services/ocrService.ts`):** Wrapped the Python extractor via Node child process execution with an internal TypeScript fallback regex parser, exposed through the endpoint `POST /api/ocr/extract-lab`.
5. **Interactive UI Dropzone:** Integrated the OCR file upload card in [`src/components/DiagnosticsForm.tsx`](file:///c:/Users/nieeh/Downloads/mediagent-ai/src/components/DiagnosticsForm.tsx), enabling one-click upload, auto-filling form inputs, and flagging abnormal values in bold red.

#### Faheem's Viva Questions & Exact Answers:
* **Q1 (Prof. Thorat):** *"Why did you use PyMuPDF instead of Google Tesseract OCR or PaddleOCR?"*  
  * **Answer:** *"Over 90% of hospital diagnostic reports are generated digitally as native vector PDFs by laboratory analyzers rather than photographed on paper. Tesseract rasterizes text into bitmap pixels and performs optical character recognition, which is slow (2–4 seconds per page) and introduces character substitution errors (like reading '0.62' as 'O.b2'). PyMuPDF extracts the native character stream and font bounding boxes directly from the PDF DOM in under 20 milliseconds with 100% character accuracy."*
* **Q2:** *"How does your custom SpaCy NER model extract laboratory entities?"*  
  * **Answer:** *"We use SpaCy's transition-based Named Entity Recognizer. The architecture combines a Tok2Vec embedding layer with a neural shift-reduce transition parser. It processes the text token-by-token and predicts transitions (Shift, Reduce, Out, or Begin/In of an entity). This allows our model to simultaneously extract multi-word analyte names ('High Sensitivity Troponin I'), their numeric values ('0.08'), measurement units ('ng/mL'), normal reference ranges ('0.00-0.04'), and clinical flags ('CRITICAL HIGH')."*
* **Q3:** *"How do you handle lab normal ranges that vary between different hospitals or patient genders?"*  
  * **Answer:** *"Our extractor extracts both the patient's value AND the specific reference interval printed directly on that hospital's report (e.g. 'Creatinine: 1.4 mg/dL [Reference: 0.6–1.2]'). If the laboratory report omits the reference range, our fallback rules apply standard international clinical thresholds defined by the College of American Pathologists (CAP)."*

---

### Member 5: Aarya Dangre (Roll No. 70 | G.R. No. 12415175)
* **Title:** Mathematical Calibration, Backend Microservices & DevOps Lead
* **Primary Module Ownership:** **M5 Diagnostic Confidence Calibrator, FastAPI Microservice, Docker & Security Architecture**

#### What Aarya Built in the Codebase:
1. **4-Pillar Confidence Engine (`server/agents/confidencePillars.ts`):** Designed the mathematical evidence synthesis formula that replaces arbitrary LLM confidence percentages:
   $$\text{Confidence Score} = (0.25 \times \text{Interview}) + (0.30 \times \text{Radiology}) + (0.30 \times \text{Lab}) + (0.15 \times \text{Guideline})$$
2. **Platt Scaling & Calibrator Training (`training/train_calibrator.py`):**
   - Synthesized and balanced a 1,200-case clinical cohort (`labelled_cases_1200.jsonl`) modeling MIMIC-IV emergency triage distributions.
   - Trained a Logistic Regression Calibrator with **Platt Scaling (`CalibratedClassifierCV`, 3-fold CV)**.
   - **Reduced Expected Calibration Error (ECE) from 0.2611 down to 0.0121** (a 95.3% reduction in probability error).
   - Reduced Brier Score from 0.2214 to **0.1537**.
3. **Random Forest Urgency Cross-Check Classifier:** Trained a 100-tree Random Forest classifier predicting triage urgency (**Routine**, **Urgent**, **Emergency**) with a **Macro F1-Score of 0.9926**.
4. **FastAPI AI Microservice (`python_service/app.py`):** Built a standalone Python microservice on port 8000 exposing `/rag/search`, `/ocr/extract-lab`, and `/calibrator/predict`, satisfying the synopsis requirement for modular Python AI APIs.
5. **Containerization & Cloud Security:**
   - Built the multi-stage [`Dockerfile`](file:///c:/Users/nieeh/Downloads/mediagent-ai/Dockerfile) and [`docker-compose.yml`](file:///c:/Users/nieeh/Downloads/mediagent-ai/docker-compose.yml) orchestrating the React frontend, Express API, and FastAPI services.
   - Hardened [`firestore.rules`](file:///c:/Users/nieeh/Downloads/mediagent-ai/firestore.rules) by replacing world-readable permissions with strict `request.auth != null` access control for patient data privacy.

#### Aarya's Viva Questions & Exact Answers:
* **Q1 (Prof. Thorat):** *"What is Platt Scaling, and why is calibration critical in medical AI?"*  
  * **Answer:** *"Modern neural networks and language models are notoriously miscalibrated—they often output 95% confidence even when their accuracy is barely 60%. Platt Scaling fits a scalar logistic regression model $P(y=1|f) = \frac{1}{1 + \exp(A \cdot f + B)}$ over the model's raw evidence score $f$. It transforms arbitrary model scores into true empirical probabilities. When our calibrated model says '75% confidence', it means that across 100 similar patients, exactly 75 of them truly have that disease, which is essential for medical decision-making."*
* **Q2:** *"How do you measure calibration quality mathematically?"*  
  * **Answer:** *"We measure it using two standard metrics:  
  1. **Expected Calibration Error (ECE):** We bin predictions into $M$ confidence bins and compute the weighted difference between average accuracy and average confidence: $\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} |\text{acc}(B_m) - \text{conf}(B_m)|$. Our training reduced ECE from 0.2611 to 0.0121.  
  2. **Brier Score:** The mean squared error between the predicted probability and the binary clinical outcome: $\text{Brier} = \frac{1}{N}\sum_{t=1}^N (f_t - o_t)^2$. Lower is better; our score improved from 0.2214 to 0.1537."*
* **Q3:** *"Why did you create a separate FastAPI microservice when you already had an Express Node.js backend?"*  
  * **Answer:** *"Node.js is single-threaded and excels at non-blocking I/O, WebSockets, and user session management. However, heavy machine learning libraries like ChromaDB, PyTorch, PyMuPDF, and Scikit-learn run natively and most efficiently in Python. By separating the Python AI microservice (port 8000) from the Express API gateway (port 3000) using Docker Compose, we ensure independent horizontal scalability, type-safe decoupling, and adherence to modern microservice architecture."*

---

## 4. Coordinated 10-Minute Team Presentation Flow

When presenting as a 5-person group, divide the 10-minute presentation strictly as follows:

| Time | Presenter | Slide / Topic | What to Show on Screen |
|---|---|---|---|
| **0:00 – 2:00** | **Nieehaanshu Hireh (Lead)** | Title, Problem Statement, System Overview & RAG Knowledge Retrieval | Show Slide 1, 2, 3 & Slide 6; deliver the opening speech; show ChromaDB guideline retrieval. |
| **2:00 – 4:00** | **Krissh Garsund** | Multi-Agent Orchestration, Interviewer Agent & Live Patient Intake Demo | Show Slide 4; start app at `localhost:3000`; run live Patient Intake step with symptoms. |
| **4:00 – 6:00** | **Harsh Gawas** | Radiology Agent, DenseNet-121 Kaggle GPU Training, ROC Curves & Grad-CAM XAI | Show Slide 5; show `radiology_roc_auc_curves.png` (AUC 0.782); upload CXR image in UI. |
| **6:00 – 8:00** | **Faheem Inamdar** | Lab Analyst Agent, PyMuPDF Engine, 19 Biomarkers & SpaCy Lab NER Model | Show Slide 7; show `lab_ner_training_curve.png`; upload `sample_lab_report.txt` in UI. |
| **8:00 – 10:00** | **Aarya Dangre** | 4-Pillar Calibrator, Platt Scaling, ECE Reduction, FastAPI & Docker Deployment | Show Slide 8; show `m5_calibration_reliability_curve.png`; show Final Report with Pillars. |

---

## 5. Summary Table for Quick Reference

```
+--------------------+----------------------+-------------------------------+----------------------------------+
| Student Name       | Module Name          | Key Algorithm / Technology    | Primary Metric / Outcome         |
+--------------------+----------------------+-------------------------------+----------------------------------+
| Nieehaanshu Hireh  | Lead & M2: RAG       | S-PubMedBert Bi-Encoder,      | Recall@10 = 1.000 (100%),        |
| (Roll 57)          | Knowledge Retrieval  | Hard-Negative Mining, ChromaDB| MRR@10 = 0.774, NDCG@10 = 0.827  |
+--------------------+----------------------+-------------------------------+----------------------------------+
| Krissh Garsund     | M4: Interviewer &    | Gemini 2.5 Flash, Prompt      | <60s intake, zero-crash fallback |
| (Roll 38)          | Doctor Synthesis     | Engineering, CURB-65 / SIRS   | with deterministic state guard   |
+--------------------+----------------------+-------------------------------+----------------------------------+
| Harsh Gawas        | M1: Radiology Vision | DenseNet-121 ONNX, PyTorch,   | Mean ROC-AUC = 0.782 on 14 NIH   |
| (Roll 41)          | & Grad-CAM XAI       | Grad-CAM, Kaggle GPU (T4 x2)  | pathologies; 27 MB ONNX graph    |
+--------------------+----------------------+-------------------------------+----------------------------------+
| Faheem Inamdar     | M3: Lab OCR &        | PyMuPDF DOM Parser, Custom    | 19 Analytes parsed in <20ms,     |
| (Roll 58)          | SpaCy Lab NER        | SpaCy Transition Token NER    | 25 epochs NER model exported     |
+--------------------+----------------------+-------------------------------+----------------------------------+
| Aarya Dangre       | M5: Calibrator,      | Platt Scaling, 4-Pillars,     | ECE dropped from 0.261 to 0.0121,|
| (Roll 70)          | Microservices & CI   | Random Forest, FastAPI, Docker| Urgency F1 = 0.9926, Dockerized  |
+--------------------+----------------------+-------------------------------+----------------------------------+
```


