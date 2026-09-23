import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import type { ClinicalCase } from '../../src/types/clinical';

let db: Firestore | null = null;
const inMemoryCases = new Map<string, ClinicalCase>();

function initFirestore(): Firestore | null {
  if (db) return db;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn('firebase-applet-config.json not found, utilizing in-memory persistence fallback');
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    db = getFirestore(app, config.firestoreDatabaseId);
    return db;
  } catch (err) {
    console.error('Failed to initialize Firestore client:', err);
    return null;
  }
}

export async function saveCaseToFirestore(clinicalCase: ClinicalCase): Promise<void> {
  // Always update in-memory cache for ultra-responsive reads
  inMemoryCases.set(clinicalCase.id, clinicalCase);

  const firestore = initFirestore();
  if (!firestore) return;

  try {
    const caseRef = doc(firestore, 'cases', clinicalCase.id);
    // Sanitize case for firestore (no undefined values)
    const sanitized = JSON.parse(JSON.stringify(clinicalCase));
    await setDoc(caseRef, sanitized, { merge: true });
  } catch (err) {
    console.error(`Error saving case ${clinicalCase.id} to Firestore:`, err);
  }
}

export async function getCaseFromFirestore(caseId: string): Promise<ClinicalCase | null> {
  const firestore = initFirestore();
  if (firestore) {
    try {
      const caseRef = doc(firestore, 'cases', caseId);
      const snap = await getDoc(caseRef);
      if (snap.exists()) {
        const data = snap.data() as ClinicalCase;
        inMemoryCases.set(caseId, data);
        return data;
      }
    } catch (err) {
      console.error(`Error reading case ${caseId} from Firestore:`, err);
    }
  }

  return inMemoryCases.get(caseId) || null;
}

export async function listCasesFromFirestore(maxResults = 25): Promise<ClinicalCase[]> {
  const firestore = initFirestore();
  const results: ClinicalCase[] = [];

  if (firestore) {
    try {
      const casesColl = collection(firestore, 'cases');
      const q = query(casesColl, orderBy('createdAt', 'desc'), limit(maxResults));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        results.push(docSnap.data() as ClinicalCase);
      });
    } catch (err) {
      console.warn('Firestore list query failed, combining with in-memory cases:', err);
    }
  }

  // Merge in-memory cases
  for (const [id, c] of inMemoryCases.entries()) {
    if (!results.some((r) => r.id === id)) {
      results.push(c);
    }
  }

  // Sort descending by createdAt
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results.slice(0, maxResults);
}

export async function deleteCaseFromFirestore(caseId: string): Promise<void> {
  inMemoryCases.delete(caseId);
  const firestore = initFirestore();
  if (!firestore) return;
  try {
    const caseRef = doc(firestore, 'cases', caseId);
    await deleteDoc(caseRef);
  } catch (err) {
    console.error(`Error deleting case ${caseId}:`, err);
  }
}
