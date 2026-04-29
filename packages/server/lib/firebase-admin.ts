import {
   applicationDefault,
   cert,
   getApps,
   initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function buildCredential() {
   const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
   if (serviceAccountJson) {
      try {
         const parsed = JSON.parse(serviceAccountJson);
         return cert(parsed);
      } catch (error) {
         throw new Error(
            `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error instanceof Error ? error.message : String(error)}`
         );
      }
   }

   return applicationDefault();
}

function initFirebaseAdmin() {
   if (getApps().length > 0) {
      return getApps()[0];
   }

   return initializeApp({
      credential: buildCredential(),
      projectId: process.env.FIREBASE_PROJECT_ID,
   });
}

initFirebaseAdmin();

export const firebaseAdminAuth = getAuth();
