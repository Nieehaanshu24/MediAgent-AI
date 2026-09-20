# Kaggle GPU Training Guide: M1 Radiology Agent (DenseNet-121)

This guide walks you through using your **30 hours of free Kaggle GPU** to train the full multi-label chest X-ray classifier on the real **NIH ChestX-ray14 dataset** without downloading 45 GB locally.

---

## Step 1: Open Kaggle & Create a New Notebook

1. Go to [kaggle.com](https://www.kaggle.com/) and sign in.
2. Click **Create** (+ button in top-left) → **New Notebook**.

---

## Step 2: Enable Free GPU (NVIDIA T4 or P100)

1. In the right-hand panel of your notebook, look for **Notebook options**.
2. Click on **Accelerator**.
3. Select **GPU T4 x2** (or **GPU P100**).
4. Verify the top bar shows `GPU: Active`.

---

## Step 3: Attach the NIH ChestX-ray14 Dataset (Zero Download Time!)

1. In the right-hand panel under **Data**, click **+ Add Input**.
2. In the search box, type:
   ```
   nih-chest-xrays
   ```
   *(Or search `data` under NIH Chest X-rays)*
3. Click the **+ (Add)** button next to **NIH Chest X-rays** (by NIH / Kaggle).
4. Kaggle instantly mounts the dataset under `/kaggle/input/` without consuming any local disk space or bandwidth!

---

## Step 4: Import the Training Notebook

1. In your Kaggle Notebook menu, click **File** → **Import Notebook**.
2. Upload [`training/kaggle_train_radiology.ipynb`](kaggle_train_radiology.ipynb) from this repository.
   *(Or open the file and copy-paste the cells into your Kaggle notebook).*

---

## Step 5: Run Training

1. Click **Run All** (or press `Shift + Enter` through each cell).
2. The notebook will:
   - Verify CUDA GPU acceleration.
   - Index the NIH images and balance positive/negative class weights.
   - Train **DenseNet-121** across 5 epochs using mixed precision (`torch.cuda.amp`).
   - Plot per-class **ROC-AUC curves** for all 14 pathologies.
   - Plot **Training & Validation Loss** curves.
   - Export **`mediagent_radiology_densenet121.onnx`** (~28 MB).

*Estimated Run Time on T4 GPU: ~15–25 minutes.*

---

## Step 6: Download Outputs to Your Local Machine

Once execution finishes:
1. In the right-hand panel under **Output** (`/kaggle/working/`), you will see:
   - `mediagent_radiology_densenet121.onnx`
   - `radiology_roc_auc_curves.png`
   - `radiology_loss_curve.png`
2. Click the three dots next to each file and select **Download**.
3. Move `mediagent_radiology_densenet121.onnx` into your local `.model_cache/` folder:
   ```
   c:\Users\nieeh\Downloads\mediagent-ai\.model_cache\mediagent_radiology_densenet121.onnx
   ```
4. Move the `.png` charts into `training/out/` and insert them into your presentation slides!

---

## Why Evaluators Will Love This:
- You show **authentic ROC-AUC curves** across all 14 official NIH pathologies.
- You demonstrate **patient-level split stratification** to prevent data leakage.
- You use **positive class weighting** to handle medical class imbalance.
- You demonstrate proficiency in **cloud GPU training workflows** (Kaggle/Colab).
