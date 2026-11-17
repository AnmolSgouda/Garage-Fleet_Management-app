import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };

let firestoreInstance: Firestore | null = null;
let firestoreAvailable = false;
let probePromise: Promise<boolean> | null = null;

export function getAdminFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;
  try {
    const app = getApps().length
      ? getApp()
      : initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
        });
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
    return firestoreInstance;
  } catch {
    firestoreInstance = null;
    return null;
  }
}

export async function verifyFirestoreAvailability(): Promise<boolean> {
  if (probePromise) return probePromise;
  probePromise = (async () => {
    const db = getAdminFirestore();
    if (!db) {
      firestoreAvailable = false;
      return false;
    }
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore probe timeout')), 2000)
      );
      await Promise.race([db.collection('garageConfigs').limit(1).get(), timeout]);
      firestoreAvailable = true;
      return true;
    } catch {
      firestoreAvailable = false;
      return false;
    }
  })();
  return probePromise;
}

export function isFirestoreAvailable(): boolean {
  return firestoreAvailable;
}

export function persistDocFireAndForget(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
): void {
  if (!firestoreAvailable || !firestoreInstance) return;
  const clean = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  firestoreInstance
    .collection(collectionName)
    .doc(docId)
    .set(clean, { merge: true })
    .catch((err) => {
      console.warn(`[Firestore] Failed to persist ${collectionName}/${docId}:`, err?.message || err);
    });
}

export function deleteDocFireAndForget(collectionName: string, docId: string): void {
  if (!firestoreAvailable || !firestoreInstance) return;
  firestoreInstance
    .collection(collectionName)
    .doc(docId)
    .delete()
    .catch((err) => {
      console.warn(`[Firestore] Failed to delete ${collectionName}/${docId}:`, err?.message || err);
    });
}

export async function readCollectionSafe<T>(collectionName: string): Promise<T[] | null> {
  if (!firestoreAvailable || !firestoreInstance) return null;
  try {
    const snap = await firestoreInstance.collection(collectionName).get();
    if (snap.empty) return [];
    return snap.docs.map((doc) => doc.data() as T);
  } catch {
    return null;
  }
}
