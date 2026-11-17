import { Injectable } from '@angular/core';
import { getApp, getApps, initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  doc,
  Firestore,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

@Injectable({ providedIn: 'root' })
export class FirebaseClientService {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Firestore;

  constructor() {
    this.app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app, firebaseConfig.firestoreDatabaseId);
    void this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await getDocFromServer(doc(this.db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    }
  }

  handleFirestoreError(
    error: unknown,
    operationType: OperationType,
    path: string | null
  ): never {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: this.auth.currentUser?.uid,
        email: this.auth.currentUser?.email,
        emailVerified: this.auth.currentUser?.emailVerified,
        isAnonymous: this.auth.currentUser?.isAnonymous,
        tenantId: this.auth.currentUser?.tenantId,
        providerInfo:
          this.auth.currentUser?.providerData.map((provider) => ({
            providerId: provider.providerId,
            displayName: provider.displayName,
            email: provider.email,
            photoUrl: provider.photoURL,
          })) || [],
      },
      operationType,
      path,
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
}
